# MeetLedger – Google Meet Attendance & Meeting Analytics

> **Smart Meetings. Accurate Attendance. Complete Insights.**

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Local-First](https://img.shields.io/badge/Privacy-100%25%20Local--First-emerald.svg)](PRIVACY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Owner](https://img.shields.io/badge/GitHub-sumitrathor1-indigo.svg)](https://github.com/sumitrathor1)

**MeetLedger** is a production-quality Google Chrome Extension designed for educators, professors, team leaders, and conference organizers to automatically track participant attendance during Google Meet sessions.

Unlike simple scraping scripts that only log who was present at a single moment, MeetLedger tracks **complete attendee lifecycles**—recording multiple join and leave events, summing actual non-overlapping intervals, recognizing student enrollment numbers, isolating multiple meeting sessions, and providing a modern SaaS analytics dashboard with interactive charts and CSV/JSON/Print exports.

---

## 🌟 Key Features

### 1. Advanced Multi-Session Attendance Tracking
- **Granular Interval Tracking:** Accurately records every time a participant joins, leaves, and rejoins a meeting.
- **Accurate Duration Calculation:** Sums non-overlapping session intervals (e.g. 24m 55s in Session 1 + 14m 50s in Session 2 = 39m 45s Total Attendance).
- **Anti-Virtualization Grace Engine:** Uses a configurable 15-second grace period (5 missed scans) before marking attendees as left, preventing false departures caused by Google Meet's DOM scroll virtualization.
- **Punctuality & Pacing:** Automatically calculates attendance percentage, flags late arrivals past a configurable threshold, and indicates early departures.

### 2. Student Identity & Enrollment Extraction
- **Automatic Roll Number Detection:** Detects college/university patterns (e.g., `BTMC25O1026 ASHISH SINGH RAJPUT` &rarr; Roll: `BTMC25O1026`, Name: `ASHISH SINGH RAJPUT`).
- **Flexible Pattern Matching:** Handles bracketed (`[0827CS201026]`), parenthesized (`(21BCS101)`), and custom regex rules configured via Settings.
- **Exclusion Management:** Prevents the host (default: `Sumit Rathor`) and co-hosts from being counted in attendance records.
- **Identity Merging:** Built-in tool in the dashboard to merge duplicate student identities across all historical records.

### 3. Multi-Meeting Management & Isolation
- **Unique Session Identifiers:** Generates isolated session keys (`meet_code_timestamp_hash`) so rejoining a recurring meeting link creates or resumes a distinct session.
- **Multi-Tab Support:** Tracks multiple Google Meet calls simultaneously across tabs without mixing participants.
- **Session Preservation:** Handles unexpected browser restarts, tab closures, and page refreshes gracefully using IndexedDB.

### 4. Comprehensive SaaS Analytics Dashboard
- **Overview Analytics:** Key metrics (Total Meetings, Unique Students, Total Records, Avg % Rate, Total Meeting Hours, Active Meetings).
- **Chart.js Visualizations:** Attendance history trends, completed vs active status breakdown, top attendees by duration, and attendance consistency brackets.
- **All Meetings Table:** Search, filter by status or date range, edit meeting titles, or permanently delete sessions.
- **Granular Session Modal:** Inspect exact minute-and-second join/leave breakdown for any attendee.
- **Live Meeting View:** Connects directly to ongoing calls across tabs with real-time timers and attendee status.
- **Participants Directory:** Cross-meeting student ledger displaying lifetime attendance stats and individual student histories.
- **Light & Dark Themes:** Built-in modern theme switcher with full dark mode support.

### 5. Multi-Surface UI & Companion Tools
- **In-Meeting Floating HUD:** Unobtrusive, collapsible widget on `meet.google.com` showing live attendee counts, duration timer, quick scan, and pause/resume buttons.
- **Chrome Extension Popup:** Fast glance card with present/absent counters, quick participant search, and one-click export.
- **Chrome Side Panel:** Native live side-panel companion that sits beside Google Meet showing real-time join/leave activity feeds.

### 6. Robust Export & Reporting
- **Excel & Google Sheets Compatible CSV:** Formatted with UTF-8 BOM (`\uFEFF`) and proper quoting for instant compatibility.
- **Summary & Interval CSVs:** Export consolidated totals or granular timestamped session logs.
- **JSON Export:** Full structured dataset backup.
- **Print Attendance Sheet:** Formatted print layout with teacher signature lines for institutional records.

---

## 🛠️ Technology Stack

- **Runtime:** Google Chrome Extension (Manifest V3)
- **Frontend:** Vanilla JavaScript (ES6+), Modern HTML5, CSS3 with CSS Variables
- **Storage:** Chrome Storage API (`chrome.storage.local`) & IndexedDB (`MeetLedgerDB`)
- **Data Visualization:** [Chart.js](https://www.chartjs.org/) (UMD, packaged locally)
- **Iconography:** [Lucide Icons](https://lucide.dev/) (packaged locally)
- **Testing:** Node.js Assert Test Suite (zero-dependency)

---

## 📂 Project Architecture

```
meetledger-chrome-extension/
├── manifest.json                  # Manifest V3 extension configuration
├── background/
│   └── service-worker.js          # Tab coordinator, IndexedDB sync, lifecycle manager
├── content/
│   ├── dom-adapter.js             # Multi-layer fallback selectors for Google Meet DOM
│   ├── participant-observer.js    # Polling & MutationObserver with 15s grace logic
│   ├── attendance-engine.js       # Live interval tracker & duration calculator
│   ├── meet-detector.js           # Call lifecycle & floating widget injection
│   └── content.css                # Floating HUD styles
├── popup/
│   ├── popup.html                 # Extension popup markup
│   ├── popup.css                  # Modern card styling
│   └── popup.js                   # Quick stats, scan trigger & dashboard opener
├── sidepanel/
│   ├── sidepanel.html             # Live companion sidepanel
│   ├── sidepanel.css              # Sidepanel styles
│   └── sidepanel.js               # Real-time join/leave activity feed
├── dashboard/
│   ├── dashboard.html             # Full-page SaaS analytics dashboard
│   ├── dashboard.css              # Light & Dark theme responsive styling
│   ├── dashboard.js               # SPA navigation, theme, metrics & backup
│   ├── meetings.js                # All meetings table & intervals modal
│   ├── participants.js            # Global identity directory & merge tool
│   ├── reports.js                 # Report generator & export workflows
│   └── analytics.js               # Chart.js visualization engine
├── settings/
│   ├── settings.html              # Dedicated settings page
│   ├── settings.css               # Settings styling
│   └── settings.js                # Settings controller & regex tester
├── shared/
│   ├── constants.js               # Application constants, defaults & actions
│   ├── database.js                # High-capacity IndexedDB wrapper (MeetLedgerDB)
│   ├── storage.js                 # Chrome Storage API safe wrapper
│   ├── identity.js                # Name normalization, roll extraction & exclusions
│   ├── time-utils.js              # Durations, interval summation & late detection
│   └── export.js                  # UTF-8 BOM CSV, JSON & Print HTML generator
├── assets/
│   ├── icons/                     # Crisp icons (16px, 32px, 48px, 128px, SVG)
│   └── vendor/                    # Local vendor libraries (Chart.js, Lucide)
├── tests/
│   └── test-core.js               # Automated unit test suite
├── reference/
│   └── legacy-attendance-tracker.js # Preserved reference implementation
├── README.md                      # Product documentation
├── PRIVACY.md                     # Local-first privacy policy
├── LICENSE                        # MIT License
└── package.json                   # Project scripts and local dependencies
```

---

## 🚀 Installation & Getting Started

### Load the Extension in Google Chrome

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/sumitrathor1/meetledger-chrome-extension.git
   cd meetledger-chrome-extension
   ```

2. **Open Chrome Extension Manager:**
   - In Google Chrome, navigate to `chrome://extensions/`
   - Enable **Developer mode** using the toggle switch in the top-right corner.

3. **Load Unpacked:**
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the `meetledger-chrome-extension` root folder (the folder containing `manifest.json`).

4. **Pin the Extension:**
   - Click the puzzle piece icon in Chrome's toolbar and pin **MeetLedger** for quick access.

---

## 📖 How to Use MeetLedger

1. **Join a Google Meet Session:**
   - Navigate to any Google Meet call at `https://meet.google.com/xxx-yyyy-zzz`.
   - MeetLedger automatically detects the active call and injects a floating pill in the top-left corner displaying the live attendee count and session duration.
2. **Maximize Tracking Accuracy:**
   - Google Meet renders attendees inside the **"People"** side panel.
   - For classes larger than 10 students, click the **"People"** tab in Google Meet (or click the warning button on the MeetLedger pill) to ensure all participants are visible to the DOM observer.
3. **Control Tracking:**
   - Use the floating pill, extension popup, or side panel to pause, resume, scan immediately, or stop tracking.
4. **Open the Dashboard:**
   - Click the **"Open Analytics Dashboard"** button in the popup or widget to inspect historical meetings, examine session timelines, view student consistency charts, or export attendance reports.

---

## 🧪 Testing

MeetLedger includes an automated test suite verifying manifest integrity, roll number extraction, interval summation, overlapping time merging, late arrival logic, and CSV exports:

```bash
npm test
```

Expected result:
```
=== RUNNING MEETLEDGER CORE TESTS ===
[1. Manifest Integrity]
  ✓ manifest.json is valid JSON with Manifest V3 and existing files
[2. Identity & Enrollment Extraction]
  ✓ extracts leading enrollment and name correctly
  ✓ extracts bracketed roll number correctly
  ✓ extracts parenthesized roll number correctly
  ✓ does not mistake honorifics (Dr, Prof) as enrollment numbers
  ✓ excludes host name (Sumit Rathor) case-insensitively
  ✓ generates unique meeting session IDs for the same meeting code
[3. Time Utilities & Interval Calculations]
  ✓ formats durations accurately
  ✓ calculates multi-session attendance duration correctly (Example from prompt)
  ✓ merges overlapping intervals and avoids double counting
  ✓ calculates attendance percentage accurately
  ✓ detects late arrival correctly based on threshold
[4. Export Engine]
  ✓ generates summary CSV with UTF-8 BOM and correct headers
  ✓ generates detailed intervals CSV with session breakdowns
  ✓ generates valid JSON export
=== TEST SUMMARY: 15 Passed, 0 Failed ===
```

---

## 🔒 Privacy & Local-First Commitment

MeetLedger is engineered with privacy as a foundational principle:
- **Zero Cloud Uploads:** No participant data or timestamps leave your browser.
- **No Video / Audio Access:** MeetLedger does not require or access camera, microphone, or audio feeds.
- **Local Storage Only:** Data is stored in your browser's private IndexedDB database.
- Read the full [Privacy Policy](PRIVACY.md).

---

## ⚠️ Known Limitations & Google Meet Specifics

1. **Google Meet DOM Virtualization:** When meetings exceed 50+ participants, Google Meet virtualizes the list, only rendering DOM elements for items currently inside the visible scroll container. MeetLedger combats this using an **absence grace threshold (15s)**; however, for 100+ attendees, scrolling through the People panel once ensures every student is cataloged.
2. **Tab Sleeping:** If Chrome is configured to freeze inactive tabs, keep the Google Meet tab in an active window so background scanning remains active.

---

## 🗺️ Roadmap

- [ ] Automated auto-scroll mechanism for virtualized lists in 100+ attendee calls
- [ ] Export directly to Google Sheets via Google Drive Picker API (optional OAuth)
- [ ] Customizable gradebook export templates (e.g. Moodle, Canvas, Blackboard)
- [ ] Automatic email report dispatcher for absent students

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.

**Author:** [Sumit Rathor](https://github.com/sumitrathor1)  
**Project Link:** [https://github.com/sumitrathor1/meetledger-chrome-extension](https://github.com/sumitrathor1/meetledger-chrome-extension)

