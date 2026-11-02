/**
 * MeetLedger AI - Interactive Response Builder
 * Formats database query results into structured interactive UI cards, stat grids,
 * data tables, comparisons, charts, and natural language explanations.
 */

(function (global) {
  'use strict';

  class AIResponseBuilder {
    constructor() {
      this.timeUtils = global.MeetLedgerTimeUtils;
    }

    /**
     * Builds response for Participant Meeting Count & Duration
     */
    buildParticipantSummaryResponse(queryResult, originalQuery = '') {
      if (!queryResult) {
        return {
          text: `I couldn't find any attendance records for that participant. Please verify the name or roll number.`,
          richType: null
        };
      }

      const p = queryResult.participant;
      const name = p.name || 'Participant';
      const enr = p.enrollment ? `[${p.enrollment}]` : '';
      const attended = queryResult.meetingsAttended;
      const total = queryResult.totalMeetingsConducted;
      const missed = queryResult.missedMeetings;
      const durStr = this.timeUtils ? this.timeUtils.formatDuration(queryResult.totalDurationSeconds) : `${queryResult.totalDurationSeconds}s`;
      const avgPct = queryResult.averagePercentage;
      const range = queryResult.dateRangeLabel;

      const isHindi = /\b(kitni|kitna|aaya|batao|ka|ki|ke|dikhao)\b/i.test(originalQuery);

      let text = '';
      if (isHindi) {
        text = `**${name}** ${enr} ne **${range}** me total **${attended}** meetings attend ki hain (${missed} miss hui). Total attendance time **${durStr}** hai, aur average attendance **${avgPct}%** rahi hai.`;
      } else {
        text = `**${name}** ${enr} attended **${attended}** out of **${total}** meetings conducted in **${range}** (missed ${missed}). Total duration is **${durStr}** with an average attendance rate of **${avgPct}%**.`;
      }

      return {
        text: text,
        richType: 'participant_stat_card',
        richData: {
          participantId: p.id,
          name: name,
          enrollment: p.enrollment || '',
          meetingsAttended: attended,
          totalMeetings: total,
          missedMeetings: missed,
          totalDuration: durStr,
          averagePercentage: avgPct,
          rejoinCount: queryResult.rejoinCount || 0,
          historyCount: (queryResult.history || []).length
        }
      };
    }

    /**
     * Builds response for Participant History
     */
    buildParticipantHistoryResponse(queryResult) {
      if (!queryResult || queryResult.history.length === 0) {
        return {
          text: `No meeting history found for ${queryResult?.participant?.name || 'this participant'}.`,
          richType: null
        };
      }

      const p = queryResult.participant;
      const history = queryResult.history;

      const rows = history.map((h, idx) => {
        const m = h.meeting;
        const a = h.attendance;
        const dateStr = this.timeUtils ? this.timeUtils.formatDate(m.startedAt, 'readable') : (m.startedAt || '').slice(0, 10);
        const joinStr = this.timeUtils ? this.timeUtils.formatTime(a.firstJoinedAt) : '-';
        const durStr = this.timeUtils ? this.timeUtils.formatDuration(a.totalDurationSeconds) : `${a.totalDurationSeconds}s`;

        return {
          index: idx + 1,
          meetingId: m.id,
          title: m.title || 'Meeting',
          code: m.meetingCode || '-',
          date: dateStr,
          joinedAt: joinStr,
          duration: durStr,
          sessions: (a.sessions && a.sessions.length) || 1,
          percentage: `${a.attendancePercentage || 0}%`,
          status: a.status || 'present'
        };
      });

      return {
        text: `Here is the meeting attendance history for **${p.name}** (${history.length} sessions recorded):`,
        richType: 'history_table',
        richData: {
          participantName: p.name,
          enrollment: p.enrollment || '',
          rows: rows
        }
      };
    }

    /**
     * Builds comparison between two participants
     */
    buildComparisonResponse(compResult) {
      if (!compResult || !compResult.participant1 || !compResult.participant2) {
        return {
          text: `Could not compare participants. Please ensure both participant names or roll numbers exist.`,
          richType: null
        };
      }

      const p1 = compResult.participant1;
      const p2 = compResult.participant2;

      const p1Dur = this.timeUtils ? this.timeUtils.formatDuration(p1.totalDurationSeconds) : `${p1.totalDurationSeconds}s`;
      const p2Dur = this.timeUtils ? this.timeUtils.formatDuration(p2.totalDurationSeconds) : `${p2.totalDurationSeconds}s`;

      return {
        text: `Attendance Comparison between **${p1.participant.name}** and **${p2.participant.name}** (${compResult.dateRangeLabel}):`,
        richType: 'comparison_card',
        richData: {
          p1: {
            name: p1.participant.name,
            enrollment: p1.participant.enrollment || '',
            attended: p1.meetingsAttended,
            duration: p1Dur,
            percentage: p1.averagePercentage,
            rejoins: p1.rejoinCount
          },
          p2: {
            name: p2.participant.name,
            enrollment: p2.participant.enrollment || '',
            attended: p2.meetingsAttended,
            duration: p2Dur,
            percentage: p2.averagePercentage,
            rejoins: p2.rejoinCount
          }
        }
      };
    }

    /**
     * Builds response for Low Attendance
     */
    buildLowAttendanceResponse(queryResult) {
      if (!queryResult || queryResult.lowList.length === 0) {
        return {
          text: `Great news! No participants were found with attendance below **${queryResult.thresholdPct}%** in **${queryResult.dateRangeLabel}**.`,
          richType: null
        };
      }

      const rows = queryResult.lowList.map((item, idx) => ({
        rank: idx + 1,
        id: item.participant.id,
        name: item.participant.name,
        enrollment: item.participant.enrollment || '-',
        attended: `${item.meetingsAttended} / ${item.totalMeetings}`,
        percentage: `${item.averagePercentage}%`,
        status: item.averagePercentage < 50 ? 'Critical' : 'Warning'
      }));

      return {
        text: `Found **${queryResult.lowList.length}** participant(s) with attendance below **${queryResult.thresholdPct}%** in **${queryResult.dateRangeLabel}**:`,
        richType: 'ranked_table',
        richData: {
          columns: ['Rank', 'Name', 'Roll Number', 'Meetings Attended', 'Attendance %', 'Status'],
          rows: rows
        }
      };
    }

    /**
     * Builds response for Top Attendees
     */
    buildTopAttendeesResponse(queryResult) {
      if (!queryResult || queryResult.topAttendees.length === 0) {
        return {
          text: `No attendance records available to calculate top attendees for **${queryResult.dateRangeLabel}**.`,
          richType: null
        };
      }

      const rows = queryResult.topAttendees.map((item, idx) => ({
        rank: idx + 1,
        id: item.participant.id,
        name: item.participant.name,
        enrollment: item.participant.enrollment || '-',
        attended: item.meetingsAttended,
        duration: this.timeUtils ? this.timeUtils.formatDuration(item.totalDurationSeconds) : `${item.totalDurationSeconds}s`,
        percentage: `${item.averagePercentage}%`
      }));

      return {
        text: `Here are the **Top ${queryResult.topAttendees.length} Students** by meeting attendance in **${queryResult.dateRangeLabel}**:`,
        richType: 'ranked_table',
        richData: {
          columns: ['Rank', 'Student Name', 'Roll Number', 'Meetings Attended', 'Total Duration', 'Avg %'],
          rows: rows
        }
      };
    }

    /**
     * Builds response for Late Arrivals
     */
    buildLateArrivalsResponse(queryResult) {
      if (!queryResult || queryResult.lateList.length === 0) {
        return {
          text: `No late arrivals were flagged in **${queryResult.dateRangeLabel}**. Everyone joined on time!`,
          richType: null
        };
      }

      const rows = queryResult.lateList.map((item, idx) => ({
        rank: idx + 1,
        id: item.participant.id,
        name: item.participant.name,
        enrollment: item.participant.enrollment || '-',
        lateTimes: `${item.lateCount} meeting(s)`
      }));

      return {
        text: `Identified **${queryResult.lateList.length}** student(s) who joined after the late threshold in **${queryResult.dateRangeLabel}**:`,
        richType: 'ranked_table',
        richData: {
          columns: ['#', 'Student Name', 'Roll Number', 'Times Late'],
          rows: rows
        }
      };
    }

    /**
     * Builds General Meeting Statistics
     */
    buildMeetingStatsResponse(stats) {
      if (!stats || stats.totalMeetings === 0) {
        return {
          text: `No meetings were conducted in **${stats.dateRangeLabel}**.`,
          richType: null
        };
      }

      const durStr = this.timeUtils ? this.timeUtils.formatDuration(stats.totalDurationSeconds) : `${stats.totalDurationSeconds}s`;
      const avgDurStr = this.timeUtils ? this.timeUtils.formatDuration(stats.averageDurationSeconds) : `${stats.averageDurationSeconds}s`;

      return {
        text: `Meeting Summary for **${stats.dateRangeLabel}**: A total of **${stats.totalMeetings}** meetings were conducted with **${durStr}** cumulative duration and an average attendance rate of **${stats.averageAttendancePercentage}%**.`,
        richType: 'meeting_stats_card',
        richData: {
          totalMeetings: stats.totalMeetings,
          totalDuration: durStr,
          averageDuration: avgDurStr,
          averageAttendees: stats.averageAttendees,
          averagePercentage: `${stats.averageAttendancePercentage}%`
        }
      };
    }

    /**
     * Builds Extension Help Doc Response
     */
    buildHelpResponse(articles) {
      if (!articles || articles.length === 0) {
        return {
          text: `I couldn't find a specific guide for that question. You can ask about: installing MeetLedger, tracking attendance, exporting CSV reports, configuring student roll numbers, or troubleshooting.`,
          richType: null
        };
      }

      const top = articles[0];
      return {
        text: top.content,
        richType: 'help_article',
        richData: {
          title: top.title,
          summary: top.summary,
          otherTopics: articles.slice(1, 4).map(a => a.title)
        }
      };
    }

    /**
     * Builds Ambiguous Participant Resolution
     */
    buildAmbiguousParticipantResponse(candidates) {
      return {
        text: `I found multiple participants matching that name. Please select the correct student:`,
        richType: 'ambiguous_selection',
        richData: {
          candidates: candidates.map(c => ({
            id: c.id,
            name: c.name,
            enrollment: c.enrollment || 'No Roll'
          }))
        }
      };
    }
  }

  const builder = new AIResponseBuilder();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = builder;
  }
  global.MeetLedgerAIResponseBuilder = builder;
})(typeof window !== 'undefined' ? window : this);

