/**
 * MeetLedger - Side Panel Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const meetingTitle = document.getElementById('sp-meeting-title');
  const meetingCode = document.getElementById('sp-meeting-code');
  const meetingTimer = document.getElementById('sp-meeting-timer');

  const statPresent = document.getElementById('sp-stat-present');
  const statTotal = document.getElementById('sp-stat-total');
  const statAvg = document.getElementById('sp-stat-avg');

  const tabBtns = document.querySelectorAll('.sp-tab-btn');
  const tabParticipants = document.getElementById('tab-participants');
  const tabActivity = document.getElementById('tab-activity');

  const searchInput = document.getElementById('sp-search-input');
  const participantsList = document.getElementById('sp-participants-list');
  const activityFeed = document.getElementById('sp-activity-feed');

  const btnScan = document.getElementById('sp-btn-scan');
  const btnAi = document.getElementById('sp-btn-ai');
  const btnDashboard = document.getElementById('sp-btn-dashboard');
  const btnTogglePause = document.getElementById('sp-btn-toggle-pause');
  const btnExport = document.getElementById('sp-btn-export');

  let currentTabId = null;
  let activeState = null;
  let pollInterval = null;

  // Open Dashboard
  if (btnDashboard) {
    btnDashboard.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
    });
  }

  // Open AI Assistant in Dashboard
  if (btnAi) {
    btnAi.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD', page: 'ai-assistant' });
    });
  }

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');

      if (target === 'participants') {
        tabParticipants.classList.add('active');
        tabActivity.classList.remove('active');
      } else {
        tabActivity.classList.add('active');
        tabParticipants.classList.remove('active');
      }
    });
  });

  // Participant Search
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (activeState && activeState.attendanceRecords) {
        renderParticipants(activeState.attendanceRecords);
      }
    });
  }

  // Force Scan
  if (btnScan) {
    btnScan.addEventListener('click', () => {
      if (!currentTabId) return;
      chrome.tabs.sendMessage(currentTabId, { action: 'SCAN_NOW' }, () => {
        fetchState();
      });
    });
  }

  // Pause / Resume
  if (btnTogglePause) {
    btnTogglePause.addEventListener('click', () => {
      if (!currentTabId || !activeState) return;
      const action = activeState.isPaused ? 'RESUME_TRACKING' : 'PAUSE_TRACKING';
      chrome.tabs.sendMessage(currentTabId, { action }, () => {
        fetchState();
      });
    });
  }

  // Export
  if (btnExport) {
    btnExport.addEventListener('click', () => {
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
   * Renders participants list
   */
  function renderParticipants(records) {
    if (!participantsList) return;

    if (!records || records.length === 0) {
      participantsList.innerHTML = '<div class="sp-empty">No participants tracked yet.</div>';
      return;
    }

    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const filtered = records.filter(r => {
      if (!query) return true;
      return (r.name && r.name.toLowerCase().includes(query)) ||
             (r.enrollment && r.enrollment.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      participantsList.innerHTML = '<div class="sp-empty">No matching participants.</div>';
      return;
    }

    const timeUtils = window.MeetLedgerTimeUtils;
    let html = '';

    filtered.forEach(r => {
      const isPresent = r.status === 'present';
      const badgeClass = isPresent ? 'present' : 'left';
      const badgeText = isPresent ? 'Present' : 'Left';
      const duration = timeUtils ? timeUtils.formatDuration(r.totalDurationSeconds) : `${r.totalDurationSeconds}s`;
      const enr = r.enrollment ? `<span class="sp-p-enrollment">${r.enrollment}</span>` : '';

      html += `
        <div class="sp-p-card">
          <div class="sp-p-main">
            <span class="sp-p-name" title="${r.name}">${r.name}</span>
            ${enr}
          </div>
          <div class="sp-p-right">
            <span class="sp-p-duration">${duration}</span>
            <span class="sp-badge ${badgeClass}">${badgeText}</span>
          </div>
        </div>
      `;
    });

    participantsList.innerHTML = html;
  }

  /**
   * Renders live activity stream
   */
  function renderActivity(events) {
    if (!activityFeed) return;

    if (!events || events.length === 0) {
      activityFeed.innerHTML = '<div class="sp-empty">No activity events yet.</div>';
      return;
    }

    const timeUtils = window.MeetLedgerTimeUtils;
    let html = '';

    events.forEach(ev => {
      const isJoin = ev.type === 'join';
      const timeStr = timeUtils ? timeUtils.formatTime(ev.timestamp) : ev.timestamp;
      const dotClass = isJoin ? 'join' : 'leave';
      const verb = isJoin ? (ev.isRejoin ? 'rejoined the meeting' : 'joined the meeting') : 'left the meeting';
      const identifier = ev.enrollment ? `[${ev.enrollment}] ${ev.name}` : ev.name;

      html += `
        <div class="sp-activity-item">
          <div class="sp-act-dot ${dotClass}"></div>
          <div class="sp-act-body">
            <div class="sp-act-title">${identifier} ${verb}</div>
            <div class="sp-act-time">${timeStr}</div>
          </div>
        </div>
      `;
    });

    activityFeed.innerHTML = html;
  }

  /**
   * Updates state UI
   */
  function updateUI(state) {
    if (!state || !state.meeting) return;
    activeState = state;

    const m = state.meeting;
    const timeUtils = window.MeetLedgerTimeUtils;

    if (meetingTitle) {
      const isGeneric = !m.title || m.title.toLowerCase() === 'meeting details' || m.title.toLowerCase() === 'details';
      meetingTitle.textContent = isGeneric ? `Meet (${m.meetingCode || 'Live'})` : m.title;
    }
    if (meetingCode) meetingCode.textContent = m.meetingCode || '-';
    if (meetingTimer) {
      meetingTimer.textContent = timeUtils ? timeUtils.formatDigitalTimer(m.durationSeconds || 0) : '00:00';
    }

    if (statPresent) statPresent.textContent = m.presentCount || 0;
    if (statTotal) statTotal.textContent = m.participantsCount || 0;
    if (statAvg) statAvg.textContent = `${m.averageAttendancePercentage || 0}%`;

    if (btnTogglePause) {
      btnTogglePause.textContent = state.isPaused ? 'Resume Tracking' : 'Pause Tracking';
    }

    renderParticipants(state.attendanceRecords || []);
    renderActivity(state.recentEvents || []);
  }

  /**
   * Fetches state from Google Meet tab
   */
  function fetchState() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let targetTab = (tabs && tabs.length > 0 && tabs[0].url && tabs[0].url.includes('meet.google.com')) ? tabs[0] : null;

      // If active tab is not Meet, look for any open Meet tab
      if (!targetTab) {
        chrome.tabs.query({ url: '*://meet.google.com/*' }, (meetTabs) => {
          if (meetTabs && meetTabs.length > 0) {
            connectToTab(meetTabs[0].id);
          } else {
            showNoMeetingState();
          }
        });
      } else {
        connectToTab(targetTab.id);
      }
    });
  }

  function connectToTab(tabId) {
    currentTabId = tabId;
    chrome.tabs.sendMessage(tabId, { action: 'GET_STATE' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success || !res.isCallActive) {
        showNoMeetingState();
      } else {
        updateUI(res.state);
      }
    });
  }

  function showNoMeetingState() {
    if (meetingTitle) meetingTitle.textContent = 'No active Google Meet call';
    if (meetingCode) meetingCode.textContent = 'Offline';
    if (meetingTimer) meetingTimer.textContent = '00:00';
    if (statPresent) statPresent.textContent = '0';
    if (statTotal) statTotal.textContent = '0';
    if (statAvg) statAvg.textContent = '0%';
    if (participantsList) participantsList.innerHTML = '<div class="sp-empty">Open or join a Google Meet call to view live attendance.</div>';
    if (activityFeed) activityFeed.innerHTML = '<div class="sp-empty">No active meeting session.</div>';
  }

  fetchState();
  pollInterval = setInterval(fetchState, 3000);

  window.addEventListener('unload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });
});

