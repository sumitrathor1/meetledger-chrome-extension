/**
 * MeetLedger AI - Security & Validation Layer
 * Enforces an allowlist of permitted query plans, blocks arbitrary code/SQL injection,
 * and requires explicit user confirmation for sensitive or destructive actions.
 */

(function (global) {
  'use strict';

  const ALLOWED_INTENTS = new Set([
    'PARTICIPANT_MEETING_COUNT',
    'PARTICIPANT_DURATION',
    'PARTICIPANT_HISTORY',
    'PARTICIPANT_LAST_SEEN',
    'PARTICIPANT_REJOINS',
    'PARTICIPANT_COMPARE',
    'LOW_ATTENDANCE',
    'TOP_ATTENDEES',
    'PERFECT_ATTENDEES',
    'SINGLE_ATTENDEES',
    'LATE_ARRIVALS',
    'MEETING_COUNT',
    'MEETING_STATS',
    'MEETING_EXTREMES',
    'MEETING_TRENDS',
    'SEARCH_MEETINGS',
    'GENERATE_SUMMARY',
    'EXTENSION_HELP',
    'ACTION_NAVIGATE',
    'ACTION_DOWNLOAD_REPORT',
    'ACTION_CONFIRM_REQUIRED',
    'UNKNOWN'
  ]);

  const ALLOWED_DATE_RANGES = new Set([
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'last_30_days',
    'all_time'
  ]);

  const SENSITIVE_ACTIONS = new Set([
    'DELETE_MEETING',
    'CLEAR_ALL_DATA',
    'RESET_SETTINGS',
    'MERGE_PARTICIPANTS'
  ]);

  const AISecurity = {
    /**
     * Validates an AI-generated or locally-parsed query plan
     * @param {object} plan
     * @returns {{ valid: boolean, sanitizedPlan?: object, error?: string }}
     */
    validateQueryPlan(plan) {
      if (!plan || typeof plan !== 'object') {
        return { valid: false, error: 'Invalid query plan format: must be an object' };
      }

      if (!plan.intent || typeof plan.intent !== 'string') {
        return { valid: false, error: 'Query plan must specify an intent string' };
      }

      const intent = plan.intent.toUpperCase().trim();
      if (!ALLOWED_INTENTS.has(intent)) {
        return { valid: false, error: `Disallowed intent: "${intent}"` };
      }

      // Sanitize entities and filters
      const sanitized = {
        intent: intent,
        entities: {},
        filters: {}
      };

      if (plan.entities && typeof plan.entities === 'object') {
        for (const [k, v] of Object.entries(plan.entities)) {
          if (typeof v === 'string') {
            sanitized.entities[k] = this.sanitizeString(v);
          } else if (typeof v === 'number' || typeof v === 'boolean') {
            sanitized.entities[k] = v;
          }
        }
      }

      if (plan.filters && typeof plan.filters === 'object') {
        if (plan.filters.dateRange && typeof plan.filters.dateRange === 'string') {
          const dr = plan.filters.dateRange.toLowerCase().trim();
          sanitized.filters.dateRange = ALLOWED_DATE_RANGES.has(dr) ? dr : 'all_time';
        } else {
          sanitized.filters.dateRange = 'all_time';
        }

        if (typeof plan.filters.thresholdPct === 'number') {
          sanitized.filters.thresholdPct = Math.min(100, Math.max(0, plan.filters.thresholdPct));
        }

        if (typeof plan.filters.limit === 'number') {
          sanitized.filters.limit = Math.min(100, Math.max(1, plan.filters.limit));
        }
      } else {
        sanitized.filters.dateRange = 'all_time';
      }

      return { valid: true, sanitizedPlan: sanitized };
    },

    /**
     * Checks if an action is sensitive and requires user confirmation dialog
     */
    isSensitiveAction(actionName) {
      if (!actionName || typeof actionName !== 'string') return false;
      return SENSITIVE_ACTIONS.has(actionName.toUpperCase().trim());
    },

    /**
     * Sanitizes user input string against HTML/script injection
     */
    sanitizeString(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .trim();
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AISecurity;
  }
  global.MeetLedgerAISecurity = AISecurity;
})(typeof window !== 'undefined' ? window : this);
