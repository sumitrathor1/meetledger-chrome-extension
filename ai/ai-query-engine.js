/**
 * MeetLedger AI - Secure Local Database Query Engine
 * Executes validated query plans against MeetLedgerDB without raw SQL/eval exposure.
 */

(function (global) {
  'use strict';

  class AIQueryEngine {
    constructor() {
      this._db = null;
      this._timeUtils = null;
    }

    get db() {
      return this._db || global.MeetLedgerDB;
    }

    set db(val) {
      this._db = val;
    }

    get timeUtils() {
      return this._timeUtils || global.MeetLedgerTimeUtils;
    }

    set timeUtils(val) {
      this._timeUtils = val;
    }

    /**
     * Resolves date filter string to start and end epochs
     */
    resolveDateRange(rangeKey) {
      if (!rangeKey || rangeKey === 'all_time') return null;

      const now = new Date();
      let start = new Date();
      let end = new Date();

      switch (rangeKey) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;

        case 'yesterday':
          start.setDate(now.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(now.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;

        case 'this_week': {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;
        }

        case 'last_week': {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        }

        case 'this_month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end.setHours(23, 59, 59, 999);
          break;

        case 'last_month':
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;

        case 'last_30_days':
          start.setDate(now.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;

        default:
          return null;
      }

      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        startEpoch: start.getTime(),
        endEpoch: end.getTime(),
        label: rangeKey.replace('_', ' ')
      };
    }

    /**
     * Filters list of meetings by resolved date range
     */
    filterMeetingsByDate(meetings, dateRange) {
      if (!dateRange) return meetings;
      return meetings.filter(m => {
        const time = new Date(m.startedAt).getTime();
        return time >= dateRange.startEpoch && time <= dateRange.endEpoch;
      });
    }

    /**
     * Finds participant by name, enrollment, or fuzzy string
     * Returns { exactMatch: participant|null, candidates: participant[] }
     */
    async searchParticipants(nameOrRoll) {
      if (!nameOrRoll || typeof nameOrRoll !== 'string') {
        return { exactMatch: null, candidates: [] };
      }

      const q = nameOrRoll.trim().toLowerCase();
      const allParticipants = await this.db.getAllParticipants({ limit: 1000 });

      // 1. Exact enrollment match (case-insensitive)
      const exactEnr = allParticipants.find(p => p.enrollment && p.enrollment.toLowerCase() === q);
      if (exactEnr) return { exactMatch: exactEnr, candidates: [exactEnr] };

      // 2. Exact name match
      const exactName = allParticipants.find(p => p.name && p.name.toLowerCase() === q);
      if (exactName) return { exactMatch: exactName, candidates: [exactName] };

      // 3. Candidates: Substring match in name or enrollment
      const candidates = allParticipants.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.enrollment && p.enrollment.toLowerCase().includes(q))
      );

      if (candidates.length === 1) {
        return { exactMatch: candidates[0], candidates: candidates };
      }

      return { exactMatch: null, candidates: candidates };
    }

    /**
     * Retrieves participant's meeting count and attendance history
     */
    async getParticipantAttendance(participantId, rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const participant = await this.db.getParticipant(participantId);
      if (!participant) return null;

      const rawHistory = await this.db.getParticipantHistory(participantId);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });

      // Filter meetings by date range
      const meetingsInRange = this.filterMeetingsByDate(allMeetings, dateRange);
      const totalMeetingsConducted = meetingsInRange.length;
      const meetingIdsInRange = new Set(meetingsInRange.map(m => m.id));

      const filteredHistory = rawHistory.filter(h =>
        dateRange ? meetingIdsInRange.has(h.attendance.meetingId) : true
      );

      let totalDurationSeconds = 0;
      let totalPctSum = 0;
      let rejoinCount = 0;

      filteredHistory.forEach(h => {
        totalDurationSeconds += Number(h.attendance.totalDurationSeconds || 0);
        totalPctSum += Number(h.attendance.attendancePercentage || 0);
        const sessions = h.attendance.sessions || [];
        if (sessions.length > 1) {
          rejoinCount += (sessions.length - 1);
        }
      });

      const meetingsAttended = filteredHistory.length;
      const missedMeetings = Math.max(0, totalMeetingsConducted - meetingsAttended);
      const avgPercentage = meetingsAttended > 0
        ? Math.round((totalPctSum / meetingsAttended) * 10) / 10
        : 0;

      return {
        participant,
        meetingsAttended,
        totalMeetingsConducted,
        missedMeetings,
        totalDurationSeconds,
        averagePercentage: avgPercentage,
        rejoinCount,
        history: filteredHistory,
        dateRangeLabel: dateRange ? dateRange.label : 'all time'
      };
    }

    /**
     * Compares two participants side-by-side
     */
    async compareParticipants(pId1, pId2, rangeKey = 'all_time') {
      const p1Data = await this.getParticipantAttendance(pId1, rangeKey);
      const p2Data = await this.getParticipantAttendance(pId2, rangeKey);

      if (!p1Data || !p2Data) return null;

      return {
        participant1: p1Data,
        participant2: p2Data,
        dateRangeLabel: p1Data.dateRangeLabel
      };
    }

    /**
     * Finds participants with low attendance (< thresholdPct)
     */
    async getLowAttendanceParticipants(thresholdPct = 75, rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });
      const meetingsInRange = this.filterMeetingsByDate(allMeetings, dateRange);
      const totalMeetings = meetingsInRange.length;

      const allParticipants = await this.db.getAllParticipants({ limit: 1000 });
      const lowList = [];

      for (const p of allParticipants) {
        const data = await this.getParticipantAttendance(p.id, rangeKey);
        if (data) {
          // If average percentage in attended meetings is below threshold,
          // or if they attended significantly fewer meetings than total conducted
          const overallRate = totalMeetings > 0 ? Math.round((data.meetingsAttended / totalMeetings) * 100) : data.averagePercentage;
          if (data.averagePercentage < thresholdPct || overallRate < thresholdPct) {
            lowList.push({
              participant: p,
              meetingsAttended: data.meetingsAttended,
              totalMeetings,
              missedMeetings: data.missedMeetings,
              averagePercentage: data.averagePercentage,
              overallRate
            });
          }
        }
      }

      lowList.sort((a, b) => a.averagePercentage - b.averagePercentage);
      return {
        lowList,
        thresholdPct,
        totalMeetingsConducted: totalMeetings,
        dateRangeLabel: dateRange ? dateRange.label : 'all time'
      };
    }

    /**
     * Finds top attendees ranked by meetings attended & duration
     */
    async getTopAttendees(limit = 10, rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allParticipants = await this.db.getAllParticipants({ limit: 1000 });
      const ranked = [];

      for (const p of allParticipants) {
        const data = await this.getParticipantAttendance(p.id, rangeKey);
        if (data && data.meetingsAttended > 0) {
          ranked.push({
            participant: p,
            meetingsAttended: data.meetingsAttended,
            totalDurationSeconds: data.totalDurationSeconds,
            averagePercentage: data.averagePercentage
          });
        }
      }

      ranked.sort((a, b) => {
        if (b.meetingsAttended !== a.meetingsAttended) {
          return b.meetingsAttended - a.meetingsAttended;
        }
        return b.totalDurationSeconds - a.totalDurationSeconds;
      });

      return {
        topAttendees: ranked.slice(0, limit),
        totalParticipants: allParticipants.length,
        dateRangeLabel: dateRange ? dateRange.label : 'all time'
      };
    }

    /**
     * Finds attendees who attended every meeting
     */
    async getPerfectAttendees(rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });
      const meetingsInRange = this.filterMeetingsByDate(allMeetings, dateRange);
      const totalMeetings = meetingsInRange.length;

      if (totalMeetings === 0) return { perfectAttendees: [], totalMeetings: 0 };

      const allParticipants = await this.db.getAllParticipants({ limit: 1000 });
      const perfect = [];

      for (const p of allParticipants) {
        const data = await this.getParticipantAttendance(p.id, rangeKey);
        if (data && data.meetingsAttended >= totalMeetings) {
          perfect.push({
            participant: p,
            meetingsAttended: data.meetingsAttended,
            averagePercentage: data.averagePercentage
          });
        }
      }

      return {
        perfectAttendees: perfect,
        totalMeetingsConducted: totalMeetings,
        dateRangeLabel: dateRange ? dateRange.label : 'all time'
      };
    }

    /**
     * Finds attendees who only attended 1 meeting
     */
    async getSingleAttendanceParticipants(rangeKey = 'all_time') {
      const allParticipants = await this.db.getAllParticipants({ limit: 1000 });
      const singleList = [];

      for (const p of allParticipants) {
        const data = await this.getParticipantAttendance(p.id, rangeKey);
        if (data && data.meetingsAttended === 1) {
          singleList.push({
            participant: p,
            meeting: data.history[0]?.meeting || null,
            attendance: data.history[0]?.attendance || null
          });
        }
      }

      return {
        singleAttendees: singleList,
        totalFound: singleList.length
      };
    }

    /**
     * Finds frequent late arrivals
     */
    async getLateArrivals(rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });
      const meetingsInRange = this.filterMeetingsByDate(allMeetings, dateRange);

      const lateMap = new Map(); // pId -> { participant, lateCount, records }

      for (const m of meetingsInRange) {
        const records = await this.db.getMeetingAttendance(m.id);
        for (const r of records) {
          if (r.isLate) {
            const entry = lateMap.get(r.participantId) || {
              participant: { id: r.participantId, name: r.name, enrollment: r.enrollment },
              lateCount: 0,
              meetings: []
            };
            entry.lateCount++;
            entry.meetings.push({ meeting: m, record: r });
            lateMap.set(r.participantId, entry);
          }
        }
      }

      const lateList = Array.from(lateMap.values()).sort((a, b) => b.lateCount - a.lateCount);

      return {
        lateList,
        totalLateEvents: lateList.reduce((sum, item) => sum + item.lateCount, 0),
        dateRangeLabel: dateRange ? dateRange.label : 'all time'
      };
    }

    /**
     * General Meeting Statistics in range
     */
    async getMeetingStatistics(rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });
      const meetings = this.filterMeetingsByDate(allMeetings, dateRange);

      let totalDurationSeconds = 0;
      let totalAttendeesSum = 0;
      let avgPctSum = 0;

      meetings.forEach(m => {
        totalDurationSeconds += Number(m.durationSeconds || 0);
        totalAttendeesSum += Number(m.participantsCount || 0);
        avgPctSum += Number(m.averageAttendancePercentage || 0);
      });

      const count = meetings.length;
      const averageDurationSeconds = count > 0 ? Math.round(totalDurationSeconds / count) : 0;
      const averageAttendees = count > 0 ? Math.round((totalAttendeesSum / count) * 10) / 10 : 0;
      const averageAttendancePct = count > 0 ? Math.round((avgPctSum / count) * 10) / 10 : 0;

      return {
        totalMeetings: count,
        totalDurationSeconds,
        averageDurationSeconds,
        averageAttendees,
        averageAttendancePercentage: averageAttendancePct,
        dateRangeLabel: dateRange ? dateRange.label : 'all time',
        meetings: meetings.slice(0, 10)
      };
    }

    /**
     * Finds highest and lowest meetings by attendees or duration
     */
    async getMeetingExtremes(metric = 'attendance', rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });
      const meetings = this.filterMeetingsByDate(allMeetings, dateRange);

      if (meetings.length === 0) return null;

      const sorted = [...meetings];
      if (metric === 'duration') {
        sorted.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
      } else {
        sorted.sort((a, b) => (b.participantsCount || 0) - (a.participantsCount || 0));
      }

      return {
        highest: sorted[0],
        lowest: sorted[sorted.length - 1],
        metric,
        totalMeetings: meetings.length,
        dateRangeLabel: dateRange ? dateRange.label : 'all time'
      };
    }

    /**
     * Compares two meetings side-by-side
     */
    async compareMeetings(mId1, mId2) {
      const m1 = await this.db.getMeeting(mId1);
      const m2 = await this.db.getMeeting(mId2);
      if (!m1 || !m2) return null;

      const att1 = await this.db.getMeetingAttendance(mId1);
      const att2 = await this.db.getMeetingAttendance(mId2);

      return {
        meeting1: { ...m1, attendanceRecords: att1 },
        meeting2: { ...m2, attendanceRecords: att2 }
      };
    }

    /**
     * Trends points for charts
     */
    async getAttendanceTrends(rangeKey = 'last_30_days') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({ limit: 1000 });
      const meetings = this.filterMeetingsByDate(allMeetings, dateRange);

      // Sort chronological
      meetings.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

      const labels = meetings.map(m => m.startedAt ? m.startedAt.slice(5, 10) : 'Meet');
      const attendeeCounts = meetings.map(m => m.participantsCount || 0);
      const avgPercentages = meetings.map(m => m.averageAttendancePercentage || 0);

      return {
        labels,
        attendeeCounts,
        avgPercentages,
        totalMeetings: meetings.length,
        dateRangeLabel: dateRange ? dateRange.label : 'last 30 days'
      };
    }

    /**
     * Meeting Search
     */
    async searchMeetings(query, rangeKey = 'all_time') {
      const dateRange = this.resolveDateRange(rangeKey);
      const allMeetings = await this.db.getAllMeetings({
        search: query,
        limit: 20
      });
      const filtered = this.filterMeetingsByDate(allMeetings, dateRange);
      return filtered;
    }
  }

  const engine = new AIQueryEngine();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
  global.MeetLedgerAIQueryEngine = engine;
})(typeof window !== 'undefined' ? window : this);
