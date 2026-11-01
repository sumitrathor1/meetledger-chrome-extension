/**
 * MeetLedger - Dashboard Meetings Module
 * Handles All Meetings list, search/filtering, deletion, title editing,
 * and Individual Meeting Details view with granular participant session timelines.
 */

(function (global) {
  'use strict';

  let currentMeetingId = null;
  let currentMeetingData = null;
  let currentMeetingAttendance = [];

  const MeetingsModule = {
    /**
     * Initializes meeting page listeners
     */
    init() {
      const searchInput = document.getElementById('meetings-search-input');
      const statusFilter = document.getElementById('meetings-filter-status');
      const dateFilter = document.getElementById('meetings-filter-date');
      const btnRefresh = document.getElementById('meetings-btn-refresh');

      if (searchInput) searchInput.addEventListener('input', () => this.loadAllMeetings());
      if (statusFilter) statusFilter.addEventListener('change', () => this.loadAllMeetings());
      if (dateFilter) dateFilter.addEventListener('change', () => this.loadAllMeetings());
      if (btnRefresh) btnRefresh.addEventListener('click', () => this.loadAllMeetings());

      // Back button in meeting detail
      const btnBack = document.getElementById('btn-back-to-meetings');
      if (btnBack) {
        btnBack.addEventListener('click', () => {
          global.MeetLedgerDashboard.navigateTo('meetings');
        });
      }

      // Edit Meeting Title
      const btnEditTitle = document.getElementById('btn-edit-meeting-title');
      if (btnEditTitle) {
        btnEditTitle.addEventListener('click', () => {
          if (!currentMeetingData) return;
          const modal = document.getElementById('modal-edit-meeting');
          const idInput = document.getElementById('edit-meeting-id');
          const titleInput = document.getElementById('edit-meeting-title-input');
          if (modal && idInput && titleInput) {
            idInput.value = currentMeetingData.id;
            titleInput.value = currentMeetingData.title || '';
            modal.classList.remove('hidden');
          }
        });
      }

      const btnSaveTitle = document.getElementById('btn-save-meeting-title');
      if (btnSaveTitle) {
        btnSaveTitle.addEventListener('click', async () => {
          const idInput = document.getElementById('edit-meeting-id');
          const titleInput = document.getElementById('edit-meeting-title-input');
          const modal = document.getElementById('modal-edit-meeting');
          if (idInput && titleInput && idInput.value && titleInput.value.trim()) {
            await global.MeetLedgerDB.updateMeeting(idInput.value, { title: titleInput.value.trim() });
            if (modal) modal.classList.add('hidden');
            global.MeetLedgerDashboard.showToast('Meeting title updated.');
            if (currentMeetingId === idInput.value) {
              this.openMeetingDetail(currentMeetingId);
            }
            this.loadAllMeetings();
          }
        });
      }

      // Meeting Detail Search
      const detailSearch = document.getElementById('detail-participant-search');
      if (detailSearch) {
        detailSearch.addEventListener('input', () => {
          this.renderMeetingParticipantsTable(currentMeetingAttendance);
        });
      }

      // Exports in Meeting Detail
      const btnCsvSummary = document.getElementById('btn-detail-export-csv');
      if (btnCsvSummary) {
        btnCsvSummary.addEventListener('click', () => {
          if (!currentMeetingData) return;
          const csv = global.MeetLedgerExport.generateSummaryCSV(currentMeetingData, currentMeetingAttendance);
          const name = `Attendance_Summary_${currentMeetingData.meetingCode}_${new Date().toISOString().slice(0, 10)}.csv`;
          global.MeetLedgerExport.downloadFile(csv, name, 'text/csv;charset=utf-8;');
          global.MeetLedgerDashboard.showToast('Summary CSV downloaded.');
        });
      }

      const btnCsvDetailed = document.getElementById('btn-detail-export-detailed');
      if (btnCsvDetailed) {
        btnCsvDetailed.addEventListener('click', () => {
          if (!currentMeetingData) return;
          const csv = global.MeetLedgerExport.generateDetailedSessionsCSV(currentMeetingData, currentMeetingAttendance);
          const name = `Attendance_Intervals_${currentMeetingData.meetingCode}_${new Date().toISOString().slice(0, 10)}.csv`;
          global.MeetLedgerExport.downloadFile(csv, name, 'text/csv;charset=utf-8;');
          global.MeetLedgerDashboard.showToast('Detailed intervals CSV downloaded.');
        });
      }

      const btnPrint = document.getElementById('btn-detail-print');
      if (btnPrint) {
        btnPrint.addEventListener('click', () => {
          if (!currentMeetingData) return;
          const html = global.MeetLedgerExport.generatePrintHTML(currentMeetingData, currentMeetingAttendance);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => {
              printWindow.focus();
              printWindow.print();
            }, 300);
          }
        });
      }
    },

    /**
     * Loads and populates the All Meetings table
     */
    async loadAllMeetings() {
      const tbody = document.getElementById('tbody-all-meetings');
      if (!tbody) return;

      const search = (document.getElementById('meetings-search-input') || {}).value;
      const status = (document.getElementById('meetings-filter-status') || {}).value;
      const date = (document.getElementById('meetings-filter-date') || {}).value;

      try {
        const meetings = await global.MeetLedgerDB.getAllMeetings({
          search,
          status,
          startDate: date ? date : null,
          endDate: date ? date : null,
          limit: 200
        });

        if (meetings.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="text-center">No matching meetings found.</td></tr>';
          return;
        }

        const timeUtils = global.MeetLedgerTimeUtils;
        let html = '';

        meetings.forEach(m => {
          const dateStr = timeUtils ? timeUtils.formatDate(m.startedAt, 'readable') : (m.startedAt || '').slice(0, 10);
          const startStr = timeUtils ? timeUtils.formatTime(m.startedAt) : '-';
          const endStr = m.endedAt ? (timeUtils ? timeUtils.formatTime(m.endedAt) : m.endedAt) : (m.status === 'ongoing' ? 'Ongoing' : '-');
          const durationStr = timeUtils ? timeUtils.formatDuration(m.durationSeconds || 0) : `${m.durationSeconds || 0}s`;
          const avgPct = `${m.averageAttendancePercentage || 0}%`;

          html += `
            <tr>
              <td><strong>${m.title || 'Untitled Meeting'}</strong></td>
              <td><span class="code-pill">${m.meetingCode || '-'}</span></td>
              <td>${dateStr}</td>
              <td>${startStr}</td>
              <td>${endStr}</td>
              <td>${durationStr}</td>
              <td>${m.participantsCount || 0}</td>
              <td>${avgPct}</td>
              <td><span class="status-pill ${m.status}">${m.status}</span></td>
              <td class="text-right">
                <button class="btn btn-secondary btn-sm" onclick="MeetLedgerMeetings.openMeetingDetail('${m.id}')" title="View Details">
                  View
                </button>
                <button class="btn btn-secondary btn-sm" onclick="MeetLedgerMeetings.deleteMeeting('${m.id}')" title="Delete">
                  Delete
                </button>
              </td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
      } catch (err) {
        console.error('Failed to load meetings:', err);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Error loading meetings.</td></tr>';
      }
    },

    /**
     * Opens Individual Meeting Detail view
     */
    async openMeetingDetail(meetingId) {
      currentMeetingId = meetingId;
      global.MeetLedgerDashboard.navigateTo('meeting-detail');

      try {
        const meeting = await global.MeetLedgerDB.getMeeting(meetingId);
        const records = await global.MeetLedgerDB.getMeetingAttendance(meetingId);

        currentMeetingData = meeting;
        currentMeetingAttendance = records;

        if (!meeting) {
          global.MeetLedgerDashboard.showToast('Meeting record not found.');
          global.MeetLedgerDashboard.navigateTo('meetings');
          return;
        }

        const timeUtils = global.MeetLedgerTimeUtils;

        document.getElementById('detail-meeting-title').textContent = meeting.title || 'Untitled Meeting';
        document.getElementById('detail-meeting-code').textContent = meeting.meetingCode || '-';
        document.getElementById('detail-meeting-date').textContent = timeUtils ? timeUtils.formatDate(meeting.startedAt, 'readable') : meeting.startedAt;
        
        const statusEl = document.getElementById('detail-meeting-status');
        if (statusEl) {
          statusEl.textContent = (meeting.status || 'COMPLETED').toUpperCase();
          statusEl.className = `status-pill ${meeting.status}`;
        }

        document.getElementById('detail-start-time').textContent = timeUtils ? timeUtils.formatTime(meeting.startedAt) : '-';
        document.getElementById('detail-end-time').textContent = meeting.endedAt ? (timeUtils ? timeUtils.formatTime(meeting.endedAt) : meeting.endedAt) : (meeting.status === 'ongoing' ? 'Ongoing' : '-');
        document.getElementById('detail-duration').textContent = timeUtils ? timeUtils.formatDuration(meeting.durationSeconds || 0) : `${meeting.durationSeconds || 0}s`;
        document.getElementById('detail-total-attendees').textContent = records.length;
        document.getElementById('detail-avg-percentage').textContent = `${meeting.averageAttendancePercentage || 0}%`;

        this.renderMeetingParticipantsTable(records);
      } catch (e) {
        console.error('Error opening meeting detail:', e);
      }
    },

    /**
     * Renders participants table inside meeting detail view
     */
    renderMeetingParticipantsTable(records) {
      const tbody = document.getElementById('tbody-meeting-participants');
      if (!tbody) return;

      const searchInput = document.getElementById('detail-participant-search');
      const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

      const filtered = (records || []).filter(r => {
        if (!query) return true;
        return (r.name && r.name.toLowerCase().includes(query)) ||
               (r.enrollment && r.enrollment.toLowerCase().includes(query));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No participants found.</td></tr>';
        return;
      }

      const timeUtils = global.MeetLedgerTimeUtils;
      let html = '';

      filtered.forEach((r, idx) => {
        const enr = r.enrollment ? `<strong class="code-pill">${r.enrollment}</strong>` : '-';
        const firstJoin = timeUtils ? timeUtils.formatTime(r.firstJoinedAt) : r.firstJoinedAt;
        const lastLeave = r.lastLeftAt ? (timeUtils ? timeUtils.formatTime(r.lastLeftAt) : r.lastLeftAt) : (r.status === 'present' ? 'Still Present' : '-');
        const duration = timeUtils ? timeUtils.formatDuration(r.totalDurationSeconds) : `${r.totalDurationSeconds}s`;
        const sessionsCount = (r.sessions && r.sessions.length) || 1;
        const pct = `${r.attendancePercentage || 0}%`;
        
        let statusClass = r.status || 'present';
        if (r.isLate) statusClass = 'late';
        const statusText = r.isLate ? 'LATE' : statusClass.toUpperCase();

        html += `
          <tr>
            <td>${enr}</td>
            <td><strong>${r.name || 'Anonymous'}</strong></td>
            <td>${firstJoin}</td>
            <td>${lastLeave}</td>
            <td><strong>${duration}</strong></td>
            <td><span class="code-pill">${sessionsCount} ${sessionsCount === 1 ? 'session' : 'sessions'}</span></td>
            <td>${pct}</td>
            <td><span class="status-pill ${statusClass}">${statusText}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="MeetLedgerMeetings.openIntervalsModal('${r.participantId}')">
                Timeline
              </button>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    },

    /**
     * Opens the granular session intervals timeline modal for a participant
     */
    openIntervalsModal(participantId) {
      const record = currentMeetingAttendance.find(r => r.participantId === participantId);
      if (!record) return;

      const modal = document.getElementById('modal-intervals');
      const timeUtils = global.MeetLedgerTimeUtils;

      document.getElementById('modal-intervals-name').textContent = record.name || 'Participant Sessions';
      document.getElementById('modal-intervals-sub').textContent = `${record.enrollment || 'No Enrollment'} • ${record.name}`;

      document.getElementById('modal-total-duration').textContent = timeUtils ? timeUtils.formatDuration(record.totalDurationSeconds) : `${record.totalDurationSeconds}s`;
      document.getElementById('modal-sessions-count').textContent = (record.sessions && record.sessions.length) || 1;
      document.getElementById('modal-attendance-pct').textContent = `${record.attendancePercentage || 0}%`;

      const timelineContainer = document.getElementById('modal-intervals-timeline');
      if (timelineContainer) {
        const sessions = record.sessions || [
          { joinedAt: record.firstJoinedAt, leftAt: record.lastLeftAt, durationSeconds: record.totalDurationSeconds }
        ];

        let html = '';
        sessions.forEach((s, idx) => {
          const joinedStr = timeUtils ? timeUtils.formatTime(s.joinedAt) : s.joinedAt;
          const leftStr = s.leftAt ? (timeUtils ? timeUtils.formatTime(s.leftAt) : s.leftAt) : 'Still Present';
          const durStr = timeUtils ? timeUtils.formatDuration(s.durationSeconds || 0) : `${s.durationSeconds || 0}s`;

          html += `
            <div class="timeline-interval-item">
              <div>
                <span class="t-session-tag">Session #${idx + 1}</span>
                <div class="t-session-times">Joined: <strong>${joinedStr}</strong> &bull; Left: <strong>${leftStr}</strong></div>
              </div>
              <div class="t-session-dur">${durStr}</div>
            </div>
          `;
        });

        timelineContainer.innerHTML = html;
      }

      if (modal) modal.classList.remove('hidden');
    },

    /**
     * Deletes a meeting and its attendance records with confirmation
     */
    async deleteMeeting(meetingId) {
      if (!confirm('Are you sure you want to permanently delete this meeting and all its attendance records?')) {
        return;
      }

      try {
        await global.MeetLedgerDB.deleteMeeting(meetingId);
        global.MeetLedgerDashboard.showToast('Meeting deleted successfully.');
        this.loadAllMeetings();
        global.MeetLedgerDashboard.loadOverview();
      } catch (e) {
        console.error('Failed to delete meeting:', e);
        global.MeetLedgerDashboard.showToast('Failed to delete meeting.');
      }
    }
  };

  global.MeetLedgerMeetings = MeetingsModule;
})(typeof window !== 'undefined' ? window : this);

