/**
 * MeetLedger - Shared Constants & Configurations
 */

(function (global) {
  'use strict';

  const MeetLedgerConstants = {
    APP_NAME: 'MeetLedger',
    VERSION: '1.0.0',
    AUTHOR: 'Sumit Rathor',
    GITHUB_URL: 'https://github.com/sumitrathor1/meetledger-chrome-extension',

    DEFAULT_SETTINGS: {
      hostName: 'Sumit Rathor',
      excludedNames: ['Sumit Rathor'],
      autoTrack: true,
      scanInterval: 3000, // milliseconds
      leaveGracePeriod: 15, // seconds before confirming leave
      lateThresholdMinutes: 5, // minutes after start considered late
      minAttendancePercentage: 75, // target %
      autoDetectMeetingEnd: true,
      enrollmentPattern: '^([A-Z0-9]{6,16})\\s+(.+)$',
      normalizeNames: true,
      theme: 'system', // 'light' | 'dark' | 'system'
      timezone: 'local',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '12h',
      geminiApiKey: '',
      aiModel: 'gemini-1.5-flash',
      aiMode: 'auto'
    },

    STORAGE_KEYS: {
      SETTINGS: 'meetledger_settings',
      ACTIVE_MEETINGS: 'meetledger_active_meetings',
      RECENT_ACTIVITY: 'meetledger_recent_activity',
      DB_STATS: 'meetledger_db_stats'
    },

    MESSAGE_ACTIONS: {
      MEET_DETECTED: 'MEET_DETECTED',
      START_TRACKING: 'START_TRACKING',
      PAUSE_TRACKING: 'PAUSE_TRACKING',
      RESUME_TRACKING: 'RESUME_TRACKING',
      STOP_TRACKING: 'STOP_TRACKING',
      SCAN_NOW: 'SCAN_NOW',
      GET_STATE: 'GET_STATE',
      STATE_UPDATED: 'STATE_UPDATED',
      MEETING_ENDED: 'MEETING_ENDED',
      OPEN_DASHBOARD: 'OPEN_DASHBOARD',
      OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL',
      GET_ALL_MEETINGS: 'GET_ALL_MEETINGS',
      SAVE_ATTENDANCE_SNAPSHOT: 'SAVE_ATTENDANCE_SNAPSHOT',
      PING: 'PING'
    },

    MEETING_STATUS: {
      UPCOMING: 'upcoming',
      ONGOING: 'ongoing',
      COMPLETED: 'completed',
      INTERRUPTED: 'interrupted'
    },

    ATTENDANCE_STATUS: {
      PRESENT: 'present',
      LEFT: 'left',
      LATE: 'late'
    },

    DB: {
      NAME: 'MeetLedgerDB',
      VERSION: 1,
      STORES: {
        MEETINGS: 'meetings',
        PARTICIPANTS: 'participants',
        ATTENDANCE: 'attendance',
        SESSIONS: 'sessions'
      }
    }
  };

  // Attach to environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetLedgerConstants;
  }
  global.MeetLedgerConstants = MeetLedgerConstants;
})(typeof self !== 'undefined' ? self : this);

