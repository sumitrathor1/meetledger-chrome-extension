/**
 * MeetLedger - Automated Core Test Suite
 * Validates Identity Extraction, Time Utils, Duration Sums, Non-Overlapping Interval Merging,
 * CSV/JSON Exports, and Manifest File Integrity.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load modules
const Identity = require('../shared/identity.js');
const TimeUtils = require('../shared/time-utils.js');
const Export = require('../shared/export.js');
const Constants = require('../shared/constants.js');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    failCount++;
  }
}

console.log('=== RUNNING MEETLEDGER CORE TESTS ===\n');

// 1. MANIFEST INTEGRITY TESTS
console.log('[1. Manifest Integrity]');
it('manifest.json is valid JSON with Manifest V3 and existing files', () => {
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json exists');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
  assert.ok(manifest.name.includes('MeetLedger'), 'Must have correct name');

  // Verify background worker exists
  const bgPath = path.join(__dirname, '..', manifest.background.service_worker);
  assert.ok(fs.existsSync(bgPath), `Background worker must exist at ${bgPath}`);

  // Verify content scripts exist
  manifest.content_scripts.forEach(cs => {
    cs.js.forEach(script => {
      const sp = path.join(__dirname, '..', script);
      assert.ok(fs.existsSync(sp), `Content script ${script} must exist`);
    });
    if (cs.css) {
      cs.css.forEach(style => {
        const cp = path.join(__dirname, '..', style);
        assert.ok(fs.existsSync(cp), `CSS ${style} must exist`);
      });
    }
  });

  // Verify icons exist
  Object.values(manifest.icons).forEach(icon => {
    const ip = path.join(__dirname, '..', icon);
    assert.ok(fs.existsSync(ip), `Icon ${icon} must exist`);
  });

  // Verify popup exists
  const popupPath = path.join(__dirname, '..', manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), `Popup must exist at ${popupPath}`);
});

// 2. IDENTITY EXTRACTION TESTS
console.log('\n[2. Identity & Enrollment Extraction]');
it('extracts leading enrollment and name correctly', () => {
  const raw = 'BTMC25O1026 ASHISH SINGH RAJPUT';
  const res = Identity.extractEnrollmentAndName(raw);
  assert.strictEqual(res.enrollment, 'BTMC25O1026');
  assert.strictEqual(res.name, 'ASHISH SINGH RAJPUT');
  assert.strictEqual(res.key, 'enr:BTMC25O1026');
});

it('extracts bracketed roll number correctly', () => {
  const raw = '[0827CS201026] Jane Doe';
  const res = Identity.extractEnrollmentAndName(raw);
  assert.strictEqual(res.enrollment, '0827CS201026');
  assert.strictEqual(res.name, 'Jane Doe');
});

it('extracts parenthesized roll number correctly', () => {
  const raw = 'John Doe (21BCS101)';
  const res = Identity.extractEnrollmentAndName(raw);
  assert.strictEqual(res.enrollment, '21BCS101');
  assert.strictEqual(res.name, 'John Doe');
});

it('does not mistake honorifics (Dr, Prof) as enrollment numbers', () => {
  const raw = 'Dr. Alan Turing';
  const res = Identity.extractEnrollmentAndName(raw);
  assert.strictEqual(res.enrollment, '');
  assert.strictEqual(res.name, 'Dr. Alan Turing');
  assert.strictEqual(res.key, 'name:dr._alan_turing');
});

it('excludes host name (Sumit Rathor) case-insensitively when no enrollment is present', () => {
  assert.strictEqual(Identity.isExcluded('Sumit Rathor', 'Sumit Rathor', ['Sumit Rathor'], false), true);
  assert.strictEqual(Identity.isExcluded('sumit rathor', 'sumit rathor (You)', ['Sumit Rathor'], false), true);
  assert.strictEqual(Identity.isExcluded('ASHISH SINGH', 'ASHISH SINGH', ['Sumit Rathor'], false), false);
  assert.strictEqual(Identity.isExcluded('Kamlesh Rathor', 'Kamlesh Rathor', ['Sumit Rathor'], false), false);
});

it('does NOT exclude a participant with roll number even if their name matches host name (0901CD243D04 SUMIT RATHOR)', () => {
  const raw = '0901CD243D04 SUMIT RATHOR';
  const res = Identity.extractEnrollmentAndName(raw);
  assert.strictEqual(res.enrollment, '0901CD243D04');
  assert.strictEqual(res.name, 'SUMIT RATHOR');
  const hasEnrollment = Boolean(res.enrollment);
  assert.strictEqual(Identity.isExcluded(res.name, raw, ['Sumit Rathor'], hasEnrollment), false);
});

it('identifies Google Meet UI noise and icon ligatures (e.g. devices, add people, more_vert)', () => {
  assert.strictEqual(Identity.isUINoise('devices'), true);
  assert.strictEqual(Identity.isUINoise('add people'), true);
  assert.strictEqual(Identity.isUINoise('more_vert'), true);
  assert.strictEqual(Identity.isUINoise('in call'), true);
  assert.strictEqual(Identity.isUINoise('Kamlesh Rathor'), false);
  assert.strictEqual(Identity.isUINoise('0901CD243D04 SUMIT RATHOR'), false);
});

it('generates unique meeting session IDs for the same meeting code', () => {
  const id1 = Identity.generateMeetingSessionId('abc-defg-hij');
  const id2 = Identity.generateMeetingSessionId('abc-defg-hij');
  assert.ok(id1.startsWith('meet_abc-defg-hij_'));
  assert.ok(id2.startsWith('meet_abc-defg-hij_'));
  assert.notStrictEqual(id1, id2, 'Session IDs must be unique');
});

// 3. TIME UTILITIES & INTERVAL SUMMATION TESTS
console.log('\n[3. Time Utilities & Interval Calculations]');
it('formats durations accurately', () => {
  assert.strictEqual(TimeUtils.formatDuration(0), '0s');
  assert.strictEqual(TimeUtils.formatDuration(45), '45s');
  assert.strictEqual(TimeUtils.formatDuration(145), '2m 25s');
  assert.strictEqual(TimeUtils.formatDuration(3725), '1h 2m 5s');
});

it('calculates multi-session attendance duration correctly (Example from prompt)', () => {
  // Session 1: 10:05:20 to 10:30:15 (24m 55s = 1495s)
  // Session 2: 10:45:10 to 11:00:00 (14m 50s = 890s)
  // Total expected: 39m 45s = 2385s
  const sessions = [
    {
      joinedAt: '2026-11-01T10:05:20.000Z',
      leftAt: '2026-11-01T10:30:15.000Z'
    },
    {
      joinedAt: '2026-11-01T10:45:10.000Z',
      leftAt: '2026-11-01T11:00:00.000Z'
    }
  ];

  const totalSec = TimeUtils.calculateTotalSessionDuration(sessions);
  assert.strictEqual(totalSec, 2385, 'Duration must equal 2385 seconds (39m 45s)');
  assert.strictEqual(TimeUtils.formatDuration(totalSec), '39m 45s');
});

it('merges overlapping intervals and avoids double counting', () => {
  const overlappingSessions = [
    {
      joinedAt: '2026-11-01T10:00:00.000Z',
      leftAt: '2026-11-01T10:20:00.000Z' // 20 mins
    },
    {
      joinedAt: '2026-11-01T10:10:00.000Z', // overlaps by 10 mins
      leftAt: '2026-11-01T10:30:00.000Z' // extends to 30 mins
    }
  ];

  const totalSec = TimeUtils.calculateTotalSessionDuration(overlappingSessions);
  // Total span is 10:00 to 10:30 = 30 minutes = 1800 seconds
  assert.strictEqual(totalSec, 1800, 'Overlapping intervals must be merged to 1800s');
});

it('calculates attendance percentage accurately', () => {
  const pct = TimeUtils.calculatePercentage(2385, 3600); // 2385s out of 1h
  assert.strictEqual(pct, 66.3);
});

it('detects late arrival correctly based on threshold', () => {
  const meetStart = '2026-11-01T10:00:00.000Z';
  const onTimeJoin = '2026-11-01T10:03:00.000Z'; // 3 mins after (threshold = 5)
  const lateJoin = '2026-11-01T10:08:00.000Z'; // 8 mins after (threshold = 5)

  assert.strictEqual(TimeUtils.isLate(onTimeJoin, meetStart, 5), false);
  assert.strictEqual(TimeUtils.isLate(lateJoin, meetStart, 5), true);
});

// 4. EXPORT ENGINE TESTS
console.log('\n[4. Export Engine]');
it('generates summary CSV with UTF-8 BOM and correct headers', () => {
  const mockMeeting = {
    title: 'CSD Class - Monday',
    meetingCode: 'abc-defg-hij',
    startedAt: '2026-11-01T10:00:00.000Z'
  };
  const mockRecords = [
    {
      enrollment: 'BTMC25O1026',
      name: 'ASHISH SINGH RAJPUT',
      firstJoinedAt: '2026-11-01T10:05:20.000Z',
      lastLeftAt: '2026-11-01T11:00:00.000Z',
      totalDurationSeconds: 2385,
      attendancePercentage: 66.3,
      status: 'present',
      sessions: [{}, {}]
    }
  ];

  const csv = Export.generateSummaryCSV(mockMeeting, mockRecords);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('"Meeting Name","Meeting Code","Meeting Date","Enrollment Number","Participant Name"'), 'Must contain headers');
  assert.ok(csv.includes('BTMC25O1026'), 'Must contain student enrollment');
  assert.ok(csv.includes('ASHISH SINGH RAJPUT'), 'Must contain student name');
  assert.ok(csv.includes('66.3%'), 'Must contain attendance percentage');
});

it('generates detailed intervals CSV with session breakdowns', () => {
  const mockMeeting = {
    title: 'CSD Class',
    meetingCode: 'abc-defg-hij',
    startedAt: '2026-11-01T10:00:00.000Z'
  };
  const mockRecords = [
    {
      enrollment: 'BTMC25O1026',
      name: 'ASHISH SINGH RAJPUT',
      sessions: [
        { joinedAt: '2026-11-01T10:05:20.000Z', leftAt: '2026-11-01T10:30:15.000Z', durationSeconds: 1495 },
        { joinedAt: '2026-11-01T10:45:10.000Z', leftAt: '2026-11-01T11:00:00.000Z', durationSeconds: 890 }
      ]
    }
  ];

  const csv = Export.generateDetailedSessionsCSV(mockMeeting, mockRecords);
  assert.ok(csv.includes('"Session Number","Joined At","Left At","Interval Duration"'), 'Must contain interval headers');
  assert.ok(csv.includes('"1"'), 'Must contain Session 1');
  assert.ok(csv.includes('"2"'), 'Must contain Session 2');
});

it('generates valid JSON export', () => {
  const mockMeeting = { id: 'm1', title: 'Test Meet' };
  const mockRecords = [{ name: 'Alice', enrollment: 'ENR001' }];
  const jsonStr = Export.generateJSON(mockMeeting, mockRecords);
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.app, undefined);
  assert.strictEqual(parsed.meeting.id, 'm1');
  assert.strictEqual(parsed.participantsCount, 1);
});

console.log(`\n=== TEST SUMMARY: ${passCount} Passed, ${failCount} Failed ===`);
if (failCount > 0) {
  process.exit(1);
}
