/**
 * Legacy Google Meet Unique Attendance Tracker
 * Reference implementation before MeetLedger refactoring
 * 
 * Original features:
 * - Scans Google Meet participant list from DOM
 * - Normalizes participant names
 * - Extracts enrollment numbers (e.g., BTMC25O1026)
 * - Excludes host ("Sumit Rathor")
 * - Stores unique attendance records (single first-detected timestamp)
 * - Basic CSV export
 * 
 * Limitations identified for MeetLedger to overcome:
 * 1. Only records the first detected join timestamp; no tracking of leaves or multiple rejoining sessions.
 * 2. Uses fragile single CSS selectors that break when Google updates Meet UI.
 * 3. Does not calculate real attendance duration (sum of intervals).
 * 4. Stored in memory / simple storage, no multi-meeting session support or history preservation.
 * 5. Cannot handle multiple Google Meet tabs simultaneously.
 * 6. Hardcoded exclusion without flexible settings or multiple rules.
 * 7. Lacks full SaaS analytics dashboard, side panel, and participant management.
 */

(function () {
  'use strict';

  const EXCLUDED_HOST = 'Sumit Rathor';
  const ENROLLMENT_REGEX = /^([A-Z0-9]{8,15})\s+(.+)$/i;
  
  let attendanceMap = new Map();
  let meetingStartTime = new Date();
  let isTracking = false;
  let scanIntervalId = null;

  function normalizeName(name) {
    if (!name) return '';
    return name.trim().replace(/\s+/g, ' ');
  }

  function extractEnrollmentAndName(rawText) {
    const cleaned = normalizeName(rawText);
    const match = cleaned.match(ENROLLMENT_REGEX);
    if (match) {
      return {
        enrollment: match[1].toUpperCase(),
        name: match[2].trim()
      };
    }
    return {
      enrollment: '',
      name: cleaned
    };
  }

  function scanParticipants() {
    // Legacy selector: looks for participant containers in Google Meet side panel
    const participantElements = document.querySelectorAll('[data-participant-id], div[role="listitem"] span.zWGUib, div[aria-label="Participants"] [role="listitem"]');
    
    participantElements.forEach(el => {
      const rawName = el.innerText || el.textContent;
      if (!rawName) return;

      const { enrollment, name } = extractEnrollmentAndName(rawName);

      // Exclude host
      if (name.toLowerCase() === EXCLUDED_HOST.toLowerCase() || rawName.toLowerCase().includes(EXCLUDED_HOST.toLowerCase())) {
        return;
      }

      const key = enrollment || name.toLowerCase();
      if (!attendanceMap.has(key)) {
        attendanceMap.set(key, {
          enrollment: enrollment,
          name: name,
          firstDetected: new Date().toLocaleTimeString(),
          detectedTimestamp: Date.now()
        });
        console.log(`[LegacyTracker] Recorded attendance: ${enrollment ? enrollment + ' - ' : ''}${name}`);
      }
    });
  }

  function exportCSV() {
    let csv = 'Enrollment,Name,First Detected Time\n';
    attendanceMap.forEach(record => {
      const safeName = `"${record.name.replace(/"/g, '""')}"`;
      csv += `${record.enrollment},${safeName},${record.firstDetected}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Google_Meet_Attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  function startTracker() {
    if (isTracking) return;
    isTracking = true;
    console.log('[LegacyTracker] Started scanning Google Meet participants...');
    scanIntervalId = setInterval(scanParticipants, 3000);
  }

  function stopTracker() {
    isTracking = false;
    if (scanIntervalId) clearInterval(scanIntervalId);
    console.log('[LegacyTracker] Stopped tracking.');
  }

  function clearAttendance() {
    attendanceMap.clear();
    meetingStartTime = new Date();
    console.log('[LegacyTracker] Attendance cleared.');
  }

  // Exposed on window for manual console access in legacy setup
  window.MeetAttendanceLegacy = {
    start: startTracker,
    stop: stopTracker,
    scan: scanParticipants,
    exportCSV: exportCSV,
    clear: clearAttendance,
    getRecords: () => Array.from(attendanceMap.values())
  };
})();

