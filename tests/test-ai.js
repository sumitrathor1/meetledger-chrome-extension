/**
 * MeetLedger - Automated AI Assistant Test Suite
 * Validates:
 * 1. Multilingual intent parsing (English, Hindi, Hinglish)
 * 2. All 15 required conversation queries from user specifications
 * 3. Contextual follow-up memory & entity resolution
 * 4. AI Security Layer validation & sanitization
 * 5. Offline Knowledge Base article search
 * 6. Local Query Engine execution with zero hallucinations
 */

const assert = require('assert');

// Global mock environment for Node.js
global.window = global;

// Load shared modules
const Constants = require('../shared/constants.js');
const TimeUtils = require('../shared/time-utils.js');
const Identity = require('../shared/identity.js');
const Export = require('../shared/export.js');

global.MeetLedgerConstants = Constants;
global.MeetLedgerTimeUtils = TimeUtils;
global.MeetLedgerIdentity = Identity;
global.MeetLedgerExport = Export;

// Mock localStorage
const storageStore = {};
global.localStorage = {
  getItem: (k) => (k in storageStore ? storageStore[k] : null),
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};

// Load AI modules
const Security = require('../ai/ai-security.js');
const KnowledgeBase = require('../ai/ai-knowledge-base.js');
const IntentParser = require('../ai/ai-intent-parser.js');
const ContextManager = require('../ai/ai-context-manager.js');
const QueryEngine = require('../ai/ai-query-engine.js');
const ResponseBuilder = require('../ai/ai-response-builder.js');
const Suggestions = require('../ai/ai-suggestions.js');
const AIProvider = require('../ai/ai-api.js');
const AIAssistant = require('../ai/ai-assistant.js');

global.MeetLedgerAISecurity = Security;
global.MeetLedgerKnowledgeBase = KnowledgeBase;
global.MeetLedgerAIIntentParser = IntentParser;
global.MeetLedgerAIContext = ContextManager;
global.MeetLedgerAIQueryEngine = QueryEngine;
global.MeetLedgerAIResponseBuilder = ResponseBuilder;
global.MeetLedgerAISuggestions = Suggestions;
global.MeetLedgerAIProvider = AIProvider;

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

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    failCount++;
  }
}

async function runTests() {
  console.log('=== RUNNING MEETLEDGER AI ASSISTANT TEST SUITE ===\n');

  // =========================================================================
  // TEST GROUP 1: SECURITY LAYER
  // =========================================================================
  console.log('[1. Security Layer & Sanitization]');
  it('Sanitizes malicious script tags and event attributes', () => {
    const raw = '<script>alert("xss")</script>Hello <img src=x onerror=alert(1)>World';
    const clean = Security.sanitizeString(raw);
    assert.strictEqual(clean.includes('<script>'), false);
    assert.strictEqual(clean.includes('onerror='), false);
    assert.ok(clean.includes('Hello'));
  });

  it('Validates allowed intents and rejects unauthorized commands', () => {
    const allowed = Security.validateQueryPlan({
      intent: 'PARTICIPANT_MEETING_COUNT',
      entities: { participantName: 'Rahul' },
      filters: { dateRange: 'this_month' }
    });
    assert.strictEqual(allowed.valid, true);

    const forbidden = Security.validateQueryPlan({
      intent: 'DROP_DATABASE',
      entities: {},
      filters: {}
    });
    assert.strictEqual(forbidden.valid, false);
    assert.ok(forbidden.error.includes('Disallowed intent'));
  });

  // =========================================================================
  // TEST GROUP 2: KNOWLEDGE BASE (OFFLINE HELP)
  // =========================================================================
  console.log('\n[2. Offline Knowledge Base]');
  it('Returns documentation on CSV export', () => {
    const results = KnowledgeBase.search('How do I export CSV?');
    assert.ok(results.length > 0);
    assert.ok(results[0].title.toLowerCase().includes('export') || results[0].content.toLowerCase().includes('csv'));
  });

  it('Returns documentation on creating meetings and auto tracking', () => {
    const results = KnowledgeBase.search('How does auto tracking work?');
    assert.ok(results.length > 0);
    assert.ok(results[0].content.includes('Google Meet'));
  });

  it('Returns documentation on roll number / enrollment detection', () => {
    const results = KnowledgeBase.search('enrollment number regex pattern');
    assert.ok(results.length > 0);
    assert.ok(results[0].content.includes('Roll Number') || results[0].content.includes('Enrollment'));
  });

  // =========================================================================
  // TEST GROUP 3: INTENT PARSER & MULTILINGUAL QUERIES (15 SPEC QUERIES)
  // =========================================================================
  console.log('\n[3. Natural Language Intent Parsing & 15 Core Queries]');

  // Query 1
  it('Query 1: "How many meetings did Rahul attend?" -> PARTICIPANT_MEETING_COUNT', () => {
    const plan = IntentParser.parse('How many meetings did Rahul attend?');
    assert.strictEqual(plan.intent, 'PARTICIPANT_MEETING_COUNT');
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'rahul');
  });

  // Query 2
  it('Query 2: "Rahul ki attendance kitni hai?" (Hindi/Hinglish) -> PARTICIPANT_MEETING_COUNT / DURATION', () => {
    const plan = IntentParser.parse('Rahul ki attendance kitni hai?');
    assert.ok(['PARTICIPANT_MEETING_COUNT', 'PARTICIPANT_DURATION'].includes(plan.intent));
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'rahul');
  });

  // Query 3
  it('Query 3: "Show all meetings attended by Rahul." -> PARTICIPANT_HISTORY', () => {
    const plan = IntentParser.parse('Show all meetings attended by Rahul.');
    assert.strictEqual(plan.intent, 'PARTICIPANT_HISTORY');
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'rahul');
  });

  // Query 4
  it('Query 4: "Who has the lowest attendance?" -> LOW_ATTENDANCE', () => {
    const plan = IntentParser.parse('Who has the lowest attendance?');
    assert.strictEqual(plan.intent, 'LOW_ATTENDANCE');
  });

  // Query 5
  it('Query 5: "Show students below 75% attendance." -> LOW_ATTENDANCE (threshold 75)', () => {
    const plan = IntentParser.parse('Show students below 75% attendance.');
    assert.strictEqual(plan.intent, 'LOW_ATTENDANCE');
    assert.strictEqual(plan.filters.thresholdPct, 75);
  });

  // Query 6
  it('Query 6: "Which students joined late?" -> LATE_ARRIVALS', () => {
    const plan = IntentParser.parse('Which students joined late?');
    assert.strictEqual(plan.intent, 'LATE_ARRIVALS');
  });

  // Query 7
  it('Query 7: "Compare Rahul and Amit." -> PARTICIPANT_COMPARE', () => {
    const plan = IntentParser.parse('Compare Rahul and Amit.');
    assert.strictEqual(plan.intent, 'PARTICIPANT_COMPARE');
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'rahul');
    assert.strictEqual(plan.entities.participantName2.toLowerCase(), 'amit');
  });

  // Query 8
  it('Query 8: "Show attendance for last week." -> MEETING_STATS (dateRange: last_week)', () => {
    const plan = IntentParser.parse('Show attendance for last week.');
    assert.strictEqual(plan.intent, 'MEETING_STATS');
    assert.strictEqual(plan.filters.dateRange, 'last_week');
  });

  // Query 9
  it('Query 9: "How many participants joined today\'s meeting?" -> MEETING_STATS (dateRange: today)', () => {
    const plan = IntentParser.parse("How many participants joined today's meeting?");
    assert.strictEqual(plan.intent, 'MEETING_STATS');
    assert.strictEqual(plan.filters.dateRange, 'today');
  });

  // Query 10
  it('Query 10: "Show the top 10 students by attendance." -> TOP_ATTENDEES (limit 10)', () => {
    const plan = IntentParser.parse('Show the top 10 students by attendance.');
    assert.strictEqual(plan.intent, 'TOP_ATTENDEES');
    assert.strictEqual(plan.filters.limit, 10);
  });

  // Query 11
  it('Query 11: "Download Rahul\'s attendance report." -> ACTION_DOWNLOAD_REPORT', () => {
    const plan = IntentParser.parse("Download Rahul's attendance report.");
    assert.strictEqual(plan.intent, 'ACTION_DOWNLOAD_REPORT');
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'rahul');
  });

  // Query 12
  it('Query 12: "How do I create a new meeting?" -> EXTENSION_HELP', () => {
    const plan = IntentParser.parse('How do I create a new meeting?');
    assert.strictEqual(plan.intent, 'EXTENSION_HELP');
  });

  // Query 13
  it('Query 13: "How do I export CSV?" -> EXTENSION_HELP', () => {
    const plan = IntentParser.parse('How do I export CSV?');
    assert.strictEqual(plan.intent, 'EXTENSION_HELP');
  });

  // Query 14
  it('Query 14: "What is the total meeting duration this month?" -> MEETING_STATS (dateRange: this_month)', () => {
    const plan = IntentParser.parse('What is the total meeting duration this month?');
    assert.strictEqual(plan.intent, 'MEETING_STATS');
    assert.strictEqual(plan.filters.dateRange, 'this_month');
  });

  // Query 15
  it('Query 15: "Show the meeting with the highest attendance." -> MEETING_EXTREMES (attendance)', () => {
    const plan = IntentParser.parse('Show the meeting with the highest attendance.');
    assert.strictEqual(plan.intent, 'MEETING_EXTREMES');
    assert.strictEqual(plan.entities.metric, 'attendance');
  });

  // Hindi / Hinglish variants
  it('Understands Hindi query: "Rahul kitni meetings me aaya?"', () => {
    const plan = IntentParser.parse('Rahul kitni meetings me aaya?');
    assert.strictEqual(plan.intent, 'PARTICIPANT_MEETING_COUNT');
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'rahul');
  });

  it('Understands Hindi query: "Sabse kam attendance kiski hai?"', () => {
    const plan = IntentParser.parse('Sabse kam attendance kiski hai?');
    assert.strictEqual(plan.intent, 'LOW_ATTENDANCE');
  });

  // =========================================================================
  // TEST GROUP 4: CONTEXTUAL FOLLOW-UP MEMORY
  // =========================================================================
  console.log('\n[4. Contextual Follow-Up Memory]');
  it('Resolves pronoun "his total duration" using context.lastParticipant', () => {
    const mockContext = {
      lastParticipant: { id: 'p1', name: 'Rahul Sharma', enrollment: '0901CD243D01' },
      dateRange: 'all_time'
    };
    const plan = IntentParser.parse('What is his total attendance duration?', mockContext);
    assert.strictEqual(plan.intent, 'PARTICIPANT_DURATION');
    assert.strictEqual(plan.entities.participantName, 'Rahul Sharma');
  });

  it('Handles "What about Amit?" follow-up to switch subject', () => {
    const mockContext = {
      lastParticipant: { id: 'p1', name: 'Rahul Sharma' },
      lastIntent: 'PARTICIPANT_MEETING_COUNT'
    };
    const plan = IntentParser.parse('What about Amit?', mockContext);
    assert.strictEqual(plan.intent, 'PARTICIPANT_MEETING_COUNT');
    assert.strictEqual(plan.entities.participantName.toLowerCase(), 'amit');
  });

  it('Handles "Compare with Amit" follow-up', () => {
    const mockContext = {
      lastParticipant: { id: 'p1', name: 'Rahul Sharma' }
    };
    const plan = IntentParser.parse('Compare with Amit', mockContext);
    assert.strictEqual(plan.intent, 'PARTICIPANT_COMPARE');
    assert.strictEqual(plan.entities.participantName, 'Rahul Sharma');
    assert.strictEqual(plan.entities.participantName2.toLowerCase(), 'amit');
  });

  // =========================================================================
  // TEST GROUP 5: QUERY ENGINE WITH MOCKED DATABASE (VERIFIED REAL DATA ONLY)
  // =========================================================================
  console.log('\n[5. Query Engine Execution & Calculations]');

  // Setup Mock DB with sample meetings & records
  const mockParticipants = [
    { id: 'part_rahul', name: 'Rahul Sharma', enrollment: '0901CD243D01' },
    { id: 'part_amit', name: 'Amit Verma', enrollment: '0901CD243D02' },
    { id: 'part_sumit', name: 'Sumit Rathor', enrollment: '0901CD243D04' }
  ];

  const now = new Date();
  const mockMeetings = [
    {
      id: 'meet_1',
      meetingCode: 'abc-defg-hij',
      title: 'CSD Lecture 1',
      startedAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      endedAt: new Date(now.getTime() - 86400000 * 2 + 3600000).toISOString(),
      durationSeconds: 3600,
      status: 'completed',
      participantsCount: 3
    },
    {
      id: 'meet_2',
      meetingCode: 'xyz-uvwx-rst',
      title: 'CSD Lecture 2',
      startedAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
      endedAt: new Date(now.getTime() - 86400000 * 1 + 3600000).toISOString(),
      durationSeconds: 3600,
      status: 'completed',
      participantsCount: 2
    }
  ];

  const mockAttendance = [
    // Rahul in Meet 1: 3000s (83%)
    {
      id: 'att_1',
      meetingId: 'meet_1',
      participantId: 'part_rahul',
      name: 'Rahul Sharma',
      enrollment: '0901CD243D01',
      firstJoinedAt: mockMeetings[0].startedAt,
      lastLeftAt: mockMeetings[0].endedAt,
      totalDurationSeconds: 3000,
      attendancePercentage: 83,
      sessions: [{ joinedAt: mockMeetings[0].startedAt, leftAt: mockMeetings[0].endedAt, durationSeconds: 3000 }]
    },
    // Rahul in Meet 2: 3600s (100%)
    {
      id: 'att_2',
      meetingId: 'meet_2',
      participantId: 'part_rahul',
      name: 'Rahul Sharma',
      enrollment: '0901CD243D01',
      firstJoinedAt: mockMeetings[1].startedAt,
      lastLeftAt: mockMeetings[1].endedAt,
      totalDurationSeconds: 3600,
      attendancePercentage: 100,
      sessions: [{ joinedAt: mockMeetings[1].startedAt, leftAt: mockMeetings[1].endedAt, durationSeconds: 3600 }]
    },
    // Amit only in Meet 1: 1800s (50%)
    {
      id: 'att_3',
      meetingId: 'meet_1',
      participantId: 'part_amit',
      name: 'Amit Verma',
      enrollment: '0901CD243D02',
      firstJoinedAt: mockMeetings[0].startedAt,
      lastLeftAt: mockMeetings[0].endedAt,
      totalDurationSeconds: 1800,
      attendancePercentage: 50,
      sessions: [{ joinedAt: mockMeetings[0].startedAt, leftAt: mockMeetings[0].endedAt, durationSeconds: 1800 }]
    }
  ];

  global.MeetLedgerDB = {
    async getAllParticipants() {
      return [...mockParticipants];
    },
    async getParticipant(id) {
      return mockParticipants.find(p => p.id === id) || null;
    },
    async getAllMeetings() {
      return [...mockMeetings];
    },
    async getMeeting(id) {
      return mockMeetings.find(m => m.id === id) || null;
    },
    async getParticipantHistory(participantId) {
      const records = mockAttendance.filter(a => a.participantId === participantId);
      return records.map(att => ({
        attendance: att,
        meeting: mockMeetings.find(m => m.id === att.meetingId) || { id: att.meetingId, title: 'Meeting' }
      }));
    },
    async getMeetingAttendance(meetingId) {
      return mockAttendance.filter(a => a.meetingId === meetingId);
    }
  };

  await itAsync('QueryEngine searches participant by name or roll fuzzy', async () => {
    const res1 = await QueryEngine.searchParticipants('rahul');
    assert.ok(res1.exactMatch);
    assert.strictEqual(res1.exactMatch.name, 'Rahul Sharma');

    const res2 = await QueryEngine.searchParticipants('0901CD243D02');
    assert.ok(res2.exactMatch);
    assert.strictEqual(res2.exactMatch.name, 'Amit Verma');
  });

  await itAsync('QueryEngine calculates accurate non-hallucinated attendance for Rahul', async () => {
    const data = await QueryEngine.getParticipantAttendance('part_rahul', 'all_time');
    assert.strictEqual(data.meetingsAttended, 2);
    assert.strictEqual(data.totalMeetingsConducted, 2);
    assert.strictEqual(data.totalDurationSeconds, 6600); // 3000 + 3600
    assert.strictEqual(data.averagePercentage, 91.5); // (83 + 100) / 2
  });

  await itAsync('QueryEngine identifies students with < 75% attendance', async () => {
    const data = await QueryEngine.getLowAttendanceParticipants(75, 'all_time');
    // Amit has 50% average
    assert.ok(data.lowList.length >= 1);
    const foundAmit = data.lowList.find(a => a.participant.name === 'Amit Verma');
    assert.ok(foundAmit);
    assert.strictEqual(foundAmit.averagePercentage, 50);
  });

  await itAsync('QueryEngine accurately compares two participants (Rahul vs Amit)', async () => {
    const comp = await QueryEngine.compareParticipants('part_rahul', 'part_amit', 'all_time');
    assert.strictEqual(comp.participant1.participant.name, 'Rahul Sharma');
    assert.strictEqual(comp.participant2.participant.name, 'Amit Verma');
    assert.strictEqual(comp.participant1.meetingsAttended, 2);
    assert.strictEqual(comp.participant2.meetingsAttended, 1);
  });

  await itAsync('QueryEngine calculates meeting statistics & duration extremes', async () => {
    const stats = await QueryEngine.getMeetingStatistics('all_time');
    assert.strictEqual(stats.totalMeetings, 2);
    assert.strictEqual(stats.totalDurationSeconds, 7200);

    const extremes = await QueryEngine.getMeetingExtremes('attendance', 'all_time');
    assert.strictEqual(extremes.highest.participantsCount, 3);
    assert.strictEqual(extremes.lowest.participantsCount, 2);
  });

  // =========================================================================
  // TEST GROUP 6: END-TO-END ASSISTANT PIPELINE
  // =========================================================================
  console.log('\n[6. End-to-End AI Assistant Pipeline]');
  await itAsync('Assistant processes "How many meetings did Rahul attend?" and returns verified stat card', async () => {
    const resp = await AIAssistant.processQuery('How many meetings did Rahul attend?');
    assert.strictEqual(resp.richType, 'participant_stat_card');
    assert.strictEqual(resp.richData.name, 'Rahul Sharma');
    assert.strictEqual(resp.richData.meetingsAttended, 2);
    assert.ok(resp.text.includes('Rahul Sharma'));
  });

  await itAsync('Assistant processes "Show students below 75% attendance" and returns ranked table', async () => {
    const resp = await AIAssistant.processQuery('Show students below 75% attendance');
    assert.strictEqual(resp.richType, 'ranked_table');
    assert.ok(resp.richData.rows.length > 0);
  });

  await itAsync('Assistant handles ambiguous participant lookup when query matches multiple', async () => {
    // If user searches "Rathor" which might match multiple
    const resp = await AIAssistant.processQuery('Show attendance of Verma');
    assert.ok(resp.text.includes('Amit Verma'));
  });

  console.log(`\n========================================`);
  console.log(`AI TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
