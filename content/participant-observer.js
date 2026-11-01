/**
 * MeetLedger - Participant Observer Engine
 * Manages periodic scans, DOM mutation triggers, and leaves grace periods to avoid virtualization glitches.
 */

(function (global) {
  'use strict';

  class MeetParticipantObserver {
    constructor() {
      this.isObserving = false;
      this.pollIntervalMs = 3000;
      this.gracePeriodSeconds = 15;
      this.timerId = null;
      this.mutationObserver = null;

      // Map of participantKey -> { missedScans: number, lastSeen: string, data: object }
      this.absenceMap = new Map();

      // Set of keys currently considered present by the observer
      this.currentlyPresentKeys = new Set();

      // Callbacks
      this.onJoinedCallback = null;
      this.onLeftCallback = null;
      this.onScanCompleteCallback = null;

      this.settings = null;
    }

    /**
     * Updates settings (scan interval, grace period, exclusion list, enrollment pattern)
     */
    configure(settings) {
      this.settings = settings;
      if (settings.scanInterval && settings.scanInterval >= 1000) {
        this.pollIntervalMs = settings.scanInterval;
      }
      if (settings.leaveGracePeriod && settings.leaveGracePeriod >= 5) {
        this.gracePeriodSeconds = settings.leaveGracePeriod;
      }
    }

    /**
     * Starts observation loop
     */
    start({ onJoined, onLeft, onScanComplete }) {
      if (this.isObserving) return;
      this.isObserving = true;
      this.onJoinedCallback = onJoined;
      this.onLeftCallback = onLeft;
      this.onScanCompleteCallback = onScanComplete;

      // Initial immediate scan
      this.scan();

      // Setup Polling Timer
      this.timerId = setInterval(() => {
        if (this.isObserving) {
          this.scan();
        }
      }, this.pollIntervalMs);

      // Setup MutationObserver on document body to catch DOM shifts
      try {
        this.mutationObserver = new MutationObserver(() => {
          // Debounce mutation scan slightly to avoid thrashing
          if (this.isObserving && !this._mutationDebounce) {
            this._mutationDebounce = setTimeout(() => {
              this._mutationDebounce = null;
              this.scan();
            }, 800);
          }
        });

        this.mutationObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      } catch (e) {
        console.warn('[MeetLedgerObserver] MutationObserver could not attach:', e);
      }
    }

    /**
     * Pauses observation
     */
    pause() {
      this.isObserving = false;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    }

    /**
     * Resumes observation
     */
    resume() {
      if (!this.isObserving) {
        this.start({
          onJoined: this.onJoinedCallback,
          onLeft: this.onLeftCallback,
          onScanComplete: this.onScanCompleteCallback
        });
      }
    }

    /**
     * Stops observation completely
     */
    stop() {
      this.pause();
      this.absenceMap.clear();
      this.currentlyPresentKeys.clear();
    }

    /**
     * Core scan execution
     */
    scan() {
      const adapter = global.MeetDomAdapter;
      const identity = global.MeetLedgerIdentity;
      if (!adapter || !identity) return;

      const rawNames = adapter.scanVisibleParticipants();
      const currentScanTime = new Date().toISOString();
      const observedInThisScan = new Set();

      const excludedList = (this.settings && this.settings.excludedNames) || ['Sumit Rathor'];
      const pattern = this.settings && this.settings.enrollmentPattern;

      // 1. Process all participants found in this scan
      for (const raw of rawNames) {
        const parsed = identity.extractEnrollmentAndName(raw, pattern);
        if (!parsed.name && !parsed.enrollment) continue;

        // Check if excluded (Host or user exclusion)
        if (identity.isExcluded(parsed.name, raw, excludedList)) {
          continue;
        }

        const key = parsed.key;
        observedInThisScan.add(key);

        // Reset absence counter since they were seen
        if (this.absenceMap.has(key)) {
          const entry = this.absenceMap.get(key);
          entry.missedScans = 0;
          entry.lastSeen = currentScanTime;
        } else {
          this.absenceMap.set(key, {
            missedScans: 0,
            lastSeen: currentScanTime,
            data: parsed
          });
        }

        // If not currently marked as present, trigger Join event
        if (!this.currentlyPresentKeys.has(key)) {
          this.currentlyPresentKeys.add(key);
          if (this.onJoinedCallback) {
            this.onJoinedCallback(key, parsed, currentScanTime);
          }
        }
      }

      // 2. Check participants who were previously present but not seen in this scan
      // Grace period threshold in missed scan counts
      const scansPerGracePeriod = Math.max(2, Math.round((this.gracePeriodSeconds * 1000) / this.pollIntervalMs));

      for (const key of Array.from(this.currentlyPresentKeys)) {
        if (!observedInThisScan.has(key)) {
          const entry = this.absenceMap.get(key);
          if (entry) {
            entry.missedScans += 1;

            // Only mark left if absent for greater than the grace period threshold
            if (entry.missedScans >= scansPerGracePeriod) {
              this.currentlyPresentKeys.delete(key);
              if (this.onLeftCallback) {
                this.onLeftCallback(key, currentScanTime);
              }
            }
          }
        }
      }

      // 3. Dispatch scan completed notification
      if (this.onScanCompleteCallback) {
        this.onScanCompleteCallback({
          timestamp: currentScanTime,
          scannedCount: rawNames.length,
          presentCount: this.currentlyPresentKeys.size,
          isPeoplePanelOpen: adapter.isPeoplePanelOpen()
        });
      }
    }
  }

  const observer = new MeetParticipantObserver();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = observer;
  }
  global.MeetParticipantObserver = observer;
})(typeof self !== 'undefined' ? self : this);

