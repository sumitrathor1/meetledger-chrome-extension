/**
 * MeetLedger - Time & Duration Utilities
 * Handles timezone formatting, interval durations, session merging, and late detection
 */

(function (global) {
  'use strict';

  const MeetLedgerTimeUtils = {
    /**
     * Converts ISO timestamp or epoch to 12h or 24h local time string
     * @param {string|number|Date} dateVal
     * @param {string} [format='12h']
     * @returns {string} e.g. "10:05:20 AM"
     */
    formatTime(dateVal, format = '12h') {
      if (!dateVal) return '-';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';

      const hours24 = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      if (format === '24h') {
        return `${String(hours24).padStart(2, '0')}:${minutes}:${seconds}`;
      }

      const isPM = hours24 >= 12;
      const hours12 = hours24 % 12 || 12;
      return `${hours12}:${minutes}:${seconds} ${isPM ? 'PM' : 'AM'}`;
    },

    /**
     * Formats date to local readable format e.g. "Nov 1, 2026" or "2026-11-01"
     */
    formatDate(dateVal, format = 'YYYY-MM-DD') {
      if (!dateVal) return '-';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      if (format === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
      if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
      if (format === 'readable') {
        return d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return `${year}-${month}-${day}`;
    },

    /**
     * Formats both date and time e.g. "Nov 1, 2026, 10:05 AM"
     */
    formatDateTime(dateVal) {
      if (!dateVal) return '-';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return `${this.formatDate(d, 'readable')} ${this.formatTime(d, '12h')}`;
    },

    /**
     * Converts seconds into a human-friendly duration string
     * e.g. 3725 -> "1h 2m 5s", 145 -> "2m 25s", 45 -> "45s"
     */
    formatDuration(totalSeconds) {
      const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
      if (sec === 0) return '0s';

      const hours = Math.floor(sec / 3600);
      const minutes = Math.floor((sec % 3600) / 60);
      const seconds = sec % 60;

      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

      return parts.join(' ');
    },

    /**
     * Formats seconds into digital timer display "HH:MM:SS" or "MM:SS"
     */
    formatDigitalTimer(totalSeconds) {
      const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
      const hours = Math.floor(sec / 3600);
      const minutes = Math.floor((sec % 3600) / 60);
      const seconds = sec % 60;

      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');

      if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
      }
      return `${mm}:${ss}`;
    },

    /**
     * Computes total duration across multiple join/leave sessions.
     * Prevents overlapping intervals and includes currently active session if still present.
     * @param {Array<{joinedAt: string, leftAt: string|null, durationSeconds?: number}>} sessions
     * @param {string|number|Date} [nowTimestamp]
     * @returns {number} duration in seconds
     */
    calculateTotalSessionDuration(sessions, nowTimestamp = new Date()) {
      if (!Array.isArray(sessions) || sessions.length === 0) return 0;

      const now = new Date(nowTimestamp).getTime();
      let totalSeconds = 0;

      // Filter and normalize intervals
      const intervals = sessions
        .map(s => {
          const start = new Date(s.joinedAt).getTime();
          let end = s.leftAt ? new Date(s.leftAt).getTime() : now;
          if (isNaN(start)) return null;
          if (isNaN(end) || end < start) end = start;
          return { start, end };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

      if (intervals.length === 0) return 0;

      // Merge overlapping intervals to guarantee accurate duration without double-counting
      let merged = [];
      let current = { ...intervals[0] };

      for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];
        if (next.start <= current.end) {
          // Overlap detected: extend current boundary
          current.end = Math.max(current.end, next.end);
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);

      for (const inv of merged) {
        totalSeconds += Math.max(0, Math.round((inv.end - inv.start) / 1000));
      }

      return totalSeconds;
    },

    /**
     * Calculates percentage of attendance relative to total meeting duration
     * @param {number} attendanceSeconds
     * @param {number} meetingDurationSeconds
     * @returns {number} 0-100 rounded to 1 decimal place
     */
    calculatePercentage(attendanceSeconds, meetingDurationSeconds) {
      const att = Math.max(0, Number(attendanceSeconds) || 0);
      const meet = Math.max(0, Number(meetingDurationSeconds) || 0);
      if (meet === 0) return att > 0 ? 100 : 0;
      const pct = (att / meet) * 100;
      return Math.min(100, Math.round(pct * 10) / 10);
    },

    /**
     * Checks if participant's first join was past the late threshold
     * @param {string|Date} firstJoinedAt
     * @param {string|Date} meetingStartedAt
     * @param {number} thresholdMinutes
     */
    isLate(firstJoinedAt, meetingStartedAt, thresholdMinutes = 5) {
      if (!firstJoinedAt || !meetingStartedAt) return false;
      const joinTime = new Date(firstJoinedAt).getTime();
      const startTime = new Date(meetingStartedAt).getTime();
      if (isNaN(joinTime) || isNaN(startTime)) return false;

      const diffMinutes = (joinTime - startTime) / (1000 * 60);
      return diffMinutes > thresholdMinutes;
    },

    /**
     * Relative time ago string e.g. "3 mins ago"
     */
    timeAgo(dateVal) {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
      if (diffSec < 10) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.round(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.round(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.round(diffHour / 24);
      return `${diffDays}d ago`;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetLedgerTimeUtils;
  }
  global.MeetLedgerTimeUtils = MeetLedgerTimeUtils;
})(typeof self !== 'undefined' ? self : this);

