/**
 * MeetLedger - Dashboard Analytics & Chart.js Engine
 * Visualizes attendance volume, duration trends, late arrivals, and consistency distributions.
 */

(function (global) {
  'use strict';

  let charts = {};

  function destroyChart(id) {
    if (charts[id]) {
      try {
        charts[id].destroy();
      } catch (e) {}
      delete charts[id];
    }
  }

  const AnalyticsModule = {
    /**
     * Initializes and renders overview page charts
     */
    async renderOverviewCharts() {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js library is not loaded');
        return;
      }

      const meetings = await global.MeetLedgerDB.getAllMeetings({ limit: 15 });
      const participants = await global.MeetLedgerDB.getAllParticipants({ limit: 10 });

      this.renderAttendanceHistoryChart(meetings);
      this.renderStatusPieChart(meetings);
      this.renderTopStudentsChart(participants);
    },

    /**
     * 1. Meeting Attendance History (Line/Bar Chart)
     */
    renderAttendanceHistoryChart(meetings) {
      const canvas = document.getElementById('chart-attendance-history');
      if (!canvas) return;

      destroyChart('attendance-history');

      if (!meetings || meetings.length === 0) {
        this.renderEmptyChart(canvas, 'No meeting history yet');
        return;
      }

      // Reverse to chronological order
      const chron = [...meetings].reverse();
      const labels = chron.map(m => (m.title ? m.title.slice(0, 15) : m.meetingCode));
      const participantCounts = chron.map(m => m.participantsCount || 0);

      const ctx = canvas.getContext('2d');
      charts['attendance-history'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Participants Tracked',
              data: participantCounts,
              borderColor: '#4f46e5',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#4f46e5',
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      });
    },

    /**
     * 2. Status Distribution (Doughnut Chart)
     */
    async renderStatusPieChart(meetings) {
      const canvas = document.getElementById('chart-status-pie');
      if (!canvas) return;

      destroyChart('status-pie');

      if (!meetings || meetings.length === 0) {
        this.renderEmptyChart(canvas, 'No records');
        return;
      }

      // Sum present vs left from recent meeting
      let presentTotal = 0;
      let leftTotal = 0;

      for (const m of meetings.slice(0, 5)) {
        const att = await global.MeetLedgerDB.getMeetingAttendance(m.id);
        att.forEach(r => {
          if (r.status === 'present') presentTotal++;
          else leftTotal++;
        });
      }

      if (presentTotal === 0 && leftTotal === 0) {
        presentTotal = 1; // placeholder
      }

      const ctx = canvas.getContext('2d');
      charts['status-pie'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Completed Sessions', 'Currently Active'],
          datasets: [
            {
              data: [leftTotal, presentTotal],
              backgroundColor: ['#6366f1', '#10b981'],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          cutout: '70%'
        }
      });
    },

    /**
     * 3. Top Students Chart (Horizontal Bar Chart)
     */
    async renderTopStudentsChart(participants) {
      const canvas = document.getElementById('chart-top-students');
      if (!canvas) return;

      destroyChart('top-students');

      if (!participants || participants.length === 0) {
        this.renderEmptyChart(canvas, 'No participants yet');
        return;
      }

      const top5 = participants.slice(0, 5);
      const labels = top5.map(p => (p.enrollment ? p.enrollment : (p.name || 'Anonymous')));
      const attendedCounts = top5.map(p => p.totalMeetingsAttended || 1);

      const ctx = canvas.getContext('2d');
      charts['top-students'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Meetings Attended',
              data: attendedCounts,
              backgroundColor: '#8b5cf6',
              borderRadius: 6
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      });
    },

    /**
     * 4. Renders Dedicated Analytics Page Charts
     */
    async renderAdvancedAnalytics() {
      if (typeof Chart === 'undefined') return;

      const meetings = await global.MeetLedgerDB.getAllMeetings({ limit: 30 });

      // Volume Chart
      const volCanvas = document.getElementById('chart-analytics-volume');
      if (volCanvas) {
        destroyChart('analytics-volume');
        const chron = [...meetings].reverse();
        const labels = chron.map(m => m.startedAt ? m.startedAt.slice(5, 10) : 'Day');
        const data = chron.map(m => m.participantsCount || 0);

        charts['analytics-volume'] = new Chart(volCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Attendees',
                data: data,
                backgroundColor: '#3b82f6',
                borderRadius: 4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
          }
        });
      }

      // Late Arrival Chart
      const lateCanvas = document.getElementById('chart-analytics-late');
      if (lateCanvas) {
        destroyChart('analytics-late');
        let onTime = 0;
        let late = 0;

        for (const m of meetings.slice(0, 10)) {
          const records = await global.MeetLedgerDB.getMeetingAttendance(m.id);
          records.forEach(r => {
            if (r.isLate) late++;
            else onTime++;
          });
        }

        if (onTime === 0 && late === 0) onTime = 1;

        charts['analytics-late'] = new Chart(lateCanvas.getContext('2d'), {
          type: 'pie',
          data: {
            labels: ['On-Time Joiners', 'Late Arrivals'],
            datasets: [
              {
                data: [onTime, late],
                backgroundColor: ['#10b981', '#f59e0b'],
                borderWidth: 0
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
          }
        });
      }

      // Attendance Consistency Brackets
      const consistCanvas = document.getElementById('chart-analytics-consistency');
      if (consistCanvas) {
        destroyChart('analytics-consistency');
        let high = 0; // >= 75%
        let mid = 0;  // 50 - 74%
        let low = 0;  // < 50%

        for (const m of meetings.slice(0, 10)) {
          const records = await global.MeetLedgerDB.getMeetingAttendance(m.id);
          records.forEach(r => {
            const pct = r.attendancePercentage || 0;
            if (pct >= 75) high++;
            else if (pct >= 50) mid++;
            else low++;
          });
        }

        charts['analytics-consistency'] = new Chart(consistCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['High (75% - 100%)', 'Medium (50% - 74%)', 'Low (< 50%)'],
            datasets: [
              {
                label: 'Student Sessions',
                data: [high, mid, low],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
          }
        });
      }
    },

    renderEmptyChart(canvas, text) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  };

  global.MeetLedgerAnalytics = AnalyticsModule;
})(typeof window !== 'undefined' ? window : this);

