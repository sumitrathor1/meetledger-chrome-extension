/**
 * MeetLedger - Dashboard Reports Module
 * Handles report generation, date & meeting filtering, and CSV/JSON/Print exports.
 */

(function (global) {
  'use strict';

  let currentPreviewRecords = [];
  let currentPreviewMeeting = null;

  const ReportsModule = {
    /**
     * Initializes reports page controls
     */
    async init() {
      const selectMeeting = document.getElementById('report-select-meeting');
      const startDate = document.getElementById('report-start-date');
      const endDate = document.getElementById('report-end-date');
      const minPct = document.getElementById('report-min-pct');

      if (selectMeeting) selectMeeting.addEventListener('change', () => this.generatePreview());
      if (startDate) startDate.addEventListener('change', () => this.generatePreview());
      if (endDate) endDate.addEventListener('change', () => this.generatePreview());
      if (minPct) minPct.addEventListener('input', () => this.generatePreview());

      // Download Summary CSV
      const btnCsvSummary = document.getElementById('btn-report-csv-summary');
      if (btnCsvSummary) {
        btnCsvSummary.addEventListener('click', () => this.exportSummaryCSV());
      }

      // Download Detailed Intervals CSV
      const btnCsvDetailed = document.getElementById('btn-report-csv-detailed');
      if (btnCsvDetailed) {
        btnCsvDetailed.addEventListener('click', () => this.exportDetailedCSV());
      }

      // Export JSON
      const btnJson = document.getElementById('btn-report-json');
      if (btnJson) {
        btnJson.addEventListener('click', () => this.exportJSON());
      }

      // Print Report
      const btnPrint = document.getElementById('btn-report-print');
      if (btnPrint) {
        btnPrint.addEventListener('click', () => this.printReport());
      }

      await this.loadMeetingDropdown();
      this.generatePreview();
    },

    /**
     * Populates meeting selection dropdown
     */
    async loadMeetingDropdown() {
      const selectMeeting = document.getElementById('report-select-meeting');
      if (!selectMeeting) return;

      try {
        const meetings = await global.MeetLedgerDB.getAllMeetings({ limit: 100 });
        let html = '<option value="all">All Meetings (Consolidated)</option>';

        const timeUtils = global.MeetLedgerTimeUtils;
        meetings.forEach(m => {
          const date = timeUtils ? timeUtils.formatDate(m.startedAt) : (m.startedAt || '').slice(0, 10);
          html += `<option value="${m.id}">${m.title || 'Meeting'} (${m.meetingCode}) - ${date}</option>`;
        });

        selectMeeting.innerHTML = html;
      } catch (e) {
        console.error('Error loading meetings for report dropdown:', e);
      }
    },

    /**
     * Queries and filters records for preview and export
     */
    async generatePreview() {
      const tbody = document.getElementById('tbody-report-preview');
      if (!tbody) return;

      const selectMeeting = document.getElementById('report-select-meeting');
      const startDateInput = document.getElementById('report-start-date');
      const endDateInput = document.getElementById('report-end-date');
      const minPctInput = document.getElementById('report-min-pct');

      const meetingId = selectMeeting ? selectMeeting.value : 'all';
      const startDate = startDateInput ? startDateInput.value : '';
      const endDate = endDateInput ? endDateInput.value : '';
      const minPct = minPctInput ? Number(minPctInput.value) || 0 : 0;

      try {
        let meetingsToProcess = [];
        if (meetingId === 'all') {
          meetingsToProcess = await global.MeetLedgerDB.getAllMeetings({
            startDate: startDate || null,
            endDate: endDate || null
          });
        } else {
          const m = await global.MeetLedgerDB.getMeeting(meetingId);
          if (m) meetingsToProcess = [m];
        }

        const aggregated = [];
        for (const meet of meetingsToProcess) {
          const records = await global.MeetLedgerDB.getMeetingAttendance(meet.id);
          records.forEach(r => {
            if ((r.attendancePercentage || 0) >= minPct) {
              aggregated.push({
                meeting: meet,
                record: r
              });
            }
          });
        }

        currentPreviewRecords = aggregated;
        currentPreviewMeeting = meetingsToProcess.length === 1 ? meetingsToProcess[0] : { title: 'Consolidated Report', meetingCode: 'ALL', startedAt: new Date().toISOString() };

        if (aggregated.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" class="text-center">No attendance records match your filter criteria.</td></tr>';
          return;
        }

        const timeUtils = global.MeetLedgerTimeUtils;
        let html = '';

        aggregated.slice(0, 100).forEach(item => {
          const m = item.meeting;
          const r = item.record;
          const dateStr = timeUtils ? timeUtils.formatDate(m.startedAt) : (m.startedAt || '').slice(0, 10);
          const firstJoin = timeUtils ? timeUtils.formatTime(r.firstJoinedAt) : r.firstJoinedAt;
          const lastLeave = r.lastLeftAt ? (timeUtils ? timeUtils.formatTime(r.lastLeftAt) : r.lastLeftAt) : 'Present';
          const dur = timeUtils ? timeUtils.formatDuration(r.totalDurationSeconds) : `${r.totalDurationSeconds}s`;

          html += `
            <tr>
              <td><strong>${m.title || 'Meeting'}</strong></td>
              <td>${dateStr}</td>
              <td><span class="code-pill">${r.enrollment || '-'}</span></td>
              <td>${r.name || 'Anonymous'}</td>
              <td>${firstJoin}</td>
              <td>${lastLeave}</td>
              <td>${dur}</td>
              <td>${(r.sessions && r.sessions.length) || 1}</td>
              <td><strong>${r.attendancePercentage || 0}%</strong></td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
      } catch (e) {
        console.error('Error generating report preview:', e);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error generating preview.</td></tr>';
      }
    },

    /**
     * Exports summary CSV
     */
    exportSummaryCSV() {
      if (currentPreviewRecords.length === 0) {
        global.MeetLedgerDashboard.showToast('No records to export.');
        return;
      }

      const recordsOnly = currentPreviewRecords.map(item => item.record);
      const csv = global.MeetLedgerExport.generateSummaryCSV(currentPreviewMeeting, recordsOnly);
      const filename = `Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      global.MeetLedgerExport.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      global.MeetLedgerDashboard.showToast('Summary CSV exported.');
    },

    /**
     * Exports detailed intervals CSV
     */
    exportDetailedCSV() {
      if (currentPreviewRecords.length === 0) {
        global.MeetLedgerDashboard.showToast('No records to export.');
        return;
      }

      const recordsOnly = currentPreviewRecords.map(item => item.record);
      const csv = global.MeetLedgerExport.generateDetailedSessionsCSV(currentPreviewMeeting, recordsOnly);
      const filename = `Attendance_Intervals_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      global.MeetLedgerExport.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      global.MeetLedgerDashboard.showToast('Detailed intervals CSV exported.');
    },

    /**
     * Exports JSON format
     */
    exportJSON() {
      if (currentPreviewRecords.length === 0) {
        global.MeetLedgerDashboard.showToast('No records to export.');
        return;
      }

      const recordsOnly = currentPreviewRecords.map(item => item.record);
      const json = global.MeetLedgerExport.generateJSON(currentPreviewMeeting, recordsOnly);
      const filename = `Attendance_Report_${new Date().toISOString().slice(0, 10)}.json`;
      global.MeetLedgerExport.downloadFile(json, filename, 'application/json');
      global.MeetLedgerDashboard.showToast('JSON report exported.');
    },

    /**
     * Opens print-friendly layout
     */
    printReport() {
      if (currentPreviewRecords.length === 0) {
        global.MeetLedgerDashboard.showToast('No records to print.');
        return;
      }

      const recordsOnly = currentPreviewRecords.map(item => item.record);
      const html = global.MeetLedgerExport.generatePrintHTML(currentPreviewMeeting, recordsOnly);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 300);
      }
    }
  };

  global.MeetLedgerReports = ReportsModule;
})(typeof window !== 'undefined' ? window : this);

