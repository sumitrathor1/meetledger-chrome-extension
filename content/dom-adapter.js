/**
 * MeetLedger - Google Meet DOM Adapter
 * Resilient multi-fallback selector engine for Google Meet interface
 */

(function (global) {
  'use strict';

  class MeetDomAdapter {
    constructor() {
      // Prioritized selectors for Google Meet DOM elements
      this.SELECTORS = {
        // Active call detection: buttons or containers only present when in an active call
        LEAVE_BUTTON: [
          'button[aria-label*="Leave call" i]',
          'button[data-tooltip*="Leave call" i]',
          'button[aria-label*="Leave meeting" i]',
          'button[jsname="CQylAd"]',
          'div[data-call-ended="false"]'
        ],

        // People / Participants button
        PEOPLE_BUTTON: [
          'button[aria-label*="People" i]',
          'button[aria-label*="participants" i]',
          'button[data-panel-id="1"]',
          'button[data-tooltip*="People" i]',
          'button[aria-label*="Show everyone" i]',
          'button[jsname="A5il2e"]'
        ],

        // People side panel container
        PEOPLE_PANEL: [
          'div[aria-label*="Participants" i]',
          'div[aria-label*="People" i]',
          'div[role="tabpanel"][aria-label*="People" i]',
          'div[data-tab-id="1"]',
          'div[jsname="MeAUc"]'
        ],

        // Individual participant item inside the panel
        PARTICIPANT_ITEM: [
          'div[role="listitem"]',
          'div[data-participant-id]',
          'div[data-requested-participant-id]',
          'div[jscontroller="e6S1Z"]',
          'div[jsname="tJHJj"]'
        ],

        // Participant name text element inside an item
        NAME_TEXT: [
          'span.zWGUib',
          'span.ZjFb7c',
          'span[class*="name" i]',
          'div[class*="name" i]',
          'span.YVvGBb',
          'span[aria-hidden="true"]',
          'div[jsname="WsjYwc"]'
        ],

        // Participant video tiles in the main meeting grid
        GRID_TILE_NAME: [
          'div[data-participant-id] span.notranslate',
          'div[data-self-name]',
          'div[data-requested-participant-id] span',
          'div.cS7aqe'
        ],

        // Meeting title
        MEETING_TITLE: [
          'div[data-meeting-title]',
          'div[class*="meeting-name" i]',
          'div.u6vdEc',
          'span.DPvwYc',
          'div[jsname="A13G5e"]'
        ]
      };
    }

    /**
     * Tries multiple selectors until a matching element is found
     */
    queryFirst(selectorList, context = document) {
      if (!selectorList) return null;
      const list = Array.isArray(selectorList) ? selectorList : [selectorList];
      for (const sel of list) {
        try {
          const el = context.querySelector(sel);
          if (el) return el;
        } catch (e) {
          // ignore invalid selector error
        }
      }
      return null;
    }

    /**
     * Tries multiple selectors and returns all matched elements
     */
    queryAll(selectorList, context = document) {
      if (!selectorList) return [];
      const list = Array.isArray(selectorList) ? selectorList : [selectorList];
      for (const sel of list) {
        try {
          const elements = context.querySelectorAll(sel);
          if (elements && elements.length > 0) {
            return Array.from(elements);
          }
        } catch (e) {}
      }
      return [];
    }

    /**
     * Checks if the user is inside an active Google Meet call
     */
    isCallActive() {
      // URL must match meeting code pattern meet.google.com/xxx-yyyy-zzz
      const code = this.getMeetingCode();
      if (!code) return false;

      // Check for leave call button or meeting control bar
      const leaveBtn = this.queryFirst(this.SELECTORS.LEAVE_BUTTON);
      if (leaveBtn) return true;

      // Check if people button exists (only present in active meeting)
      const peopleBtn = this.queryFirst(this.SELECTORS.PEOPLE_BUTTON);
      if (peopleBtn) return true;

      return false;
    }

    /**
     * Extracts Google Meet code from current URL (e.g. "abc-defg-hij")
     */
    getMeetingCode() {
      const pathname = window.location.pathname.replace(/^\//, '');
      const match = pathname.match(/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/i);
      if (match) return match[0].toLowerCase();

      // Check query parameter ?authuser=... or lookup
      const parts = pathname.split('/');
      for (const part of parts) {
        if (/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/i.test(part)) {
          return part.toLowerCase();
        }
      }
      return null;
    }

    /**
     * Extracts Meeting title or returns meeting code
     */
    getMeetingTitle() {
      const el = this.queryFirst(this.SELECTORS.MEETING_TITLE);
      if (el && el.textContent && el.textContent.trim()) {
        return el.textContent.trim();
      }

      // Check document title e.g. "Meet - csd-class-mon"
      if (document.title && document.title.includes(' - ')) {
        const titlePart = document.title.split(' - ')[1];
        if (titlePart && !titlePart.includes('Google Meet')) {
          return titlePart.trim();
        }
      }

      const code = this.getMeetingCode();
      return code ? `Meet (${code})` : 'Google Meet Session';
    }

    /**
     * Checks if the People/Participants sidebar is currently open
     */
    isPeoplePanelOpen() {
      const panel = this.queryFirst(this.SELECTORS.PEOPLE_PANEL);
      if (!panel) return false;
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(panel).display !== 'none';
    }

    /**
     * Clicks the People button to toggle open the participants side panel
     */
    openPeoplePanel() {
      if (this.isPeoplePanelOpen()) return true;
      const btn = this.queryFirst(this.SELECTORS.PEOPLE_BUTTON);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }

    /**
     * Scans currently visible participants across both People Panel and Grid Tiles
     * Returns an array of raw strings representing participant names
     */
    scanVisibleParticipants() {
      const names = new Set();

      // 1. Scan People panel list items if open
      const panel = this.queryFirst(this.SELECTORS.PEOPLE_PANEL);
      if (panel) {
        const items = this.queryAll(this.SELECTORS.PARTICIPANT_ITEM, panel);
        for (const item of items) {
          const nameEl = this.queryFirst(this.SELECTORS.NAME_TEXT, item);
          const raw = nameEl ? nameEl.textContent : item.textContent;
          if (raw && raw.trim()) {
            // First line of text is typically the participant name
            const firstLine = raw.trim().split('\n')[0].trim();
            if (firstLine && firstLine.length > 1) {
              names.add(firstLine);
            }
          }
        }
      }

      // 2. Also scan visible video/audio grid tiles
      const gridItems = this.queryAll(this.SELECTORS.GRID_TILE_NAME);
      for (const item of gridItems) {
        const text = item.textContent || item.getAttribute('data-self-name');
        if (text && text.trim()) {
          const firstLine = text.trim().split('\n')[0].trim();
          if (firstLine && firstLine.length > 1) {
            names.add(firstLine);
          }
        }
      }

      return Array.from(names);
    }
  }

  const adapter = new MeetDomAdapter();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adapter;
  }
  global.MeetDomAdapter = adapter;
})(typeof self !== 'undefined' ? self : this);

