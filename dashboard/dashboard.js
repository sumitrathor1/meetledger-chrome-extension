/**
 * MeetLedger - Main Dashboard Controller
 * Handles SPA navigation, theme switching, global metrics, settings management, and live sync.
 */

(function (global) {
  'use strict';

  let currentTheme = 'light';
  let liveMeetingPollInterval = null;

  const Dashboard = {
    /**
     * Initializes the entire dashboard application
     */
    async init() {
      console.log('[MeetLedger] Initializing Dashboard...');

      // 1. Initialize Database
      if (global.MeetLedgerDB) {
        await global.MeetLedgerDB.init();
      }

      // 2. Setup Lucide Icons
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }

      // 3. Navigation Setup
      this.initNavigation();

      // 4. Theme Setup
      this.initTheme();

      // 5. Initialize Child Modules
      if (global.MeetLedgerMeetings) global.MeetLedgerMeetings.init();
      if (global.MeetLedgerParticipants) global.MeetLedgerParticipants.init();
      if (global.MeetLedgerReports) global.MeetLedgerReports.init();
      if (global.MeetLedgerAI) await global.MeetLedgerAI.init();

      // 6. Settings Setup
      this.initSettings();

      // 7. Modals Setup
      this.initModals();

      // 8. Quick Actions Setup
      this.initQuickActions();

      // 9. Load Overview Data
      await this.loadOverview();

      // 10. Check Deep Link Hash
      const initialHash = (window.location.hash || '').replace('#', '');
      if (initialHash && document.getElementById(`page-${initialHash}`)) {
        this.navigateTo(initialHash);
      }

      // 11. Live Meeting Check
      this.checkLiveMeeting();
      liveMeetingPollInterval = setInterval(() => this.checkLiveMeeting(), 3000);

      console.log('[MeetLedger] Dashboard ready.');
    },

    /**
     * Handles SPA tab navigation
     */
    initNavigation() {
      const navButtons = document.querySelectorAll('.nav-item');
      navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const page = btn.getAttribute('data-page');
          this.navigateTo(page);
        });
      });

      const linkViewAll = document.getElementById('link-view-all-meetings');
      if (linkViewAll) {
        linkViewAll.addEventListener('click', () => this.navigateTo('meetings'));
      }
    },

    /**
     * Navigates to a specific page section
     */
    navigateTo(pageName) {
      const sections = document.querySelectorAll('.page-section');
      const navButtons = document.querySelectorAll('.nav-item');
      const pageTitle = document.getElementById('page-title');

      sections.forEach(s => s.classList.remove('active'));
      navButtons.forEach(b => b.classList.remove('active'));

      const targetSection = document.getElementById(`page-${pageName}`);
      const targetNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);

      if (targetSection) targetSection.classList.add('active');
      if (targetNav) targetNav.classList.add('active');

      // Update Topbar Title
      const titles = {
        overview: 'Overview',
        meetings: 'All Meetings',
        'meeting-detail': 'Meeting Details',
        live: 'Live Meeting',
        participants: 'Participants Directory',
        reports: 'Attendance Reports & Export',
        analytics: 'Analytics & Insights',
        'ai-assistant': 'MeetLedger AI Assistant',
        settings: 'Settings & Storage',
        about: 'About MeetLedger'
      };

      if (pageTitle && titles[pageName]) {
        pageTitle.textContent = titles[pageName];
      }

      // Trigger module-specific refreshes
      if (pageName === 'overview') this.loadOverview();
      else if (pageName === 'meetings') global.MeetLedgerMeetings.loadAllMeetings();
      else if (pageName === 'participants') global.MeetLedgerParticipants.loadParticipants();
      else if (pageName === 'analytics') global.MeetLedgerAnalytics.renderAdvancedAnalytics();
      else if (pageName === 'reports') global.MeetLedgerReports.generatePreview();
      else if (pageName === 'ai-assistant') {
        if (global.MeetLedgerAI) {
          global.MeetLedgerAI.renderConversation();
          global.MeetLedgerAI.renderSidebar();
        }
      }
      else if (pageName === 'live') this.renderLiveMeetingPage();

      // Refresh icons in newly shown DOM
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        setTimeout(lucide.createIcons, 50);
      }
    },

    /**
     * Theme switching (Light / Dark)
     */
    initTheme() {
      const savedTheme = localStorage.getItem('meetledger_theme') || 'light';
      this.setTheme(savedTheme);

      const toggleBtn = document.getElementById('theme-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const next = currentTheme === 'light' ? 'dark' : 'light';
          this.setTheme(next);
        });
      }
    },

    setTheme(theme) {
      currentTheme = theme;
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('meetledger_theme', theme);

      const icon = document.getElementById('theme-icon');
      if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
      }
    },

    /**
     * Overview data & charts loader
     */
    async loadOverview() {
      if (!global.MeetLedgerDB) return;

      try {
        const metrics = await global.MeetLedgerDB.getDashboardMetrics();

        const elTotalMeetings = document.getElementById('metric-total-meetings');
        const elTotalStudents = document.getElementById('metric-total-students');
        const elTotalRecords = document.getElementById('metric-total-records');
        const elAvgAttendance = document.getElementById('metric-avg-attendance');
        const elTotalHours = document.getElementById('metric-total-hours');
        const elActiveMeetings = document.getElementById('metric-active-meetings');

        if (elTotalMeetings) elTotalMeetings.textContent = metrics.totalMeetings;
        if (elTotalStudents) elTotalStudents.textContent = metrics.totalUniqueParticipants;
        if (elTotalRecords) elTotalRecords.textContent = metrics.totalAttendanceRecords;
        if (elAvgAttendance) elAvgAttendance.textContent = `${metrics.averageAttendancePercentage}%`;
        if (elTotalHours) elTotalHours.textContent = `${metrics.totalMeetingHours}h`;
        if (elActiveMeetings) elActiveMeetings.textContent = metrics.activeMeetings;

        // Render Recent Meetings table on overview
        await this.loadRecentMeetingsTable();

        // Render Overview Charts
        if (global.MeetLedgerAnalytics) {
          await global.MeetLedgerAnalytics.renderOverviewCharts();
        }
      } catch (e) {
        console.error('Error loading overview:', e);
      }
    },

    /**
     * Populates recent meetings on overview
     */
    async loadRecentMeetingsTable() {
      const tbody = document.getElementById('tbody-recent-meetings');
      if (!tbody) return;

      const meetings = await global.MeetLedgerDB.getAllMeetings({ limit: 5 });

      if (meetings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No meetings conducted yet.</td></tr>';
        return;
      }

      const timeUtils = global.MeetLedgerTimeUtils;
      let html = '';

      meetings.forEach(m => {
        const date = timeUtils ? timeUtils.formatDate(m.startedAt, 'readable') : (m.startedAt || '').slice(0, 10);
        const dur = timeUtils ? timeUtils.formatDuration(m.durationSeconds || 0) : `${m.durationSeconds || 0}s`;

        html += `
          <tr>
            <td><strong>${m.title || 'Untitled Meeting'}</strong></td>
            <td><span class="code-pill">${m.meetingCode || '-'}</span></td>
            <td>${date}</td>
            <td>${dur}</td>
            <td>${m.participantsCount || 0}</td>
            <td><span class="status-pill ${m.status}">${m.status}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="MeetLedgerMeetings.openMeetingDetail('${m.id}')">
                View
              </button>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    },

    /**
     * Topbar Quick Actions
     */
    initQuickActions() {
      const btnMeet = document.getElementById('btn-quick-new-meeting');
      if (btnMeet) {
        btnMeet.addEventListener('click', () => {
          chrome.tabs.create({ url: 'https://meet.google.com' });
        });
      }

      const btnExport = document.getElementById('btn-quick-export');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          this.navigateTo('reports');
        });
      }
    },

    /**
     * Modals closing functionality
     */
    initModals() {
      const closeButtons = document.querySelectorAll('[data-close-modal]');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const modalId = btn.getAttribute('data-close-modal');
          const modal = document.getElementById(modalId);
          if (modal) modal.classList.add('hidden');
        });
      });

      // Close when clicking modal backdrop
      const modals = document.querySelectorAll('.modal-backdrop');
      modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.add('hidden');
          }
        });
      });
    },

    /**
     * Settings management & testing
     */
    async initSettings() {
      if (!global.MeetLedgerStorage) return;

      const settings = await global.MeetLedgerStorage.getSettings();

      // Populate input values
      const hostNameInput = document.getElementById('setting-host-name');
      const excludedInput = document.getElementById('setting-excluded-names');
      const timeFormatSelect = document.getElementById('setting-time-format');
      const autoTrackToggle = document.getElementById('setting-auto-track');
      const scanIntervalInput = document.getElementById('setting-scan-interval');
      const gracePeriodInput = document.getElementById('setting-grace-period');
      const lateThresholdInput = document.getElementById('setting-late-threshold');
      const patternInput = document.getElementById('setting-enrollment-pattern');
      const apiKeyInput = document.getElementById('setting-gemini-api-key');
      const aiModelSelect = document.getElementById('setting-ai-model');
      const sidebarHost = document.getElementById('sidebar-host-name');

      if (hostNameInput) hostNameInput.value = settings.hostName || '';
      if (sidebarHost && settings.hostName) sidebarHost.textContent = settings.hostName;
      if (excludedInput) excludedInput.value = (settings.excludedNames || []).join(', ');
      if (timeFormatSelect) timeFormatSelect.value = settings.timeFormat || '12h';
      if (autoTrackToggle) autoTrackToggle.checked = !!settings.autoTrack;
      if (scanIntervalInput) scanIntervalInput.value = settings.scanInterval || 3000;
      if (gracePeriodInput) gracePeriodInput.value = settings.leaveGracePeriod || 15;
      if (lateThresholdInput) lateThresholdInput.value = settings.lateThresholdMinutes || 5;
      if (patternInput) patternInput.value = settings.enrollmentPattern || '^([A-Z0-9]{6,16})\\s+(.+)$';
      if (apiKeyInput) apiKeyInput.value = settings.geminiApiKey || '';
      if (aiModelSelect) aiModelSelect.value = settings.aiModel || 'gemini-1.5-flash';

      // Clear AI Memory Handler
      const btnClearAiMem = document.getElementById('btn-clear-ai-memory');
      if (btnClearAiMem) {
        btnClearAiMem.addEventListener('click', () => {
          if (confirm('Clear all AI conversation history and memory?')) {
            if (global.MeetLedgerAIContext) {
              global.MeetLedgerAIContext.clearAllHistory();
            }
            if (global.MeetLedgerAI) {
              global.MeetLedgerAI.renderConversation();
              global.MeetLedgerAI.renderSidebar();
            }
            Dashboard.showToast('AI conversation history cleared.');
          }
        });
      }

      // Live Regex Tester
      const testInput = document.getElementById('test-enrollment-input');
      const testResult = document.getElementById('test-enrollment-result');

      function testPattern() {
        if (!testInput || !testResult || !patternInput) return;
        const val = testInput.value.trim();
        if (!val) {
          testResult.textContent = 'Extracted: [Enrollment: -] [Name: -]';
          return;
        }
        const identity = global.MeetLedgerIdentity;
        if (identity) {
          const res = identity.extractEnrollmentAndName(val, patternInput.value);
          testResult.textContent = `Extracted: [Enrollment: "${res.enrollment || 'None'}"] [Name: "${res.name}"]`;
        }
      }

      if (testInput) testInput.addEventListener('input', testPattern);
      if (patternInput) patternInput.addEventListener('input', testPattern);

      // Save Settings button
      const btnSave = document.getElementById('btn-save-settings');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const excludedArr = (excludedInput.value || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          const updates = {
            hostName: hostNameInput.value.trim(),
            excludedNames: excludedArr,
            timeFormat: timeFormatSelect.value,
            autoTrack: autoTrackToggle.checked,
            scanInterval: Math.max(1000, Number(scanIntervalInput.value) || 3000),
            leaveGracePeriod: Math.max(5, Number(gracePeriodInput.value) || 15),
            lateThresholdMinutes: Math.max(1, Number(lateThresholdInput.value) || 5),
            enrollmentPattern: patternInput.value.trim(),
            geminiApiKey: (apiKeyInput ? apiKeyInput.value.trim() : ''),
            aiModel: (aiModelSelect ? aiModelSelect.value : 'gemini-1.5-flash')
          };

          await global.MeetLedgerStorage.saveSettings(updates);
          if (sidebarHost && updates.hostName) sidebarHost.textContent = updates.hostName;
          Dashboard.showToast('All settings saved successfully!');
        });
      }

      // Full JSON Backup Export
      const btnBackup = document.getElementById('btn-backup-export');
      if (btnBackup) {
        btnBackup.addEventListener('click', async () => {
          const backup = await global.MeetLedgerDB.exportFullDatabase();
          const jsonStr = JSON.stringify(backup, null, 2);
          const filename = `MeetLedger_Backup_${new Date().toISOString().slice(0, 10)}.json`;
          global.MeetLedgerExport.downloadFile(jsonStr, filename, 'application/json');
          Dashboard.showToast('Backup exported.');
        });
      }

      // Restore Backup
      const inputBackupFile = document.getElementById('input-backup-file');
      if (inputBackupFile) {
        inputBackupFile.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (evt) => {
            try {
              const data = JSON.parse(evt.target.result);
              const res = await global.MeetLedgerDB.importDatabaseBackup(data);
              Dashboard.showToast(`Restored: ${res.meetingsImported} meetings, ${res.attendanceImported} attendance records.`);
              Dashboard.loadOverview();
            } catch (err) {
              alert('Failed to parse backup JSON: ' + err.message);
            }
          };
          reader.readAsText(file);
        });
      }

      // Clear All Data
      const btnClearAll = document.getElementById('btn-clear-all-data');
      if (btnClearAll) {
        btnClearAll.addEventListener('click', async () => {
          if (confirm('CRITICAL ACTION: Are you sure you want to permanently delete all recorded meetings and attendance history? This cannot be undone.')) {
            await global.MeetLedgerDB.clearAllData();
            Dashboard.showToast('All records cleared.');
            Dashboard.loadOverview();
          }
        });
      }

      // Storage record count indicator
      const countEl = document.getElementById('storage-record-count');
      if (countEl) {
        const metrics = await global.MeetLedgerDB.getDashboardMetrics();
        countEl.textContent = `${metrics.totalAttendanceRecords} attendance records`;
      }
    },

    /**
     * Checks if there's any live meeting connected in tabs
     */
    async checkLiveMeeting() {
      if (!global.MeetLedgerStorage) return;

      const activeMap = await global.MeetLedgerStorage.getActiveMeetings();
      const keys = Object.keys(activeMap);
      const badge = document.getElementById('live-indicator-badge');

      if (keys.length > 0) {
        if (badge) badge.classList.remove('hidden');
      } else {
        if (badge) badge.classList.add('hidden');
      }
    },

    /**
     * Renders Live Meeting page tab
     */
    async renderLiveMeetingPage() {
      const activeMap = await global.MeetLedgerStorage.getActiveMeetings();
      const keys = Object.keys(activeMap);
      const noMeetingCard = document.getElementById('live-no-meeting-card');
      const activeContainer = document.getElementById('live-active-container');

      if (keys.length === 0) {
        if (noMeetingCard) noMeetingCard.classList.remove('hidden');
        if (activeContainer) activeContainer.classList.add('hidden');
        return;
      }

      if (noMeetingCard) noMeetingCard.classList.add('hidden');
      if (activeContainer) activeContainer.classList.remove('hidden');

      const activeSession = activeMap[keys[0]];
      document.getElementById('live-title').textContent = activeSession.title || 'Google Meet';
      document.getElementById('live-code').textContent = activeSession.meetingCode || '-';
      document.getElementById('live-present-count').textContent = activeSession.presentCount || 0;

      const timeUtils = global.MeetLedgerTimeUtils;
      if (timeUtils) {
        document.getElementById('live-timer').textContent = timeUtils.formatDigitalTimer(activeSession.durationSeconds || 0);
      }

      // Query active meeting records from DB
      const records = await global.MeetLedgerDB.getMeetingAttendance(activeSession.id);
      const tbody = document.getElementById('tbody-live-participants');
      if (tbody) {
        if (records.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center">Scanning participants in Google Meet...</td></tr>';
          return;
        }

        let html = '';
        records.forEach(r => {
          const enr = r.enrollment ? `<strong class="code-pill">${r.enrollment}</strong>` : '-';
          const firstJoin = timeUtils ? timeUtils.formatTime(r.firstJoinedAt) : r.firstJoinedAt;
          const dur = timeUtils ? timeUtils.formatDuration(r.totalDurationSeconds) : `${r.totalDurationSeconds}s`;
          const isPresent = r.status === 'present';

          html += `
            <tr>
              <td>${enr}</td>
              <td><strong>${r.name || 'Anonymous'}</strong></td>
              <td>${firstJoin}</td>
              <td>${dur}</td>
              <td>${(r.sessions && r.sessions.length) || 1}</td>
              <td>${r.attendancePercentage || 0}%</td>
              <td><span class="status-pill ${isPresent ? 'present' : 'left'}">${(r.status || 'present').toUpperCase()}</span></td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      }
    },

    /**
     * Toast notification display
     */
    showToast(message, duration = 3000) {
      const toast = document.getElementById('dashboard-toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, duration);
    }
  };

  global.MeetLedgerDashboard = Dashboard;

  document.addEventListener('DOMContentLoaded', () => {
    Dashboard.init();
  });
})(typeof window !== 'undefined' ? window : this);

