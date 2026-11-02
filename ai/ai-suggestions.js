/**
 * MeetLedger AI - Dynamic Smart Suggestions
 * Generates context-aware prompt suggestion pills adapting to current meeting data and conversation state.
 */

(function (global) {
  'use strict';

  const AISuggestions = {
    /**
     * Generates suggestions based on active context and metrics
     */
    async getSuggestions(context = {}, totalMeetings = 0) {
      const suggestions = [];

      // 1. Participant-specific follow-ups
      if (context && context.lastParticipant && context.lastParticipant.name) {
        const name = context.lastParticipant.name;
        suggestions.push(`Show ${name}'s attendance history`);
        suggestions.push(`When did ${name} join the last meeting?`);
        suggestions.push(`Download ${name}'s attendance report`);
        if (context.lastParticipant2 && context.lastParticipant2.name) {
          suggestions.push(`Compare ${name} and ${context.lastParticipant2.name}`);
        } else {
          suggestions.push(`Compare with another student`);
        }
        return suggestions.slice(0, 5);
      }

      // 2. Data available suggestions
      if (totalMeetings > 0) {
        suggestions.push('Who has less than 75% attendance?');
        suggestions.push('Show top 5 students by attendance');
        suggestions.push('How many meetings were conducted this month?');
        suggestions.push('Which students frequently arrive late?');
        suggestions.push('Which meeting had the highest attendance?');
        suggestions.push('Show daily attendance trends');
      } else {
        // Empty state / Getting started suggestions
        suggestions.push('How to start tracking attendance?');
        suggestions.push('How does automatic tracking work?');
        suggestions.push('How to export CSV reports?');
        suggestions.push('How to configure student roll numbers?');
        suggestions.push('How does the 15-second grace period work?');
      }

      return suggestions.slice(0, 5);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AISuggestions;
  }
  global.MeetLedgerAISuggestions = AISuggestions;
})(typeof window !== 'undefined' ? window : this);

