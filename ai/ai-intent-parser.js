/**
 * MeetLedger AI - Multilingual Intent & Entity Parser
 * Understands English, Hindi, and Hinglish queries, parses relative dates,
 * extracts attendee names & roll numbers, and supports conversational follow-ups.
 */

(function (global) {
  'use strict';

  class AIIntentParser {
    /**
     * Extracts relative date range from text
     * Supports English & Hindi/Hinglish
     */
    extractDateRange(text) {
      const lower = (text || '').toLowerCase();

      if (/\b(today|aaj|aaj\s*ki)\b/i.test(lower)) return 'today';
      if (/\b(yesterday|kal|beeta\s*kal)\b/i.test(lower)) return 'yesterday';
      if (/\b(this\s*week|is\s*hafte|iss\s*week|current\s*week)\b/i.test(lower)) return 'this_week';
      if (/\b(last\s*week|pichle\s*hafte|pichhle\s*hafte|pichla\s*week|previous\s*week)\b/i.test(lower)) return 'last_week';
      if (/\b(this\s*month|is\s*mahine|iss\s*month|current\s*month)\b/i.test(lower)) return 'this_month';
      if (/\b(last\s*month|pichle\s*mahine|pichhle\s*mahine|previous\s*month)\b/i.test(lower)) return 'last_month';
      if (/\b(last\s*30\s*days|pichle\s*30\s*din|past\s*month)\b/i.test(lower)) return 'last_30_days';
      if (/\b(all\s*time|ab\s*tak\s*ka|shuru\s*se|lifetime)\b/i.test(lower)) return 'all_time';

      return null;
    }

    /**
     * Extracts percentage threshold (e.g. "75%", "75 percent", "below 60")
     */
    extractPercentageThreshold(text) {
      const match = text.match(/(\d{1,3})\s*(%|percent|pratishat)/i) ||
                    text.match(/(?:below|less than|under|kam|se kam)\s*(\d{1,3})/i);
      if (match) {
        const val = parseInt(match[1] || match[0], 10);
        if (!isNaN(val)) return Math.min(100, Math.max(0, val));
      }
      return 75; // Default threshold
    }

    /**
     * Extracts numeric limit (e.g. "top 5", "top 10")
     */
    extractLimit(text) {
      const match = text.match(/\b(?:top|first|pehle)\s*(\d+)\b/i);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 10;
    }

    /**
     * Extracts candidate participant names from query
     */
    extractCandidateNames(text) {
      if (!text) return [];

      // 1. Dual comparison pattern (e.g. "Compare Rahul and Amit" or "Rahul aur Amit ko compare karo")
      const compMatch = text.match(/\bcompare\s+([A-Za-z0-9_-]+)\s+(?:and|with|to)\s+([A-Za-z0-9_-]+)/i) ||
                        text.match(/([A-Za-z0-9_-]+)\s+aur\s+([A-Za-z0-9_-]+)\s+(?:ko\s+)?compare/i);
      if (compMatch) {
        return [compMatch[1].trim(), compMatch[2].trim()];
      }

      // 2. Look for roll number patterns containing digits (e.g. 0901CD243D04 or BTMC25O1026)
      const rollMatch = text.match(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{6,16}\b/i);
      if (rollMatch) {
        return [rollMatch[0].toUpperCase()];
      }

      // 3. Specific query phrase patterns
      // "did <Name> attend/join/leave/miss"
      const didMatch = text.match(/\bdid\s+([A-Za-z\s]+?)\s+(?:attend|miss|join|leave)/i);
      if (didMatch) {
        return [didMatch[1].trim()];
      }

      // "attended by <Name>" / "attendance of <Name>" / "history of <Name>" / "report for <Name>"
      const ofByMatch = text.match(/\b(?:attended by|attendance of|history of|report for|report of|about|find|search)\s+([A-Za-z\s]+?)(?:\.|\?|$|\s+in\s+|\s+for\s+|\s+this\s+)/i);
      if (ofByMatch) {
        return [ofByMatch[1].trim()];
      }

      // "Rahul's attendance report" / "Rahul's attendance" / "Rahul's report"
      const possessiveMatch = text.match(/\b([A-Za-z]+)(?:'s|\s+ki|\s+ka|\s+ke)\s+(?:attendance|duration|history|report|meeting)/i);
      if (possessiveMatch) {
        return [possessiveMatch[1].trim()];
      }

      // "Rahul kitni meetings me aaya" / "Rahul kitna attend kiya"
      const hindiSubjectMatch = text.match(/^([A-Za-z]+)\s+(?:kitni|kitna|kab|kaise|ko|ne)\b/i);
      if (hindiSubjectMatch) {
        return [hindiSubjectMatch[1].trim()];
      }

      // 4. Fallback: Clean known query stopwords to isolate participant name
      const stopwords = [
        'how', 'many', 'meetings', 'meeting', 'did', 'attend', 'attended', 'missed', 'miss', 'what', 'is', 'the', 'of',
        'attendance', 'duration', 'history', 'show', 'all', 'when', 'join', 'joined', 'leave', 'left', 'rejoin',
        'times', 'percentage', 'report', 'download', 'find', 'student', 'students', 'participant', 'participants', 'record',
        'records', 'kitni', 'me', 'aaya', 'aaye', 'ka', 'ki', 'ke', 'total', 'batao', 'dikhao',
        'kitna', 'kitne', 'der', 'ruka', 'kab', 'tha', 'thi', 'bar', 'hua', 'karo', 'se', 'hai', 'hain',
        'about', 'what', 'aur', 'tell', 'me', 'please', 'can', 'you', 'give', 'get'
      ];

      const words = text.split(/\s+/);
      const filtered = words.filter(w => !stopwords.includes(w.toLowerCase().replace(/[^a-z0-9_-]/gi, '')));

      if (filtered.length > 0) {
        return [filtered.join(' ').replace(/[?.,!]/g, '').trim()];
      }

      return [];
    }

    /**
     * Parses user message into a structured query plan
     * @param {string} text
     * @param {object} [context] previous conversation context
     * @returns {object} structured query plan
     */
    parse(text, context = {}) {
      if (!text || typeof text !== 'string') {
        return { intent: 'UNKNOWN', entities: {}, filters: {} };
      }

      const raw = text.trim();
      const lower = raw.toLowerCase();

      // Extract date filter (if absent in query, inherit from context if follow-up)
      const dateRange = this.extractDateRange(lower) || context.dateRange || 'all_time';
      const thresholdPct = this.extractPercentageThreshold(raw);
      const limit = this.extractLimit(raw);

      // Check for Follow-up pattern: "What about Amit?", "Aur Amit ka?"
      const followUpMatch = lower.match(/^(?:what about|aur|and)\s+([A-Za-z0-9_-]+)/i);
      if (followUpMatch) {
        const nextName = followUpMatch[1].trim();
        const prevIntent = context.lastIntent || 'PARTICIPANT_MEETING_COUNT';
        return {
          intent: prevIntent,
          entities: { participantName: nextName },
          filters: { dateRange, thresholdPct }
        };
      }

      // Check for Follow-up comparison with single name: "Compare with Amit", "Compare to Amit"
      const compWithMatch = lower.match(/\bcompare\s+(?:with|to)\s+([A-Za-z0-9_-]+)/i);
      if (compWithMatch) {
        const p2Name = compWithMatch[1].trim();
        const p1Name = context.lastParticipant ? (context.lastParticipant.name || context.lastParticipant.enrollment) : null;
        if (p1Name) {
          return {
            intent: 'PARTICIPANT_COMPARE',
            entities: { participantName: p1Name, participantName2: p2Name },
            filters: { dateRange }
          };
        }
      }

      // Check for Follow-up comparison: "Compare them", "Dono ko compare karo"
      if (/^(compare them|dono ko compare karo|compare both)/i.test(lower)) {
        if (context.lastParticipant && context.lastParticipant2) {
          return {
            intent: 'PARTICIPANT_COMPARE',
            entities: {
              participantName: context.lastParticipant.name || context.lastParticipant.enrollment,
              participantName2: context.lastParticipant2.name || context.lastParticipant2.enrollment
            },
            filters: { dateRange }
          };
        }
      }

      // 1. EXTENSION HELP QUESTIONS
      if (
        /\b(how to|how do i|kaise|install|create new meeting|export csv|backup|restore|grace period|virtualization|troubleshoot|feature|documentation|manual)\b/i.test(lower) &&
        !/\b(rahul|amit|attend|student|class)\b/i.test(lower)
      ) {
        return {
          intent: 'EXTENSION_HELP',
          entities: { query: raw },
          filters: {}
        };
      }

      // 2. PARTICIPANT HISTORY ("Show all meetings attended by Rahul", etc.)
      if (/\b(attended by|meetings attended by)\b/i.test(lower)) {
        const names = this.extractCandidateNames(raw);
        if (names.length > 0) {
          return {
            intent: 'PARTICIPANT_HISTORY',
            entities: { participantName: names[0] },
            filters: { dateRange }
          };
        }
      }

      // 3. SAFE ACTIONS & NAVIGATION
      if (/\b(open today's meeting|show my last meeting|aaj ki meeting kholo|open meeting)\b/i.test(lower)) {
        return {
          intent: 'ACTION_NAVIGATE',
          entities: { targetPage: 'live', action: 'OPEN_LATEST_MEETING' },
          filters: { dateRange: 'today' }
        };
      }

      if (/\b(open attendance reports|show reports|reports page|reports kholo)\b/i.test(lower)) {
        return {
          intent: 'ACTION_NAVIGATE',
          entities: { targetPage: 'reports' },
          filters: {}
        };
      }

      if (/\b(take me to settings|open settings|settings kholo)\b/i.test(lower)) {
        return {
          intent: 'ACTION_NAVIGATE',
          entities: { targetPage: 'settings' },
          filters: {}
        };
      }

      if (/\b(show all meetings|all meetings|sari meetings dikhao)\b/i.test(lower) && !/\b(attended|by|of|for|rahul|amit)\b/i.test(lower)) {
        return {
          intent: 'ACTION_NAVIGATE',
          entities: { targetPage: 'meetings' },
          filters: { dateRange }
        };
      }

      // 4. DOWNLOAD ATTENDANCE REPORT
      if (/\b(download|export)\b/i.test(lower) && /\b(report|csv|attendance)\b/i.test(lower)) {
        const names = this.extractCandidateNames(raw);
        if (names.length > 0) {
          return {
            intent: 'ACTION_DOWNLOAD_REPORT',
            entities: { participantName: names[0] },
            filters: { dateRange }
          };
        }
      }

      // 5. PARTICIPANT COMPARISON
      if (/\b(compare|tulna)\b/i.test(lower)) {
        const names = this.extractCandidateNames(raw);
        if (names.length >= 2) {
          return {
            intent: 'PARTICIPANT_COMPARE',
            entities: { participantName: names[0], participantName2: names[1] },
            filters: { dateRange }
          };
        }
      }

      // 6. LOW ATTENDANCE & CRITERIA
      if (/\b(less than|below|se kam|low attendance|lowest attendance|sabse kam attendance)\b/i.test(lower)) {
        return {
          intent: 'LOW_ATTENDANCE',
          entities: {},
          filters: { thresholdPct, dateRange }
        };
      }

      // 7. MEETING EXTREMES (highest/lowest/longest/shortest meeting)
      if (/\b(meeting|meetings)\b/i.test(lower) && /\b(highest|lowest|longest|shortest|max|min|sabse badi|sabse lambi)\b/i.test(lower)) {
        const metric = /\b(duration|time|longest|shortest|lambi)\b/i.test(lower) ? 'duration' : 'attendance';
        return {
          intent: 'MEETING_EXTREMES',
          entities: { metric },
          filters: { dateRange }
        };
      }

      // 8. TOP ATTENDEES (highest attendee students)
      if (/\b(highest attendance|top attendees|top students|top \d+|sabse zyada attendance|most regular)\b/i.test(lower)) {
        return {
          intent: 'TOP_ATTENDEES',
          entities: {},
          filters: { limit, dateRange }
        };
      }

      // 9. PERFECT ATTENDEES (attended all meetings)
      if (/\b(attended every meeting|every meeting|har meeting|all meetings attended|100% attendance)\b/i.test(lower)) {
        return {
          intent: 'PERFECT_ATTENDEES',
          entities: {},
          filters: { dateRange }
        };
      }

      // 10. SINGLE ATTENDEES (attended only one meeting)
      if (/\b(attended only one meeting|only one meeting|sirf ek meeting|single meeting)\b/i.test(lower)) {
        return {
          intent: 'SINGLE_ATTENDEES',
          entities: {},
          filters: { dateRange }
        };
      }

      // 11. LATE ARRIVALS
      if (/\b(late|late arrival|der se aaya|frequently late)\b/i.test(lower)) {
        return {
          intent: 'LATE_ARRIVALS',
          entities: {},
          filters: { dateRange }
        };
      }

      // 12. MEETING TRENDS
      if (/\b(trend|trends|daily trends|weekly trends|monthly trends)\b/i.test(lower)) {
        return {
          intent: 'MEETING_TRENDS',
          entities: {},
          filters: { dateRange }
        };
      }

      // 13. GENERAL MEETING STATS & SUMMARY (e.g. "attendance for last week", "total meeting duration this month")
      if (/\b(total meeting duration|total duration of meetings|how many meetings|kitni meetings|kitni meeting hui|average attendance|avg attendance|meeting summary|summarize|how many participants|attendance for|attendance in|attendance today|joined today's meeting|participants joined)\b/i.test(lower) &&
          !/\b(rahul|amit|his|her|did [a-z]+ attend)\b/i.test(lower)) {
        return {
          intent: 'MEETING_STATS',
          entities: {},
          filters: { dateRange }
        };
      }

      // 12. PARTICIPANT-SPECIFIC INTENTS
      const candidateNames = this.extractCandidateNames(raw).filter(n => !/^(his|her|their|he|she|they|it|unka|unki|inka|iske|uska|uski)$/i.test(n));
      const targetName = candidateNames[0] || (context.lastParticipant ? (context.lastParticipant.name || context.lastParticipant.enrollment) : null);

      if (targetName) {
        // Participant Rejoin Count
        if (/\b(rejoin|rejoined|kitni bar rejoin)\b/i.test(lower)) {
          return {
            intent: 'PARTICIPANT_REJOINS',
            entities: { participantName: targetName },
            filters: { dateRange }
          };
        }

        // Participant Last Seen / Join Time
        if (/\b(when did|kab aaya|last join|leave|when leave)\b/i.test(lower)) {
          return {
            intent: 'PARTICIPANT_LAST_SEEN',
            entities: { participantName: targetName },
            filters: { dateRange }
          };
        }

        // Participant Total Duration
        if (/\b(duration|total attendance|attendance time|kitni der)\b/i.test(lower)) {
          return {
            intent: 'PARTICIPANT_DURATION',
            entities: { participantName: targetName },
            filters: { dateRange }
          };
        }

        // Participant Meeting History
        if (/\b(history|all meetings|sari meetings|meeting list)\b/i.test(lower)) {
          return {
            intent: 'PARTICIPANT_HISTORY',
            entities: { participantName: targetName },
            filters: { dateRange }
          };
        }

        // Default participant query: meeting count
        return {
          intent: 'PARTICIPANT_MEETING_COUNT',
          entities: { participantName: targetName },
          filters: { dateRange }
        };
      }

      return {
        intent: 'UNKNOWN',
        entities: { query: raw },
        filters: { dateRange }
      };
    }
  }

  const parser = new AIIntentParser();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = parser;
  }
  global.MeetLedgerAIIntentParser = parser;
})(typeof window !== 'undefined' ? window : this);
