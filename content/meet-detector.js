/**
 * MeetLedger - Google Meet Detector & Content Controller
 * Detects meeting lifecycle, injects floating tracking HUD, and coordinates observer & engine.
 */

(function () {
  'use strict';

  const adapter = window.MeetDomAdapter;
  const observer = window.MeetParticipantObserver;
  const engine = window.MeetAttendanceEngine;
  const timeUtils = window.MeetLedgerTimeUtils;
  const identity = window.MeetLedgerIdentity;
  const exportUtils = window.MeetLedgerExport;

  let settings = null;
  let widgetContainer = null;
  let toastElement = null;
  let checkCallInterval = null;
  let isMeetingActive = false;

  /**
   * Shows a quick transient toast message on the Meet UI
   */
  function showToast(message, duration = 3000) {
    if (!toastElement) {
      toastElement = document.createElement('div');
      toastElement.className = 'ml-toast';
      document.body.appendChild(toastElement);
    }
    toastElement.textContent = `MeetLedger: ${message}`;
    toastElement.classList.add('show');
    setTimeout(() => {
      if (toastElement) toastElement.classList.remove('show');
    }, duration);
  }

  /**
   * Injects or updates the floating UI widget in the Google Meet page
   */
  function renderWidget() {
    if (!widgetContainer) {
      widgetContainer = document.createElement('div');
      widgetContainer.id = 'meetledger-floating-widget';
      document.body.appendChild(widgetContainer);
    }

    const state = engine.getState();
    const meeting = state.meeting || {};
    const presentCount = meeting.presentCount || 0;
    const totalCount = meeting.participantsCount || 0;
    const duration = timeUtils ? timeUtils.formatDigitalTimer(meeting.durationSeconds || 0) : '00:00';
    const isTracking = state.isTracking;
    const isPaused = state.isPaused;
    const isPeopleOpen = adapter.isPeoplePanelOpen();

    let statusClass = 'stopped';
    let statusText = 'Stopped';
    if (isTracking && !isPaused) {
      statusClass = 'tracking';
      statusText = 'Tracking';
    } else if (isTracking && isPaused) {
      statusClass = 'paused';
      statusText = 'Paused';
    }

    // Preserve open/closed panel state
    const isCardOpen = widgetContainer.querySelector('.ml-card-panel.open') !== null;

    widgetContainer.innerHTML = `
      <div class="ml-pill" id="ml-pill-toggle" title="Click to view MeetLedger controls">
        <div class="ml-logo-icon">ML</div>
        <span class="ml-pill-title">MeetLedger</span>
        <div class="ml-status-dot ${statusClass}" title="Status: ${statusText}"></div>
        <div class="ml-pill-stat">
          <span>👥</span>
          <span id="ml-stat-present">${presentCount}</span>
        </div>
        <div class="ml-pill-stat">
          <span>⏱️</span>
          <span id="ml-stat-timer">${duration}</span>
        </div>
      </div>

      <div class="ml-card-panel ${isCardOpen ? 'open' : ''}" id="ml-card-panel">
        <div class="ml-card-header">
          <h4>Google Meet Attendance</h4>
          <span class="ml-code">${meeting.meetingCode || 'Live'}</span>
        </div>
        <div class="ml-card-body">
          ${!isPeopleOpen ? `
            <div class="ml-panel-warning">
              <span>⚠️ Open People panel to track all participants</span>
              <button id="ml-btn-open-people">Open</button>
            </div>
          ` : ''}

          <div class="ml-metric-row">
            <div class="ml-metric-box">
              <div class="ml-label">Present Now</div>
              <div class="ml-val" style="color: #16a34a;">${presentCount}</div>
            </div>
            <div class="ml-metric-box">
              <div class="ml-label">Total Unique</div>
              <div class="ml-val">${totalCount}</div>
            </div>
          </div>

          <div class="ml-actions">
            <button class="ml-btn ml-btn-primary" id="ml-btn-dashboard">
              📊 Open Analytics Dashboard
            </button>
            <button class="ml-btn" id="ml-btn-scan">
              🔄 Scan Now
            </button>
            <button class="ml-btn" id="ml-btn-toggle-pause">
              ${isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button class="ml-btn" id="ml-btn-export-csv">
              📥 Export CSV
            </button>
            <button class="ml-btn ml-btn-danger" id="ml-btn-stop">
              ⏹️ Stop Tracking
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const pill = widgetContainer.querySelector('#ml-pill-toggle');
    const card = widgetContainer.querySelector('#ml-card-panel');
    if (pill && card) {
      pill.addEventListener('click', () => {
        card.classList.toggle('open');
      });
    }

    const openPeopleBtn = widgetContainer.querySelector('#ml-btn-open-people');
    if (openPeopleBtn) {
      openPeopleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        adapter.openPeoplePanel();
        setTimeout(renderWidget, 500);
      });
    }

    const scanBtn = widgetContainer.querySelector('#ml-btn-scan');
    if (scanBtn) {
      scanBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        observer.scan();
        showToast('Participants scanned successfully!');
      });
    }

    const togglePauseBtn = widgetContainer.querySelector('#ml-btn-toggle-pause');
    if (togglePauseBtn) {
      togglePauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (engine.isPaused) {
          engine.resumeTracking();
          observer.resume();
          showToast('Tracking resumed');
        } else {
          engine.pauseTracking();
          observer.pause();
          showToast('Tracking paused');
        }
        renderWidget();
      });
    }

    const stopBtn = widgetContainer.querySelector('#ml-btn-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to stop tracking this meeting session?')) {
          stopTrackingMeeting();
          showToast('Meeting tracking completed & saved.');
        }
      });
    }

    const exportBtn = widgetContainer.querySelector('#ml-btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const records = Array.from(engine.attendanceMap.values());
        if (records.length === 0) {
          showToast('No attendance records recorded yet.');
          return;
        }
        const csvContent = exportUtils.generateSummaryCSV(meeting, records);
        const fileName = `Attendance_${meeting.meetingCode || 'Meet'}_${new Date().toISOString().slice(0, 10)}.csv`;
        exportUtils.downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
        showToast('CSV Export downloaded!');
      });
    }

    const dashBtn = widgetContainer.querySelector('#ml-btn-dashboard');
    if (dashBtn) {
      dashBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
        }
      });
    }
  }

  /**
   * Starts tracking for the current active Google Meet session
   */
  async function startTrackingMeeting() {
    const code = adapter.getMeetingCode();
    if (!code) return;

    // Load settings from storage
    if (window.MeetLedgerStorage) {
      settings = await window.MeetLedgerStorage.getSettings();
    } else {
      settings = window.MeetLedgerConstants ? window.MeetLedgerConstants.DEFAULT_SETTINGS : {};
    }

    const title = adapter.getMeetingTitle();
    engine.initMeeting(code, title, settings);
    observer.configure(settings);

    observer.start({
      onJoined: (key, parsedData, timestamp) => {
        engine.handleParticipantJoined(key, parsedData, timestamp);
      },
      onLeft: (key, timestamp) => {
        engine.handleParticipantLeft(key, timestamp);
      },
      onScanComplete: (stats) => {
        engine.lastScanTime = stats.timestamp;
        engine.recalculateMetrics();
        renderWidget();
      }
    });

    renderWidget();
    showToast(`Started tracking ${title}!`);

    // Periodically update duration timer every 10 seconds
    if (!window._mlTimerInterval) {
      window._mlTimerInterval = setInterval(() => {
        if (engine.isTracking && !engine.isPaused) {
          engine.recalculateMetrics();
          const timerEl = document.querySelector('#ml-stat-timer');
          if (timerEl && engine.meeting) {
            timerEl.textContent = timeUtils ? timeUtils.formatDigitalTimer(engine.meeting.durationSeconds) : '00:00';
          }
        }
      }, 5000);
    }
  }

  /**
   * Stops tracking and cleans up
   */
  function stopTrackingMeeting() {
    observer.stop();
    engine.stopMeeting();
    renderWidget();
  }

  /**
   * Checks if user has entered an active call
   */
  function checkCallStatus() {
    const currentlyActive = adapter.isCallActive();

    if (currentlyActive && !isMeetingActive) {
      isMeetingActive = true;
      console.log('[MeetLedger] Active Google Meet call detected!');
      startTrackingMeeting();
    } else if (!currentlyActive && isMeetingActive) {
      isMeetingActive = false;
      console.log('[MeetLedger] Left Google Meet call.');
      stopTrackingMeeting();
    }
  }

  /**
   * Listen for custom DOM events or runtime messages
   */
  window.addEventListener('meetledger:state_update', () => {
    renderWidget();
  });

  // Listen for messages from background/popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || !request.action) return false;

      switch (request.action) {
        case 'GET_STATE':
          sendResponse({
            success: true,
            state: engine.getState(),
            isCallActive: adapter.isCallActive(),
            meetingCode: adapter.getMeetingCode()
          });
          return true;

        case 'START_TRACKING':
          if (!isMeetingActive) {
            isMeetingActive = true;
          }
          startTrackingMeeting();
          sendResponse({ success: true });
          return true;

        case 'PAUSE_TRACKING':
          engine.pauseTracking();
          observer.pause();
          renderWidget();
          sendResponse({ success: true });
          return true;

        case 'RESUME_TRACKING':
          engine.resumeTracking();
          observer.resume();
          renderWidget();
          sendResponse({ success: true });
          return true;

        case 'STOP_TRACKING':
          stopTrackingMeeting();
          sendResponse({ success: true });
          return true;

        case 'SCAN_NOW':
          observer.scan();
          sendResponse({ success: true, count: engine.attendanceMap.size });
          return true;

        case 'PING':
          sendResponse({ pong: true, isCallActive: adapter.isCallActive() });
          return true;
      }
    });
  }

  // Handle meeting end when tab unloads
  window.addEventListener('beforeunload', () => {
    if (isMeetingActive && engine.isTracking) {
      engine.stopMeeting();
    }
  });

  // Start polling for active call entrance
  checkCallInterval = setInterval(checkCallStatus, 2000);
  checkCallStatus();

  console.log('[MeetLedger] Content script loaded and ready on Google Meet.');
})();

