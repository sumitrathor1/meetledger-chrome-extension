/**
 * MeetLedger AI - Extension Knowledge Base
 * Offline documentation library answering questions about MeetLedger's features, setup, and troubleshooting.
 */

(function (global) {
  'use strict';

  const ARTICLES = [
    {
      id: 'install',
      title: 'How to Install MeetLedger',
      keywords: ['install', 'setup', 'load unpacked', 'download', 'chrome extensions', 'developer mode', 'kare', 'kaise'],
      summary: 'Instructions for installing MeetLedger as an unpacked extension in Google Chrome.',
      content: `### Installing MeetLedger in Google Chrome

1. Open **Google Chrome** and navigate to \`chrome://extensions/\`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the \`meetledger-chrome-extension\` folder containing \`manifest.json\`.
5. Pin **MeetLedger** to your Chrome toolbar from the puzzle icon for fast access.

*Note: MeetLedger is built with Manifest V3 and runs entirely locally without needing external backend servers.*`
    },
    {
      id: 'tracking_start_stop',
      title: 'How to Start and Stop Attendance Tracking',
      keywords: ['start', 'stop', 'track', 'shuru', 'khatam', 'pause', 'resume', 'scan', 'manual'],
      summary: 'Managing attendance tracking in active Google Meet calls.',
      content: `### Starting & Stopping Tracking in Google Meet

- **Automatic Start:** When you join any Google Meet call (\`meet.google.com/xxx-yyyy-zzz\`), MeetLedger automatically detects the active call and begins tracking (if auto-track is enabled in Settings).
- **Floating In-Meeting Pill:** An unobtrusive pill appears in the top-left corner of Meet showing live attendees (\`👥 X\`) and call duration. Click it to:
  - Scan participants immediately (\`Scan Now\`).
  - Pause or Resume tracking.
  - Stop the meeting and save final attendance records.
- **Chrome Extension Popup:** Click the MeetLedger extension icon in your Chrome toolbar to pause, force scan, or export CSV on the fly.
- **Automatic End:** When you click "Leave call" in Google Meet or close the tab, MeetLedger automatically completes the session and saves records to IndexedDB.`
    },
    {
      id: 'multi_meeting',
      title: 'Multiple Meeting Management & Multi-Tab Isolation',
      keywords: ['multiple', 'multi-meeting', 'multi-tab', 'tabs', 'history', 'rejoin', 'different', 'mix', 'alag'],
      summary: 'How MeetLedger handles multiple meetings and separate sessions for recurring links.',
      content: `### Multiple Meeting Management

- **Unique Session Identifiers:** Every meeting session receives a unique ID (\`meet_<code >_<timestamp >_<hash>\`). Rejoining a recurring meeting link on a different date creates a distinct, isolated session.
- **Simultaneous Multi-Tab Support:** If you have multiple Google Meet calls open in different tabs, MeetLedger tracks each tab independently without mixing attendees.
- **Meeting Statuses:** Each session is cataloged as **Ongoing**, **Completed**, or **Interrupted** (if tab was closed unexpectedly).
- **All Meetings Table:** In the dashboard, click **All Meetings** to search, filter by date, view individual attendee intervals, or edit meeting titles.`
    },
    {
      id: 'export_reports',
      title: 'Exporting Attendance Reports (CSV, JSON, Print)',
      keywords: ['export', 'csv', 'excel', 'sheets', 'download', 'report', 'print', 'pdf', 'json', 'nikale'],
      summary: 'Exporting attendance records to Microsoft Excel, Google Sheets, JSON, and printable formats.',
      content: `### Exporting Attendance Reports

MeetLedger offers 4 flexible export formats:
1. **Summary CSV:** Generates a UTF-8 BOM CSV compatible with Microsoft Excel and Google Sheets containing:
   \`Meeting Name, Meeting Code, Meeting Date, Enrollment Number, Participant Name, First Join, Last Leave, Total Duration, Join Count, Attendance %, Status\`
2. **Detailed Session Intervals CSV:** Lists each intermediate join and leave timestamp for every attendee (e.g. Session 1: 10:05-10:30, Session 2: 10:45-11:00).
3. **JSON Export:** Full structured dataset for programmatic backups.
4. **Print Attendance Sheet:** Formatted printable view with official header and teacher/faculty signature line for institutional submission.

To export, visit **Reports & Export** in the dashboard or click **CSV** directly on the popup / in-meeting pill.`
    },
    {
      id: 'enrollment_detection',
      title: 'Enrollment & Roll Number Extraction Rules',
      keywords: ['enrollment', 'roll number', 'pattern', 'regex', 'student', 'id', 'extract', '0901', 'btmc'],
      summary: 'How student roll numbers are recognized and configured.',
      content: `### Enrollment & Student Identity Detection

MeetLedger automatically extracts university and college roll numbers:
- **Leading Roll Numbers:** \`0901CD243D04 SUMIT RATHOR\` &rarr; Roll: \`0901CD243D04\`, Name: \`SUMIT RATHOR\`
- **Alphanumeric College Codes:** \`BTMC25O1026 ASHISH SINGH\` &rarr; Roll: \`BTMC25O1026\`, Name: \`ASHISH SINGH\`
- **Bracketed / Parenthesized:** \`[0827CS201026] Jane Doe\` or \`John (21BCS101)\`
- **Custom Regex Pattern:** Go to **Settings &rarr; Identity & Enrollment** to configure your own regex pattern (e.g. \`^([A-Z0-9]{6,16})\\s+(.+)$\`) and test sample names in real time using the built-in Pattern Tester.`
    },
    {
      id: 'host_exclusion',
      title: 'Host & Participant Exclusion List',
      keywords: ['exclude', 'host', 'sumit rathor', 'ignore', 'faculty', 'teacher', 'hataye'],
      summary: 'Excluding the meeting host and administrators from student attendance.',
      content: `### Host & Participant Exclusion

- **Host Name:** By default, **Sumit Rathor** is excluded from attendance records so the host is not counted as a student.
- **Smart Student Protection:** If a participant joins with a valid student roll number (e.g. \`0901CD243D04 SUMIT RATHOR\`), MeetLedger knows they are attending as a student and will **NOT** exclude them!
- **Configurable Exclusions:** Go to **Settings &rarr; Host & Personal Settings** to add or remove names (comma-separated).`
    },
    {
      id: 'duration_calculation',
      title: 'How Attendance Duration & Intervals Are Calculated',
      keywords: ['duration', 'intervals', 'rejoin', 'calculate', 'time', 'percentage', 'grace period', 'virtualization'],
      summary: 'Accurate interval summation and anti-virtualization grace logic.',
      content: `### Accurate Interval Calculation & Anti-Virtualization

- **Interval Summation:** MeetLedger does not naively do \`lastLeave - firstJoin\`. It sums each individual session interval:
  - *Example:* Session 1 (24m 55s) + Session 2 (14m 50s) = **39m 45s Total Duration**.
- **No Double Counting:** Overlapping intervals are automatically merged.
- **15-Second Grace Period:** Google Meet virtualizes attendee lists (only rendering visible items in scroll view). If an attendee temporarily scrolls out of view, MeetLedger waits 15 seconds (5 missed scans) before marking them as left, completely preventing false departure glitches!`
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting & Tips for 100% Accuracy',
      keywords: ['troubleshoot', 'problem', 'fix', 'accuracy', 'missing', '50 participants', 'people panel', 'kam nahi'],
      summary: 'Best practices for large Google Meet classes.',
      content: `### Troubleshooting & Best Practices

1. **Keep the "People" Panel Open:** Google Meet renders all attendees in the right-side People panel. For meetings with more than 10-15 students, ensure the People panel is open (or click the warning prompt on the MeetLedger pill).
2. **Scroll Once for 100+ Attendees:** Google Meet virtualizes DOM lists exceeding 50+ students. Slowly scrolling through the People panel once catalogs every single attendee into memory.
3. **Tab Freezing:** Ensure the Google Meet tab is not discarded or frozen by Chrome memory saver during long meetings.`
    },
    {
      id: 'backup_restore',
      title: 'Data Storage, Backups & Privacy',
      keywords: ['backup', 'restore', 'storage', 'indexeddb', 'privacy', 'security', 'delete', 'safe'],
      summary: 'Local-first IndexedDB storage and full backup/restore workflows.',
      content: `### Data Storage & Privacy

- **100% Local-First:** All meeting records, participant lists, and timestamps are stored exclusively on your device inside browser **IndexedDB** (\`MeetLedgerDB\`).
- **No Cloud Uploads:** No audio, video, camera, or participant information is ever uploaded to external servers.
- **Export Backup:** Go to **Settings &rarr; Data Management** and click **Export Full JSON Backup** to download your complete database.
- **Restore Backup:** Click **Restore Backup** and select your backup \`.json\` file to migrate data between computers or browser profiles.`
    }
  ];

  const KnowledgeBase = {
    /**
     * Searches articles by query keywords and relevancy
     * @param {string} query
     * @returns {Array<object>} matching articles
     */
    search(query) {
      if (!query || typeof query !== 'string') return [];
      const q = query.toLowerCase().trim();
      const words = q.split(/\s+/).filter(w => w.length > 2);

      const scored = ARTICLES.map(art => {
        let score = 0;
        if (art.title.toLowerCase().includes(q)) score += 10;
        if (art.summary.toLowerCase().includes(q)) score += 5;

        for (const kw of art.keywords) {
          if (q.includes(kw)) score += 4;
          for (const w of words) {
            if (kw.includes(w) || w.includes(kw)) score += 2;
          }
        }

        if (art.content.toLowerCase().includes(q)) score += 3;

        return { article: art, score };
      });

      return scored
        .filter(item => item.score > 2)
        .sort((a, b) => b.score - a.score)
        .map(item => item.article);
    },

    getArticleById(id) {
      return ARTICLES.find(a => a.id === id) || null;
    },

    getAllArticles() {
      return ARTICLES;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KnowledgeBase;
  }
  global.MeetLedgerKnowledgeBase = KnowledgeBase;
})(typeof window !== 'undefined' ? window : this);

