/**
 * MeetLedger AI - Provider-Independent AI Model API
 * Integrates Google Gemini API with local-first security and automatic offline hybrid fallback.
 */

(function (global) {
  'use strict';

  class AIProvider {
    constructor() {
      this.defaultModel = 'gemini-1.5-flash';
      this.timeoutMs = 12000;
    }

    /**
     * Retrieves AI settings from storage
     */
    async getSettings() {
      if (global.MeetLedgerStorage) {
        const settings = await global.MeetLedgerStorage.getSettings();
        return {
          apiKey: settings.geminiApiKey || '',
          model: settings.aiModel || this.defaultModel,
          enabled: settings.aiEnabled !== false
        };
      }
      return { apiKey: '', model: this.defaultModel, enabled: true };
    }

    /**
     * Checks if external LLM processing is available
     */
    async isExternalAIAvailable() {
      const cfg = await this.getSettings();
      return Boolean(cfg.enabled && cfg.apiKey && cfg.apiKey.trim().length > 10);
    }

    /**
     * Generates structured query plan using Gemini API (with local fallback)
     */
    async generateQueryPlan(userMessage, context = {}) {
      const isAvailable = await this.isExternalAIAvailable();
      const localParser = global.MeetLedgerAIIntentParser;

      if (!isAvailable) {
        // 100% Offline Local Rule & Regex Parser
        return localParser ? localParser.parse(userMessage, context) : { intent: 'UNKNOWN' };
      }

      const cfg = await this.getSettings();
      const prompt = `You are the intent planner for MeetLedger, a Google Meet attendance extension.
Extract user intent and parameters from the question into JSON format.

Supported intents:
- PARTICIPANT_MEETING_COUNT: "How many meetings did Rahul attend?", "Rahul kitni meetings me aaya?"
- PARTICIPANT_DURATION: "What is Rahul's total attendance duration?", "Rahul kitni der ruka"
- PARTICIPANT_HISTORY: "Show Rahul's attendance history", "Rahul ki meeting history"
- PARTICIPANT_LAST_SEEN: "When did Rahul join/leave?"
- PARTICIPANT_REJOINS: "How many times did Rahul rejoin?"
- PARTICIPANT_COMPARE: "Compare Rahul and Amit"
- LOW_ATTENDANCE: "Who has less than 75% attendance?", "75% se kam attendance kiski hai"
- TOP_ATTENDEES: "Who has the highest attendance?", "Top 10 students"
- PERFECT_ATTENDEES: "Who attended every meeting?"
- SINGLE_ATTENDEES: "Find students who attended only one meeting"
- LATE_ARRIVALS: "Which students frequently arrive late?"
- MEETING_COUNT: "How many meetings were conducted this month?"
- MEETING_STATS: "What is the average attendance?"
- MEETING_EXTREMES: "Which meeting had the highest attendance?", "Longest meeting"
- MEETING_TRENDS: "Show daily/weekly attendance trends"
- ACTION_NAVIGATE: "Open today's meeting", "Take me to settings"
- ACTION_DOWNLOAD_REPORT: "Download Rahul's attendance report"
- EXTENSION_HELP: "How to export CSV?", "How does auto tracking work?"

User Query: "${userMessage}"
Context: ${JSON.stringify(context)}

Respond ONLY with valid JSON:
{
  "intent": "INTENT_NAME",
  "entities": { "participantName": "...", "participantName2": "..." },
  "filters": { "dateRange": "today|yesterday|this_week|last_week|this_month|last_month|last_30_days|all_time", "thresholdPct": 75, "limit": 10 }
}`;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`Gemini API error: ${res.status}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return parsed;
        }
      } catch (err) {
        console.warn('[AIProvider] Gemini request failed or timed out, falling back to local NLP parser:', err.message);
      }

      // Fallback
      return localParser ? localParser.parse(userMessage, context) : { intent: 'UNKNOWN' };
    }
  }

  const provider = new AIProvider();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = provider;
  }
  global.MeetLedgerAIProvider = provider;
})(typeof window !== 'undefined' ? window : this);

