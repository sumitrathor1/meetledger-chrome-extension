/**
 * MeetLedger - Participant Identity & Enrollment Number Engine
 * Normalizes names, extracts student roll/enrollment numbers, handles exclusions and identity keys
 */

(function (global) {
  'use strict';

  const MeetLedgerIdentity = {
    /**
     * Cleans and normalizes participant name strings
     * Removes Meet annotations like "(You)", "(Presentation)", extra spaces
     */
    normalizeName(rawName) {
      if (!rawName || typeof rawName !== 'string') return '';

      let cleaned = rawName
        // Strip Google Meet system indicators
        .replace(/\(You\)/gi, '')
        .replace(/\(Presentation\)/gi, '')
        .replace(/\(Presenting\)/gi, '')
        .replace(/\(External\)/gi, '')
        .replace(/\(Host\)/gi, '')
        .replace(/\(Meeting host\)/gi, '')
        .replace(/\(Co-host\)/gi, '')
        // Replace non-breaking spaces and redundant whitespaces
        .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
        .replace(/\s+/g, ' ')
        // Remove trailing ellipsis if text was truncated in UI
        .replace(/\.{2,}$|…$/g, '')
        .trim();

      return cleaned;
    },

    /**
     * Validates whether a candidate string looks like a legitimate enrollment / roll number.
     * Prevents common honorifics (DR, MR, MS, PROF, TEAM, CLASS) from being extracted as roll numbers.
     */
    isValidEnrollmentCandidate(candidate) {
      if (!candidate || candidate.length < 5 || candidate.length > 20) return false;
      const upper = candidate.toUpperCase();

      // Blacklist non-enrollment prefixes
      const forbidden = ['DOCTOR', 'PROFESSOR', 'ORGANIZER', 'PRESENTER', 'FACULTY', 'HOST'];
      if (forbidden.includes(upper)) return false;

      // Real enrollment/roll numbers almost universally contain at least 1-2 digits
      const hasDigit = /\d/.test(candidate);
      const isAlphaNumeric = /^[A-Z0-9_-]+$/i.test(candidate);

      return isAlphaNumeric && hasDigit;
    },

    /**
     * Extracts enrollment number and clean student name from raw text
     * Supports user-defined regex and robust multi-pattern fallbacks
     * 
     * @param {string} rawText e.g. "BTMC25O1026 ASHISH SINGH RAJPUT"
     * @param {string} [customPattern]
     * @returns {{ enrollment: string, name: string, raw: string, key: string }}
     */
    extractEnrollmentAndName(rawText, customPattern) {
      const cleaned = this.normalizeName(rawText);
      if (!cleaned) {
        return { enrollment: '', name: '', raw: rawText, key: '' };
      }

      let enrollment = '';
      let name = cleaned;

      // 1. Try custom regex pattern if provided
      if (customPattern) {
        try {
          const regex = new RegExp(customPattern, 'i');
          const match = cleaned.match(regex);
          if (match && match.length >= 3) {
            const cand = match[1].trim();
            if (this.isValidEnrollmentCandidate(cand)) {
              enrollment = cand.toUpperCase();
              name = this.normalizeName(match[2]);
            }
          }
        } catch (e) {
          console.warn('[MeetLedgerIdentity] Invalid custom enrollment regex:', e);
        }
      }

      // 2. Built-in Pattern 1: Leading Enrollment e.g. "BTMC25O1026 ASHISH SINGH RAJPUT" or "0827CS201026 John"
      if (!enrollment) {
        const leadingMatch = cleaned.match(/^([A-Z0-9_-]{5,20})\s*[-:]?\s+(.+)$/i);
        if (leadingMatch) {
          const candidate = leadingMatch[1].trim();
          if (this.isValidEnrollmentCandidate(candidate)) {
            enrollment = candidate.toUpperCase();
            name = this.normalizeName(leadingMatch[2]);
          }
        }
      }

      // 3. Built-in Pattern 2: Parentheses / Brackets e.g. "Ashish Singh (BTMC25O1026)" or "Ashish [BTMC25O1026]"
      if (!enrollment) {
        const bracketMatch = cleaned.match(/^(.+?)\s*[([<]([A-Z0-9_-]{5,20})[)\]>]$/i);
        if (bracketMatch) {
          const candidate = bracketMatch[2].trim();
          if (this.isValidEnrollmentCandidate(candidate)) {
            enrollment = candidate.toUpperCase();
            name = this.normalizeName(bracketMatch[1]);
          }
        }
      }

      // 4. Built-in Pattern 3: Inverted brackets e.g. "[BTMC25O1026] Ashish Singh"
      if (!enrollment) {
        const invertBracketMatch = cleaned.match(/^[([<]([A-Z0-9_-]{5,20})[)\]>]\s*[-:]?\s*(.+)$/i);
        if (invertBracketMatch) {
          const candidate = invertBracketMatch[1].trim();
          if (this.isValidEnrollmentCandidate(candidate)) {
            enrollment = candidate.toUpperCase();
            name = this.normalizeName(invertBracketMatch[2]);
          }
        }
      }

      const key = this.getParticipantIdentityKey(enrollment, name);

      return {
        enrollment,
        name,
        raw: rawText,
        key
      };
    },

    /**
     * Generates a stable unique identity key.
     * Prefers enrollment number. If absent, falls back to normalized lowercase name.
     */
    getParticipantIdentityKey(enrollment, name) {
      if (enrollment && enrollment.trim()) {
        return `enr:${enrollment.trim().toUpperCase()}`;
      }
      const safeName = (name || '').trim().toLowerCase().replace(/\s+/g, '_');
      return `name:${safeName || 'unknown'}`;
    },

    /**
     * Checks if a string is Google Meet UI noise (buttons, icons, section headers)
     * e.g. "devices", "add people", "in call", "more_vert"
     */
    isUINoise(rawText) {
      if (!rawText || typeof rawText !== 'string') return true;
      const cleaned = this.normalizeName(rawText).toLowerCase().trim();
      if (cleaned.length < 2) return true;

      const NOISE_WORDS = new Set([
        'devices',
        'device',
        'other devices',
        'companion devices',
        'audio devices',
        'phone audio',
        'add people',
        'in call',
        'in this call',
        'contributors',
        'meeting host',
        'host',
        'co-host',
        'host controls',
        'search for people',
        'search',
        'more options',
        'mute all',
        'pin',
        'unpin',
        'more_vert',
        'mic',
        'mic_off',
        'videocam',
        'videocam_off',
        'volume_up',
        'phone',
        'hand_raise',
        'meeting details',
        'details',
        'chat',
        'activities',
        'info',
        'everyone',
        'presentation',
        'you'
      ]);

      if (NOISE_WORDS.has(cleaned)) return true;

      // Reject common material symbol icon names (single words without spaces that match icon verbs)
      if (/^(more_vert|mic|mic_off|videocam|videocam_off|pin|unpin|volume_up|phone|devices|hand_raise)$/i.test(cleaned)) {
        return true;
      }

      return false;
    },

    /**
     * Checks if a participant name or raw text should be excluded from attendance
     * Checks user's exclusion list (e.g. "Sumit Rathor") case-insensitively.
     * If the attendee has an enrollment number (e.g. 0901CD243D04 SUMIT RATHOR),
     * they are a student attending the class and are NOT excluded as host!
     * 
     * @param {string} name
     * @param {string} rawText
     * @param {string[]} excludedList
     * @param {boolean} [hasEnrollment=false]
     * @returns {boolean}
     */
    isExcluded(name, rawText, excludedList = ['Sumit Rathor'], hasEnrollment = false) {
      if (!Array.isArray(excludedList)) {
        excludedList = [excludedList].filter(Boolean);
      }

      const n = (name || '').trim().toLowerCase();
      const r = (rawText || '').trim().toLowerCase();

      // If attendee has a student enrollment number, they are a student to be tracked!
      // They are only excluded if their enrollment or exact raw string was explicitly added to excludedList.
      if (hasEnrollment) {
        for (const ex of excludedList) {
          const target = (ex || '').trim().toLowerCase();
          if (!target) continue;
          if (r === target) return true;
        }
        return false;
      }

      // Check against exclusion list for non-enrollment attendees
      for (const ex of excludedList) {
        const target = (ex || '').trim().toLowerCase();
        if (!target) continue;

        // Exact match on normalized student name (e.g. "Sumit Rathor")
        if (n === target) return true;

        // Exact match on raw string after removing Google Meet indicators (e.g. "Sumit Rathor (You)")
        const cleanRaw = this.normalizeName(r).toLowerCase();
        if (cleanRaw === target) return true;
      }

      return false;
    },

    /**
     * Generates a unique RFC4122-compliant UUID
     */
    generateUUID() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    /**
     * Generates a unique meeting session ID ensuring the same meeting code on different dates
     * or different tabs produces a unique session record.
     * Format: meet_abc-defg-hij_1730489999_a1b2
     */
    generateMeetingSessionId(meetingCode) {
      const cleanCode = (meetingCode || 'unknown').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
      const timestamp = Date.now();
      const rand = Math.random().toString(36).substring(2, 6);
      return `meet_${cleanCode}_${timestamp}_${rand}`;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetLedgerIdentity;
  }
  global.MeetLedgerIdentity = MeetLedgerIdentity;
})(typeof self !== 'undefined' ? self : this);

