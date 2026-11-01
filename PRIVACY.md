# Privacy Policy for MeetLedger

**Effective Date:** November 1, 2026  
**Extension Name:** MeetLedger – Google Meet Attendance & Meeting Analytics  
**Developer:** Sumit Rathor ([GitHub Profile](https://github.com/sumitrathor1))  
**Repository:** [meetledger-chrome-extension](https://github.com/sumitrathor1/meetledger-chrome-extension)

---

## 1. Overview & Commitment to Privacy

MeetLedger was designed with a strict **Local-First, Zero-Telemetry** privacy model. We believe user data belongs exclusively to the user. MeetLedger does not operate external backends, cloud databases, or remote telemetry servers.

All meeting detection, attendance tracking, calculations, analytics charts, and data exports occur 100% locally within your Google Chrome browser.

---

## 2. Permissions & Data Access

MeetLedger requests the minimum set of permissions necessary to deliver automated attendance tracking for Google Meet:

| Permission | Purpose |
| :--- | :--- |
| `storage` | Stores user configuration settings and cached active session state locally in the browser (`chrome.storage.local`). |
| `tabs` | Detects Google Meet tabs (`https://meet.google.com/*`) to coordinate multi-tab attendance tracking and safe session closure. |
| `sidePanel` | Enables the live attendance companion interface in the Chrome side panel during Google Meet calls. |
| `host_permissions` (`https://meet.google.com/*`) | Allows the content script to observe participant names rendered in the standard Google Meet interface. |

### Permissions We Explicitly DO NOT Request:
- ❌ **No Audio Access:** MeetLedger never records, intercepts, or listens to audio.
- ❌ **No Video or Screen Recording Access:** MeetLedger cannot capture or record meeting video or shared screens.
- ❌ **No Microphone or Camera Access:** We do not request or use audio/video input devices.
- ❌ **No Broad Host Permissions:** Access is strictly confined to `https://meet.google.com/*`.

---

## 3. Information Collected & Processed Locally

MeetLedger only reads text information that is already visible to the user in the Google Meet user interface:

1. **Participant Names & Identifiers:** As rendered in the Google Meet participant ("People") side panel or video tiles.
2. **Student Roll / Enrollment Numbers:** Extracted from student display names when adhering to educational formatting (e.g. `BTMC25O1026 ASHISH SINGH`).
3. **Session Timestamps:** Local timestamps recorded when a participant joins or leaves the call.
4. **Meeting Metadata:** Meeting title and meeting code (e.g. `abc-defg-hij`) as displayed in Google Meet.

---

## 4. Where and How Data Is Stored

- **Browser IndexedDB (`MeetLedgerDB`):** Meeting histories, participant ledgers, and attendance intervals are stored persistently on your device in the browser's IndexedDB database.
- **Chrome Storage API (`chrome.storage.local`):** Extension settings, theme preferences, and exclusion lists are stored locally.
- **No Remote Servers:** Attendance records are never transmitted over the internet to third parties or remote endpoints.

---

## 5. User Control & Data Retention

You maintain complete control over all data recorded by MeetLedger:

- **Export Your Data:** You can export attendance records anytime as Microsoft Excel and Google Sheets compatible UTF-8 CSVs, JSON, or printable PDF sheets.
- **Full Backup & Restore:** Export a complete JSON backup of the database from the Settings page and restore it across devices or browser profiles.
- **Edit & Correct Records:** You can edit participant names, correct enrollment numbers, or merge duplicate student identities.
- **Delete Records:** Delete individual meetings, remove specific attendees, or permanently erase the entire database using the "Clear All Records" option in Settings.
- **Uninstalling:** Removing the extension from Chrome removes all local extension storage and IndexedDB databases created by MeetLedger.

---

## 6. Children's Privacy

Because MeetLedger is used in academic classrooms and universities:
- No personal data is collected or transmitted outside the educator's browser.
- Compliance with school and institutional privacy guidelines is preserved by keeping all student attendance data local to the educator's personal device.

---

## 7. Security

MeetLedger complies with Chrome Extension Manifest V3 security standards:
- All scripts and dependencies (`Chart.js`, `Lucide`, etc.) are packaged locally.
- No remote code execution or inline script evaluation (`eval`) is utilized.
- No network requests are made during tracking.

---

## 8. Contact & Questions

If you have questions, feedback, or suggestions regarding this privacy policy:
- **Developer:** Sumit Rathor
- **GitHub:** [https://github.com/sumitrathor1](https://github.com/sumitrathor1)
- **Repository Issues:** [https://github.com/sumitrathor1/meetledger-chrome-extension/issues](https://github.com/sumitrathor1/meetledger-chrome-extension/issues)

