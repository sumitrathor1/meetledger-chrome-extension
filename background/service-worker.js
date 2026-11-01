/**
 * MeetLedger - Background Service Worker
 * Coordinates multi-tab meeting sessions, handles storage sync with IndexedDB,
 * manages the Side Panel, and guarantees data integrity on tab close/browser restart.
 */

try {
  importScripts(
    '../shared/constants.js',
    '../shared/time-utils.js',
    '../shared/identity.js',
    '../shared/database.js',
    '../shared/storage.js'
  );
} catch (e) {
  console.error('[MeetLedgerWorker] importScripts failed:', e);
}

// In-memory active meetings map: tabId -> { meetingId, meetingCode, title, startedAt }
const activeTabSessions = new Map();

/**
 * Extension installation and upgrade lifecycle
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[MeetLedgerWorker] Extension installed/updated:', details.reason);

  // Initialize default settings if empty
  if (self.MeetLedgerStorage) {
    const current = await self.MeetLedgerStorage.getSettings();
    await self.MeetLedgerStorage.saveSettings(current);
  }

  // Configure Chrome Side Panel behavior (if available in this browser version)
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    } catch (e) {
      console.warn('[MeetLedgerWorker] sidePanel setPanelBehavior error:', e);
    }
  }
});

/**
 * Tab close listener: handle meeting interruption or clean completion
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (activeTabSessions.has(tabId)) {
    const session = activeTabSessions.get(tabId);
    console.log(`[MeetLedgerWorker] Meeting tab ${tabId} closed for meeting ${session.meetingId}`);

    // Mark meeting as completed or interrupted in database
    if (self.MeetLedgerDB && session.meetingId) {
      try {
        const meeting = await self.MeetLedgerDB.getMeeting(session.meetingId);
        if (meeting && meeting.status === 'ongoing') {
          const endedAt = new Date().toISOString();
          const start = new Date(meeting.startedAt).getTime();
          const end = new Date(endedAt).getTime();
          const durationSeconds = Math.max(0, Math.round((end - start) / 1000));

          await self.MeetLedgerDB.updateMeeting(session.meetingId, {
            status: 'completed',
            endedAt: endedAt,
            durationSeconds: durationSeconds
          });

          // Close all open participant sessions in attendance
          const records = await self.MeetLedgerDB.getMeetingAttendance(session.meetingId);
          records.forEach(rec => {
            if (rec.status === 'present') {
              rec.status = 'left';
              rec.lastLeftAt = endedAt;
              const lastSess = rec.sessions[rec.sessions.length - 1];
              if (lastSess && lastSess.leftAt === null) {
                lastSess.leftAt = endedAt;
                const sStart = new Date(lastSess.joinedAt).getTime();
                lastSess.durationSeconds = Math.max(0, Math.round((end - sStart) / 1000));
              }
            }
          });
          await self.MeetLedgerDB.saveAttendanceBatch(records);
        }
      } catch (err) {
        console.error('[MeetLedgerWorker] Error updating closed meeting:', err);
      }
    }

    activeTabSessions.delete(tabId);
    if (self.MeetLedgerStorage) {
      await self.MeetLedgerStorage.removeActiveMeeting(tabId);
    }
  }
});

/**
 * Tab update listener: enable sidepanel on Google Meet tabs
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab && tab.url && tab.url.includes('meet.google.com')) {
    if (chrome.sidePanel && chrome.sidePanel.setOptions) {
      try {
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          path: 'sidepanel/sidepanel.html',
          enabled: true
        });
      } catch (e) {}
    }
  }
});

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  const tabId = sender.tab ? sender.tab.id : null;

  switch (message.action) {
    case 'SAVE_ATTENDANCE_SNAPSHOT': {
      handleSaveAttendanceSnapshot(message.payload, tabId)
        .then(() => sendResponse({ success: true }))
        .catch(err => {
          console.error('[MeetLedgerWorker] Failed to save snapshot:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // asynchronous response
    }

    case 'OPEN_DASHBOARD': {
      const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
      chrome.tabs.query({ url: `${dashboardUrl}*` }, (tabs) => {
        if (tabs && tabs.length > 0) {
          // Switch to existing tab
          chrome.tabs.update(tabs[0].id, { active: true });
          if (tabs[0].windowId) {
            chrome.windows.update(tabs[0].windowId, { focused: true });
          }
        } else {
          // Create new tab
          chrome.tabs.create({ url: dashboardUrl });
        }
        sendResponse({ success: true });
      });
      return true;
    }

    case 'OPEN_SIDE_PANEL': {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0) {
            chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
          }
        });
      }
      sendResponse({ success: true });
      return true;
    }

    case 'GET_ACTIVE_MEETING': {
      getActiveMeetingState(tabId)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    default:
      return false;
  }
});

/**
 * Persists attendance snapshot to IndexedDB and caches active state
 */
async function handleSaveAttendanceSnapshot(payload, tabId) {
  if (!payload || !payload.meeting) return;

  const { meeting, attendanceRecords, isFinal } = payload;
  const db = self.MeetLedgerDB;
  if (!db) return;

  // 1. Save / Update Meeting Record in IndexedDB
  await db.saveMeeting(meeting);

  // 2. Save Attendance Records Batch
  if (Array.isArray(attendanceRecords) && attendanceRecords.length > 0) {
    await db.saveAttendanceBatch(attendanceRecords);

    // 3. Update Global Participants Directory
    for (const rec of attendanceRecords) {
      try {
        const participantId = rec.participantId;
        const existing = await db.getParticipant(participantId);

        if (!existing) {
          await db.saveParticipant({
            id: participantId,
            enrollment: rec.enrollment || '',
            name: rec.name || 'Anonymous',
            normalizedName: (rec.name || '').toLowerCase(),
            firstSeenAt: rec.firstJoinedAt,
            lastAttendedAt: rec.firstJoinedAt,
            totalMeetingsAttended: 1
          });
        } else {
          // Update last attended
          await db.saveParticipant({
            ...existing,
            name: rec.name || existing.name,
            enrollment: rec.enrollment || existing.enrollment,
            lastAttendedAt: rec.firstJoinedAt
          });
        }
      } catch (pErr) {
        console.warn('[MeetLedgerWorker] Participant update warning:', pErr);
      }
    }
  }

  // 4. Update Tab session tracking map
  if (tabId) {
    if (isFinal) {
      activeTabSessions.delete(tabId);
      if (self.MeetLedgerStorage) {
        await self.MeetLedgerStorage.removeActiveMeeting(tabId);
      }
    } else {
      activeTabSessions.set(tabId, {
        meetingId: meeting.id,
        meetingCode: meeting.meetingCode,
        title: meeting.title,
        startedAt: meeting.startedAt
      });
      if (self.MeetLedgerStorage) {
        await self.MeetLedgerStorage.setActiveMeeting(tabId, meeting);
      }
    }
  }
}

/**
 * Finds active meeting for tab or latest ongoing meeting
 */
async function getActiveMeetingState(tabId) {
  if (self.MeetLedgerStorage) {
    const activeMap = await self.MeetLedgerStorage.getActiveMeetings();
    if (tabId && activeMap[tabId]) {
      return { success: true, meeting: activeMap[tabId] };
    }
    // Return the first active meeting if any exists
    const keys = Object.keys(activeMap);
    if (keys.length > 0) {
      return { success: true, meeting: activeMap[keys[0]] };
    }
  }

  // Fallback to IndexedDB checking ongoing meetings
  if (self.MeetLedgerDB) {
    const ongoing = await self.MeetLedgerDB.getAllMeetings({ status: 'ongoing', limit: 1 });
    if (ongoing.length > 0) {
      return { success: true, meeting: ongoing[0] };
    }
  }

  return { success: false, meeting: null };
}

console.log('[MeetLedgerWorker] Service worker initialized.');

