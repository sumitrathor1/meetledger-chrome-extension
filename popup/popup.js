/**
 * MeetLedger - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const activeSection = document.getElementById('active-meeting-section');
  const idleSection = document.getElementById('idle-section');

  const meetingTitle = document.getElementById('meeting-title');
  const meetingCode = document.getElementById('meeting-code');
  const trackingBadge = document.getElementById('tracking-badge');
  const trackingText = document.getElementById('tracking-text');

  const statPresent = document.getElementById('stat-present');
  const statTotal = document.getElementById('stat-total');
  const statDuration = document.getElementById('stat-duration');

  const btnScanNow = document.getElementById('btn-scan-now');
  const btnPauseTracking = document.getElementById('btn-pause-tracking');
  const pauseBtnText = document.getElementById('pause-btn-text');
  const btnExportCSV = document.getElementById('btn-export-csv');

  const participantSearch = document.getElementById('participant-search');
  const participantsList = document.getElementById('participants-list');

  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnIdleDashboard = document.getElementById('btn-idle-dashboard');
  const btnLaunchMeet = document.getElementById('btn-launch-meet');
  const linkSidepanel = document.getElementById('link-sidepanel');

  const qsTotalMeetings = document.getElementById('qs-total-meetings');
  const qsTotalStudents = document.getElementById('qs-total-students');

  let currentTab = null;
  let activeState = null;
  let pollInterval = null;

  // Open Dashboard Handler
  function openDashboard() {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  }

  if (btnOpenDashboard) btnOpenDashboard.addEventListener('click', openDashboard);
  if (btnIdleDashboard) btnIdleDashboard.addEventListener('click', openDashboard);

  // Launch Meet
  if (btnLaunchMeet) {
    btnLaunchMeet.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://meet.google.com' });
    });
  }

  // Open Sidepanel
  if (linkSidepanel) {
    linkSidepanel.addEventListener('click', (e) => {
      e.preventDefault();
      if (chrome.sidePanel && chrome.sidePanel.open && currentTab) {
        chrome.sidePanel.open({ tabId: currentTab.id }).catch(() => {});
      }
    });
  }

  /**
   * Loads historical quick statistics for idle state
   */
  async function loadIdleStats() {
    try {
      if (window.MeetLedgerDB) {
        const metrics = await window.MeetLedgerDB.getDashboardMetrics();
        if (qsTotalMeetings) qsTotalMeetings.textContent = metrics.totalMeetings || 0;
        if (qsTotalStudents) qsTotalStudents.textContent = metrics.totalUniqueParticipants || 0;
      }
    } catch (e) {
      console.warn('Could not load idle stats:', e);
    }
  }

  /**
   * Renders participant list
   */
  function renderParticipants(records) {
    if (!participantsList) return;

    if (!records || records.length === 0) {
      participantsList.innerHTML = '<div class="empty-state">No participants recorded yet.</div>';
      return;
    }

    const query = (participantSearch ? participantSearch.value : '').trim().toLowerCase();
    const filtered = records.filter(r => {
      if (!query) return true;
      return (r.name && r.name.toLowerCase().includes(query)) ||
             (r.enrollment && r.enrollment.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      participantsList.innerHTML = '<div class="empty-state">No matching participants found.</div>';
      return;
    }

    let html = '';
    filtered.forEach(r => {
      const isPresent = r.status === 'present';
      const badgeClass = isPresent ? 'present' : 'left';
      const badgeText = isPresent ? 'Present' : 'Left';
      const enr = r.enrollment ? `<span class="p-enrollment">${r.enrollment}</span>` : '';

      html += `
        <div class="participant-item">
          <div class="p-meta">
            <span class="p-name">${r.name || 'Anonymous'}</span>
            ${enr}
          </div>
          <span class="p-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    });

    participantsList.innerHTML = html;
  }

  /**
   * Updates popup UI with meeting state
   */
  function updateMeetingUI(state) {
    if (!state || !state.meeting) return;
    activeState = state;

    const m = state.meeting;
    if (meetingTitle) {
      const isGeneric = !m.title || m.title.toLowerCase() === 'meeting details' || m.title.toLowerCase() === 'details';
      meetingTitle.textContent = isGeneric ? `Meet (${m.meetingCode || 'Live'})` : m.title;
    }
    if (meetingCode) meetingCode.textContent = m.meetingCode || '-';

    if (statPresent) statPresent.textContent = m.presentCount || 0;
    if (statTotal) statTotal.textContent = m.participantsCount || 0;

    const timeUtils = window.MeetLedgerTimeUtils;
    if (statDuration) {
      statDuration.textContent = timeUtils ? timeUtils.formatDigitalTimer(m.durationSeconds || 0) : '00:00';
    }

    if (trackingBadge && trackingText) {
      if (state.isTracking && !state.isPaused) {
        trackingBadge.className = 'badge-status tracking';
        trackingText.textContent = 'Tracking';
        if (pauseBtnText) pauseBtnText.textContent = 'Pause';
      } else if (state.isTracking && state.isPaused) {
        trackingBadge.className = 'badge-status paused';
        trackingText.textContent = 'Paused';
        if (pauseBtnText) pauseBtnText.textContent = 'Resume';
      } else {
        trackingBadge.className = 'badge-status stopped';
        trackingText.textContent = 'Stopped';
      }
    }

    renderParticipants(state.attendanceRecords || []);
  }

  // Participant search input
  if (participantSearch) {
    participantSearch.addEventListener('input', () => {
      if (activeState && activeState.attendanceRecords) {
        renderParticipants(activeState.attendanceRecords);
      }
    });
  }

  // Scan button
  if (btnScanNow) {
    btnScanNow.addEventListener('click', () => {
      if (!currentTab) return;
      chrome.tabs.sendMessage(currentTab.id, { action: 'SCAN_NOW' }, (res) => {
        if (res && res.success) {
          fetchState();
        }
      });
    });
  }

  // Pause button
  if (btnPauseTracking) {
    btnPauseTracking.addEventListener('click', () => {
      if (!currentTab || !activeState) return;
      const action = activeState.isPaused ? 'RESUME_TRACKING' : 'PAUSE_TRACKING';
      chrome.tabs.sendMessage(currentTab.id, { action }, () => {
        fetchState();
      });
    });
  }

  // Export CSV
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (!activeState || !activeState.meeting || !activeState.attendanceRecords) return;
      const exportUtils = window.MeetLedgerExport;
      if (exportUtils) {
        const csv = exportUtils.generateSummaryCSV(activeState.meeting, activeState.attendanceRecords);
        const name = `Attendance_${activeState.meeting.meetingCode}_${new Date().toISOString().slice(0, 10)}.csv`;
        exportUtils.downloadFile(csv, name, 'text/csv;charset=utf-8;');
      }
    });
  }

  /**
   * Fetches latest state from content script
   */
  function fetchState() {
    if (!currentTab) return;
    chrome.tabs.sendMessage(currentTab.id, { action: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success || !response.isCallActive) {
        // Not on active call
        if (activeSection) activeSection.classList.add('hidden');
        if (idleSection) idleSection.classList.remove('hidden');
        loadIdleStats();
        return;
      }

      // Active call confirmed
      if (idleSection) idleSection.classList.add('hidden');
      if (activeSection) activeSection.classList.remove('hidden');
      updateMeetingUI(response.state);
    });
  }

  // Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];

      if (currentTab.url && currentTab.url.includes('meet.google.com')) {
        fetchState();
        pollInterval = setInterval(fetchState, 3000);
      } else {
        if (activeSection) activeSection.classList.add('hidden');
        if (idleSection) idleSection.classList.remove('hidden');
        loadIdleStats();
      }
    }
  });

  window.addEventListener('unload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });
});

