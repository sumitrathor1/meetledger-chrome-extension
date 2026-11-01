/**
 * MeetLedger - Attendance Engine
 * Tracks participant join/leave intervals, sums session durations without double counting,
 * and maintains real-time attendance ledger for the active Google Meet session.
 */

(function (global) {
  'use strict';

  class MeetAttendanceEngine {
    constructor() {
      this.meeting = null;
      // Map of participantKey -> AttendanceRecord
      this.attendanceMap = new Map();
      this.settings = null;
      this.isTracking = false;
      this.isPaused = false;
      this.lastScanTime = null;
      this.recentEvents = []; // Stream of recent joins/leaves for UI activity feed
    }

    /**
     * Initializes a new meeting session or resumes existing
     */
    initMeeting(meetingCode, title, settings, resumeSessionId = null) {
      this.settings = settings;
      const identity = global.MeetLedgerIdentity;
      const id = resumeSessionId || (identity ? identity.generateMeetingSessionId(meetingCode) : `meet_${meetingCode}_${Date.now()}`);

      this.meeting = {
        id: id,
        meetingCode: meetingCode,
        title: title || `Google Meet (${meetingCode})`,
        startedAt: new Date().toISOString(),
        endedAt: null,
        status: global.MeetLedgerConstants ? global.MeetLedgerConstants.MEETING_STATUS.ONGOING : 'ongoing',
        durationSeconds: 0,
        participantsCount: 0,
        presentCount: 0,
        averageAttendancePercentage: 0
      };

      this.attendanceMap.clear();
      this.recentEvents = [];
      this.isTracking = true;
      this.isPaused = false;

      this.broadcastState();
      return this.meeting;
    }

    /**
     * Handles participant joining event
     */
    handleParticipantJoined(key, parsedData, timestamp = new Date().toISOString()) {
      if (!this.isTracking || this.isPaused || !this.meeting) return;

      const timeUtils = global.MeetLedgerTimeUtils;
      const lateThreshold = (this.settings && this.settings.lateThresholdMinutes) || 5;

      let record = this.attendanceMap.get(key);

      if (!record) {
        // First time joining this meeting
        const isLate = timeUtils ? timeUtils.isLate(timestamp, this.meeting.startedAt, lateThreshold) : false;

        record = {
          id: `att_${this.meeting.id}_${key}`,
          meetingId: this.meeting.id,
          participantId: key,
          enrollment: parsedData.enrollment || '',
          name: parsedData.name || 'Anonymous',
          rawName: parsedData.raw || '',
          firstJoinedAt: timestamp,
          lastLeftAt: null,
          sessions: [
            {
              joinedAt: timestamp,
              leftAt: null,
              durationSeconds: 0
            }
          ],
          totalDurationSeconds: 0,
          attendancePercentage: 0,
          status: 'present',
          isLate: isLate
        };

        this.attendanceMap.set(key, record);

        this.addRecentEvent({
          type: 'join',
          name: record.name,
          enrollment: record.enrollment,
          timestamp: timestamp,
          isRejoin: false
        });
      } else {
        // Participant rejoining after a previous departure
        record.status = 'present';
        record.lastLeftAt = null;

        // If the last session is closed, open a new interval
        const lastSession = record.sessions[record.sessions.length - 1];
        if (lastSession && lastSession.leftAt !== null) {
          record.sessions.push({
            joinedAt: timestamp,
            leftAt: null,
            durationSeconds: 0
          });
        }

        this.addRecentEvent({
          type: 'join',
          name: record.name,
          enrollment: record.enrollment,
          timestamp: timestamp,
          isRejoin: true
        });
      }

      this.recalculateMetrics();
      this.broadcastState();
    }

    /**
     * Handles participant leaving event (confirmed past grace period)
     */
    handleParticipantLeft(key, timestamp = new Date().toISOString()) {
      if (!this.isTracking || !this.meeting) return;

      const record = this.attendanceMap.get(key);
      if (!record || record.status === 'left') return;

      const timeUtils = global.MeetLedgerTimeUtils;

      record.status = 'left';
      record.lastLeftAt = timestamp;

      // Close the current active session interval
      const lastSession = record.sessions[record.sessions.length - 1];
      if (lastSession && lastSession.leftAt === null) {
        lastSession.leftAt = timestamp;
        if (timeUtils) {
          const start = new Date(lastSession.joinedAt).getTime();
          const end = new Date(timestamp).getTime();
          lastSession.durationSeconds = Math.max(0, Math.round((end - start) / 1000));
        }
      }

      this.addRecentEvent({
        type: 'leave',
        name: record.name,
        enrollment: record.enrollment,
        timestamp: timestamp
      });

      this.recalculateMetrics();
      this.broadcastState();
    }

    /**
     * Recalculates total durations, percentages, and meeting summary metrics
     */
    recalculateMetrics() {
      if (!this.meeting) return;
      const timeUtils = global.MeetLedgerTimeUtils;
      const now = new Date();

      // Meeting duration so far
      const meetStart = new Date(this.meeting.startedAt).getTime();
      const meetEnd = this.meeting.endedAt ? new Date(this.meeting.endedAt).getTime() : now.getTime();
      this.meeting.durationSeconds = Math.max(0, Math.round((meetEnd - meetStart) / 1000));

      let presentCount = 0;
      let totalPctSum = 0;

      for (const record of this.attendanceMap.values()) {
        if (record.status === 'present') {
          presentCount++;
        }

        // Calculate accurate non-overlapping duration
        if (timeUtils) {
          record.totalDurationSeconds = timeUtils.calculateTotalSessionDuration(record.sessions, now);
          record.attendancePercentage = timeUtils.calculatePercentage(
            record.totalDurationSeconds,
            this.meeting.durationSeconds
          );
        }

        totalPctSum += record.attendancePercentage || 0;
      }

      this.meeting.participantsCount = this.attendanceMap.size;
      this.meeting.presentCount = presentCount;
      this.meeting.averageAttendancePercentage =
        this.meeting.participantsCount > 0
          ? Math.round((totalPctSum / this.meeting.participantsCount) * 10) / 10
          : 0;
    }

    /**
     * Adds an entry to the recent events stream (max 30 items)
     */
    addRecentEvent(event) {
      this.recentEvents.unshift(event);
      if (this.recentEvents.length > 30) {
        this.recentEvents.pop();
      }
    }

    /**
     * Pauses tracking
     */
    pauseTracking() {
      this.isPaused = true;
      if (this.meeting) {
        this.meeting.status = 'paused';
      }
      this.broadcastState();
    }

    /**
     * Resumes tracking
     */
    resumeTracking() {
      this.isPaused = false;
      if (this.meeting) {
        this.meeting.status = 'ongoing';
      }
      this.broadcastState();
    }

    /**
     * Stops tracking and completes meeting session
     */
    stopMeeting() {
      if (!this.meeting) return;
      this.isTracking = false;
      this.isPaused = false;
      this.meeting.endedAt = new Date().toISOString();
      this.meeting.status = 'completed';

      // Close all active sessions
      for (const record of this.attendanceMap.values()) {
        if (record.status === 'present') {
          this.handleParticipantLeft(record.participantId, this.meeting.endedAt);
        }
      }

      this.recalculateMetrics();
      this.broadcastState(true); // Final save
    }

    /**
     * Broadcasts current state to Background Service Worker and UI listeners
     */
    broadcastState(isFinal = false) {
      if (!this.meeting) return;

      const stateSnapshot = {
        meeting: { ...this.meeting },
        attendanceRecords: Array.from(this.attendanceMap.values()),
        recentEvents: [...this.recentEvents],
        isTracking: this.isTracking,
        isPaused: this.isPaused,
        lastScanTime: this.lastScanTime,
        isFinal: isFinal
      };

      // Send to background service worker
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            action: global.MeetLedgerConstants ? global.MeetLedgerConstants.MESSAGE_ACTIONS.SAVE_ATTENDANCE_SNAPSHOT : 'SAVE_ATTENDANCE_SNAPSHOT',
            payload: stateSnapshot
          }).catch(() => {
            // Service worker may be asleep, safe to ignore
          });
        } catch (e) {}
      }

      // Also dispatch DOM CustomEvent for content UI widget
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('meetledger:state_update', { detail: stateSnapshot }));
      }
    }

    /**
     * Gets state object
     */
    getState() {
      return {
        meeting: this.meeting ? { ...this.meeting } : null,
        attendanceRecords: Array.from(this.attendanceMap.values()),
        recentEvents: [...this.recentEvents],
        isTracking: this.isTracking,
        isPaused: this.isPaused,
        lastScanTime: this.lastScanTime
      };
    }
  }

  const engine = new MeetAttendanceEngine();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
  global.MeetAttendanceEngine = engine;
})(typeof self !== 'undefined' ? self : this);

