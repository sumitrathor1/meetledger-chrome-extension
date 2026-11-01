/**
 * MeetLedger - Chrome Storage API Wrapper
 * Manages user preferences, active multi-tab meeting sessions, and fast state caching
 */

(function (global) {
  'use strict';

  const MeetLedgerStorage = {
    /**
     * Safe wrapper for chrome.storage.local.get
     */
    async get(key) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get(key, (items) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn('[MeetLedgerStorage] Storage get error:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(key ? items[key] : items);
            }
          });
        });
      }

      // Fallback for tests or standard browser
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Safe wrapper for chrome.storage.local.set
     */
    async set(items) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.set(items, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn('[MeetLedgerStorage] Storage set error:', chrome.runtime.lastError);
            }
            resolve(true);
          });
        });
      }

      // Fallback
      try {
        Object.keys(items).forEach(k => {
          localStorage.setItem(k, JSON.stringify(items[k]));
        });
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Retrieves current user settings, defaulting to MeetLedgerConstants.DEFAULT_SETTINGS
     */
    async getSettings() {
      const constants = global.MeetLedgerConstants || {};
      const defaults = constants.DEFAULT_SETTINGS || {};
      const key = (constants.STORAGE_KEYS && constants.STORAGE_KEYS.SETTINGS) || 'meetledger_settings';

      const stored = await this.get(key);
      return { ...defaults, ...(stored || {}) };
    },

    /**
     * Updates user settings
     */
    async saveSettings(updates) {
      const current = await this.getSettings();
      const merged = { ...current, ...updates };
      const constants = global.MeetLedgerConstants || {};
      const key = (constants.STORAGE_KEYS && constants.STORAGE_KEYS.SETTINGS) || 'meetledger_settings';
      await this.set({ [key]: merged });
      return merged;
    },

    /**
     * Retrieves all ongoing active meeting sessions (multi-tab support)
     */
    async getActiveMeetings() {
      const constants = global.MeetLedgerConstants || {};
      const key = (constants.STORAGE_KEYS && constants.STORAGE_KEYS.ACTIVE_MEETINGS) || 'meetledger_active_meetings';
      const map = await this.get(key);
      return map || {};
    },

    /**
     * Updates an active meeting for a specific tabId
     */
    async setActiveMeeting(tabId, meetingState) {
      const activeMap = await this.getActiveMeetings();
      activeMap[tabId] = {
        ...meetingState,
        lastHeartbeat: new Date().toISOString()
      };
      const constants = global.MeetLedgerConstants || {};
      const key = (constants.STORAGE_KEYS && constants.STORAGE_KEYS.ACTIVE_MEETINGS) || 'meetledger_active_meetings';
      await this.set({ [key]: activeMap });
    },

    /**
     * Removes an active meeting session when a tab closes or meeting ends
     */
    async removeActiveMeeting(tabId) {
      const activeMap = await this.getActiveMeetings();
      if (activeMap[tabId]) {
        delete activeMap[tabId];
        const constants = global.MeetLedgerConstants || {};
        const key = (constants.STORAGE_KEYS && constants.STORAGE_KEYS.ACTIVE_MEETINGS) || 'meetledger_active_meetings';
        await this.set({ [key]: activeMap });
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetLedgerStorage;
  }
  global.MeetLedgerStorage = MeetLedgerStorage;
})(typeof self !== 'undefined' ? self : this);

