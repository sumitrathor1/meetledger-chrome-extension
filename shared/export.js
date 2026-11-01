/**
 * MeetLedger - Export Engine (CSV, JSON, Print Report)
 * Generates Microsoft Excel and Google Sheets compatible UTF-8 CSVs, JSON, and print-ready attendance sheets.
 */

(function (global) {
  'use strict';

  const MeetLedgerExport = {
    /**
     * Escapes CSV cells according to RFC 4180
     */
    escapeCSV(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    },

    /**
     * Generates a Summary CSV for a meeting's attendance records
     * Header: Meeting Name, Meeting Code, Meeting Date, Enrollment Number, Participant Name, First Join, Last Leave, Total Duration, Join Count, Attendance Percentage, Status
     */
    generateSummaryCSV(meeting, attendanceRecords) {
      const timeUtils = global.MeetLedgerTimeUtils;
      const headers = [
        'Meeting Name',
        'Meeting Code',
        'Meeting Date',
        'Enrollment Number',
        'Participant Name',
        'First Join Time',
        'Last Leave Time',
        'Total Duration',
        'Join Count',
        'Attendance Percentage',
        'Status'
      ];

      const rows = [headers.map(this.escapeCSV).join(',')];

      const meetName = meeting.title || 'Google Meet';
      const meetCode = meeting.meetingCode || '-';
      const meetDate = timeUtils ? timeUtils.formatDate(meeting.startedAt) : (meeting.startedAt ? meeting.startedAt.slice(0, 10) : '-');

      (attendanceRecords || []).forEach(rec => {
        const firstJoin = timeUtils ? timeUtils.formatTime(rec.firstJoinedAt) : (rec.firstJoinedAt || '-');
        const lastLeave = rec.lastLeftAt ? (timeUtils ? timeUtils.formatTime(rec.lastLeftAt) : rec.lastLeftAt) : (rec.status === 'present' ? 'Still Present' : '-');
        const duration = timeUtils ? timeUtils.formatDuration(rec.totalDurationSeconds) : `${rec.totalDurationSeconds || 0}s`;
        const joinCount = (rec.sessions && rec.sessions.length) || 1;
        const pct = `${rec.attendancePercentage || 0}%`;
        const status = (rec.status || 'present').toUpperCase();

        const row = [
          meetName,
          meetCode,
          meetDate,
          rec.enrollment || '',
          rec.name || 'Anonymous',
          firstJoin,
          lastLeave,
          duration,
          joinCount,
          pct,
          status
        ];

        rows.push(row.map(this.escapeCSV).join(','));
      });

      // UTF-8 BOM (\uFEFF) ensures Excel opens special characters correctly
      return '\uFEFF' + rows.join('\r\n');
    },

    /**
     * Generates a Detailed Sessions CSV listing each individual join/leave event
     */
    generateDetailedSessionsCSV(meeting, attendanceRecords) {
      const timeUtils = global.MeetLedgerTimeUtils;
      const headers = [
        'Meeting Name',
        'Meeting Code',
        'Meeting Date',
        'Enrollment Number',
        'Participant Name',
        'Session Number',
        'Joined At',
        'Left At',
        'Interval Duration',
        'Interval Status'
      ];

      const rows = [headers.map(this.escapeCSV).join(',')];
      const meetName = meeting.title || 'Google Meet';
      const meetCode = meeting.meetingCode || '-';
      const meetDate = timeUtils ? timeUtils.formatDate(meeting.startedAt) : (meeting.startedAt ? meeting.startedAt.slice(0, 10) : '-');

      (attendanceRecords || []).forEach(rec => {
        const sessions = rec.sessions || [
          { joinedAt: rec.firstJoinedAt, leftAt: rec.lastLeftAt, durationSeconds: rec.totalDurationSeconds }
        ];

        sessions.forEach((s, idx) => {
          const joined = timeUtils ? timeUtils.formatTime(s.joinedAt) : (s.joinedAt || '-');
          const left = s.leftAt ? (timeUtils ? timeUtils.formatTime(s.leftAt) : s.leftAt) : 'Still Present';
          const dur = timeUtils ? timeUtils.formatDuration(s.durationSeconds || 0) : `${s.durationSeconds || 0}s`;
          const status = s.leftAt ? 'COMPLETED' : 'ACTIVE';

          const row = [
            meetName,
            meetCode,
            meetDate,
            rec.enrollment || '',
            rec.name || 'Anonymous',
            idx + 1,
            joined,
            left,
            dur,
            status
          ];

          rows.push(row.map(this.escapeCSV).join(','));
        });
      });

      return '\uFEFF' + rows.join('\r\n');
    },

    /**
     * Generates a JSON representation of meeting and participant attendance
     */
    generateJSON(meeting, attendanceRecords) {
      return JSON.stringify(
        {
          meetLedgerVersion: '1.0.0',
          exportedAt: new Date().toISOString(),
          meeting,
          participantsCount: (attendanceRecords || []).length,
          attendance: attendanceRecords || []
        },
        null,
        2
      );
    },

    /**
     * Creates a print-ready HTML page
     */
    generatePrintHTML(meeting, attendanceRecords) {
      const timeUtils = global.MeetLedgerTimeUtils;
      const title = meeting.title || 'Google Meet Session';
      const date = timeUtils ? timeUtils.formatDate(meeting.startedAt, 'readable') : meeting.startedAt;
      const duration = timeUtils ? timeUtils.formatDuration(meeting.durationSeconds || 0) : `${meeting.durationSeconds || 0}s`;
      const code = meeting.meetingCode || '-';
      const total = (attendanceRecords || []).length;
      const presentNow = (attendanceRecords || []).filter(r => r.status === 'present').length;

      let tableRows = '';
      (attendanceRecords || []).forEach((r, idx) => {
        const enr = r.enrollment || '-';
        const name = r.name || 'Unknown';
        const firstJoin = timeUtils ? timeUtils.formatTime(r.firstJoinedAt) : r.firstJoinedAt;
        const lastLeave = r.lastLeftAt ? (timeUtils ? timeUtils.formatTime(r.lastLeftAt) : r.lastLeftAt) : 'Present';
        const dur = timeUtils ? timeUtils.formatDuration(r.totalDurationSeconds) : `${r.totalDurationSeconds}s`;
        const pct = `${r.attendancePercentage || 0}%`;
        const statusBadge = `<span class="badge ${r.status}">${(r.status || 'present').toUpperCase()}</span>`;

        tableRows += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${enr}</strong></td>
            <td>${name}</td>
            <td>${firstJoin}</td>
            <td>${lastLeave}</td>
            <td>${dur}</td>
            <td>${(r.sessions && r.sessions.length) || 1}</td>
            <td>${pct}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });

      return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Attendance Report - ${title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title-area h1 { font-size: 20px; margin: 0 0 5px 0; color: #0f172a; }
    .title-area p { margin: 2px 0; color: #64748b; font-size: 13px; }
    .brand { text-align: right; }
    .brand h2 { margin: 0; color: #4f46e5; font-size: 18px; font-weight: 800; }
    .brand p { margin: 2px 0 0; font-size: 11px; color: #94a3b8; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
    .meta-val { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; font-weight: 700; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
    .badge.present { background: #dcfce7; color: #15803d; }
    .badge.left { background: #f1f5f9; color: #475569; }
    .badge.late { background: #fef3c7; color: #b45309; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; page-break-inside: avoid; }
    .sign-box { border-top: 1px dashed #94a3b8; width: 220px; text-align: center; padding-top: 8px; font-size: 11px; color: #475569; }
    .notes { font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>${title}</h1>
      <p>Code: <strong>${code}</strong> &bull; Date: <strong>${date}</strong></p>
    </div>
    <div class="brand">
      <h2>MeetLedger</h2>
      <p>Official Attendance Ledger</p>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">Total Duration</span><span class="meta-val">${duration}</span></div>
    <div class="meta-item"><span class="meta-label">Total Tracked</span><span class="meta-val">${total} Participants</span></div>
    <div class="meta-item"><span class="meta-label">Currently Present</span><span class="meta-val">${presentNow}</span></div>
    <div class="meta-item"><span class="meta-label">Meeting Status</span><span class="meta-val">${(meeting.status || 'COMPLETED').toUpperCase()}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Enrollment</th>
        <th>Participant Name</th>
        <th>First Join</th>
        <th>Last Leave</th>
        <th>Duration</th>
        <th>Sessions</th>
        <th>Attendance %</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <div class="notes">Generated by MeetLedger on ${new Date().toLocaleString()}</div>
    <div class="sign-box">Teacher / Faculty Signature</div>
  </div>
</body>
</html>
      `;
    },

    /**
     * Triggers browser download for a blob/string
     */
    downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetLedgerExport;
  }
  global.MeetLedgerExport = MeetLedgerExport;
})(typeof self !== 'undefined' ? self : this);

