/**
 * MeetLedger AI - Master Assistant Controller
 * Orchestrates natural language understanding, database execution, rich UI rendering,
 * and conversational memory.
 */

(function (global) {
  'use strict';

  class AIAssistant {
    constructor() {
      this.currentMode = 'auto'; // 'auto' | 'attendance' | 'analytics' | 'help'
      this.isProcessing = false;
    }

    get contextManager() { return global.MeetLedgerAIContext; }
    get intentParser() { return global.MeetLedgerAIIntentParser; }
    get security() { return global.MeetLedgerAISecurity; }
    get queryEngine() { return global.MeetLedgerAIQueryEngine; }
    get responseBuilder() { return global.MeetLedgerAIResponseBuilder; }
    get knowledgeBase() { return global.MeetLedgerKnowledgeBase; }
    get suggestionsEngine() { return global.MeetLedgerAISuggestions; }
    get provider() { return global.MeetLedgerAIProvider; }

    /**
     * Initializes the chat UI bindings in the dashboard
     */
    async init() {
      console.log('[MeetLedgerAI] Initializing AI Assistant...');

      const chatInput = document.getElementById('ai-chat-input');
      const btnSend = document.getElementById('ai-btn-send');
      const btnNewChat = document.getElementById('ai-btn-new-chat');
      const btnClearChat = document.getElementById('ai-btn-clear-chat');
      const modeSelect = document.getElementById('ai-mode-select');

      if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSend();
          }
        });
      }

      if (btnSend) {
        btnSend.addEventListener('click', () => this.handleSend());
      }

      if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
          this.contextManager.createNewConversation('New Meeting Query');
          this.renderConversation();
          this.renderSidebar();
        });
      }

      if (btnClearChat) {
        btnClearChat.addEventListener('click', () => {
          if (confirm('Clear message history for this conversation?')) {
            const conv = this.contextManager.getActiveConversation();
            conv.messages = [];
            this.contextManager.save();
            this.renderConversation();
          }
        });
      }

      if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
          this.currentMode = e.target.value;
        });
      }

      // Floating button in dashboard
      const floatingBtn = document.getElementById('ai-floating-trigger');
      if (floatingBtn) {
        floatingBtn.addEventListener('click', () => {
          if (global.MeetLedgerDashboard) {
            global.MeetLedgerDashboard.navigateTo('ai-assistant');
          }
        });
      }

      this.renderSidebar();
      this.renderConversation();
      await this.refreshSuggestions();
    }

    /**
     * Handles sending user message
     */
    async handleSend(textOverride = null) {
      if (this.isProcessing) return;

      const input = document.getElementById('ai-chat-input');
      const text = textOverride || (input ? input.value : '');
      if (!text || !text.trim()) return;

      if (input && !textOverride) input.value = '';

      this.isProcessing = true;
      const sanitizedText = this.security.sanitizeString(text);

      // 1. Add user message to conversation memory & render bubble
      this.contextManager.addMessage('user', sanitizedText);
      this.renderConversation();

      // Show typing indicator
      this.showTypingIndicator(true);

      try {
        // 2. Process query plan
        const responsePayload = await this.processQuery(sanitizedText);

        // 3. Add assistant response to conversation memory
        this.contextManager.addMessage('assistant', responsePayload.text, responsePayload);

        // 4. Update Suggestions
        await this.refreshSuggestions();
      } catch (err) {
        console.error('[MeetLedgerAI] Processing error:', err);
        this.contextManager.addMessage('assistant', 'Sorry, I encountered an issue processing your query. Please try asking again.');
      } finally {
        this.showTypingIndicator(false);
        this.isProcessing = false;
        this.renderConversation();
      }
    }

    /**
     * Core Query Execution Pipeline
     */
    async processQuery(userText) {
      const context = this.contextManager.getContext();

      // Step A: Parse / Plan intent
      let rawPlan = null;
      if (this.currentMode === 'help') {
        rawPlan = { intent: 'EXTENSION_HELP', entities: { query: userText }, filters: {} };
      } else {
        rawPlan = await this.provider.generateQueryPlan(userText, context);
      }

      // Step B: Validate with security layer
      const validation = this.security.validateQueryPlan(rawPlan);
      if (!validation.valid) {
        return {
          text: `Query could not be executed: ${validation.error}`,
          richType: null
        };
      }

      const plan = validation.sanitizedPlan;
      const dateRange = plan.filters.dateRange || 'all_time';

      // Update dateRange in memory
      this.contextManager.updateContext({ dateRange, lastIntent: plan.intent });

      // Step C: Route to appropriate Query Operation
      switch (plan.intent) {
        // 1. EXTENSION HELP
        case 'EXTENSION_HELP': {
          const articles = this.knowledgeBase.search(plan.entities.query || userText);
          return this.responseBuilder.buildHelpResponse(articles);
        }

        // 2. PARTICIPANT QUERIES
        case 'PARTICIPANT_MEETING_COUNT':
        case 'PARTICIPANT_DURATION': {
          const candidateName = plan.entities.participantName;
          const searchRes = await this.queryEngine.searchParticipants(candidateName);

          if (!searchRes.exactMatch) {
            if (searchRes.candidates.length > 1) {
              return this.responseBuilder.buildAmbiguousParticipantResponse(searchRes.candidates);
            }
            return {
              text: `I couldn't find any student matching "${candidateName}". Please check the name or roll number.`,
              richType: null
            };
          }

          const target = searchRes.exactMatch;
          this.contextManager.updateContext({ lastParticipant: target });

          const data = await this.queryEngine.getParticipantAttendance(target.id, dateRange);
          return this.responseBuilder.buildParticipantSummaryResponse(data, userText);
        }

        case 'PARTICIPANT_HISTORY': {
          const candidateName = plan.entities.participantName;
          const searchRes = await this.queryEngine.searchParticipants(candidateName);

          if (!searchRes.exactMatch) {
            if (searchRes.candidates.length > 1) {
              return this.responseBuilder.buildAmbiguousParticipantResponse(searchRes.candidates);
            }
            return { text: `No student found matching "${candidateName}".`, richType: null };
          }

          const target = searchRes.exactMatch;
          this.contextManager.updateContext({ lastParticipant: target });
          const data = await this.queryEngine.getParticipantAttendance(target.id, dateRange);
          return this.responseBuilder.buildParticipantHistoryResponse(data);
        }

        case 'PARTICIPANT_LAST_SEEN': {
          const candidateName = plan.entities.participantName;
          const searchRes = await this.queryEngine.searchParticipants(candidateName);
          if (!searchRes.exactMatch) {
            return { text: `Participant "${candidateName}" not found.`, richType: null };
          }

          const target = searchRes.exactMatch;
          const data = await this.queryEngine.getParticipantAttendance(target.id, dateRange);
          if (!data || data.history.length === 0) {
            return { text: `${target.name} has not attended any meetings in ${data ? data.dateRangeLabel : 'the selected period'}.`, richType: null };
          }

          const lastMeeting = data.history[0];
          const timeUtils = global.MeetLedgerTimeUtils;
          const joinTime = timeUtils ? timeUtils.formatTime(lastMeeting.attendance.firstJoinedAt) : '-';
          const leaveTime = lastMeeting.attendance.lastLeftAt ? (timeUtils ? timeUtils.formatTime(lastMeeting.attendance.lastLeftAt) : lastMeeting.attendance.lastLeftAt) : 'Still in call';

          return {
            text: `**${target.name}** last attended **${lastMeeting.meeting.title || 'Meeting'}**.\n- First Joined: **${joinTime}**\n- Last Left: **${leaveTime}**\n- Duration: **${timeUtils ? timeUtils.formatDuration(lastMeeting.attendance.totalDurationSeconds) : lastMeeting.attendance.totalDurationSeconds + 's'}**`,
            richType: 'participant_stat_card',
            richData: {
              name: target.name,
              enrollment: target.enrollment || '',
              meetingsAttended: data.meetingsAttended,
              totalDuration: timeUtils ? timeUtils.formatDuration(data.totalDurationSeconds) : `${data.totalDurationSeconds}s`,
              averagePercentage: data.averagePercentage
            }
          };
        }

        case 'PARTICIPANT_REJOINS': {
          const candidateName = plan.entities.participantName;
          const searchRes = await this.queryEngine.searchParticipants(candidateName);
          if (!searchRes.exactMatch) return { text: `Student "${candidateName}" not found.`, richType: null };

          const target = searchRes.exactMatch;
          const data = await this.queryEngine.getParticipantAttendance(target.id, dateRange);
          return {
            text: `**${target.name}** rejoins: Across **${data.meetingsAttended}** meetings, they had **${data.rejoinCount}** intermediate rejoin events.`,
            richType: null
          };
        }

        // 3. COMPARISONS
        case 'PARTICIPANT_COMPARE': {
          const name1 = plan.entities.participantName;
          const name2 = plan.entities.participantName2;

          const res1 = await this.queryEngine.searchParticipants(name1);
          const res2 = await this.queryEngine.searchParticipants(name2);

          if (!res1.exactMatch || !res2.exactMatch) {
            return {
              text: `Could not compare. Please check names (${!res1.exactMatch ? name1 : ''} ${!res2.exactMatch ? name2 : ''} not found).`,
              richType: null
            };
          }

          this.contextManager.updateContext({
            lastParticipant: res1.exactMatch,
            lastParticipant2: res2.exactMatch
          });

          const comp = await this.queryEngine.compareParticipants(res1.exactMatch.id, res2.exactMatch.id, dateRange);
          return this.responseBuilder.buildComparisonResponse(comp);
        }

        // 4. LOW ATTENDANCE & CRITERIA
        case 'LOW_ATTENDANCE': {
          const threshold = plan.filters.thresholdPct || 75;
          const data = await this.queryEngine.getLowAttendanceParticipants(threshold, dateRange);
          return this.responseBuilder.buildLowAttendanceResponse(data);
        }

        case 'TOP_ATTENDEES': {
          const limit = plan.filters.limit || 10;
          const data = await this.queryEngine.getTopAttendees(limit, dateRange);
          return this.responseBuilder.buildTopAttendeesResponse(data);
        }

        case 'PERFECT_ATTENDEES': {
          const data = await this.queryEngine.getPerfectAttendees(dateRange);
          if (data.perfectAttendees.length === 0) {
            return { text: `No student attended all ${data.totalMeetingsConducted} meetings in ${data.dateRangeLabel}.`, richType: null };
          }
          const rows = data.perfectAttendees.map((p, idx) => ({
            rank: idx + 1,
            id: p.participant.id,
            name: p.participant.name,
            enrollment: p.participant.enrollment || '-',
            attended: `${p.meetingsAttended} / ${data.totalMeetingsConducted}`,
            percentage: '100%'
          }));
          return {
            text: `Found **${data.perfectAttendees.length}** student(s) with 100% attendance in **${data.dateRangeLabel}**:`,
            richType: 'ranked_table',
            richData: {
              columns: ['#', 'Student Name', 'Roll Number', 'Meetings Attended', 'Attendance %'],
              rows: rows
            }
          };
        }

        case 'SINGLE_ATTENDEES': {
          const data = await this.queryEngine.getSingleAttendanceParticipants(dateRange);
          if (data.singleAttendees.length === 0) {
            return { text: `No students were found who attended only one meeting.`, richType: null };
          }
          const rows = data.singleAttendees.map((item, idx) => ({
            rank: idx + 1,
            id: item.participant.id,
            name: item.participant.name,
            enrollment: item.participant.enrollment || '-',
            attended: '1 meeting',
            percentage: `${item.attendance?.attendancePercentage || 0}%`
          }));
          return {
            text: `Found **${data.singleAttendees.length}** student(s) who attended only a single meeting:`,
            richType: 'ranked_table',
            richData: {
              columns: ['#', 'Student Name', 'Roll Number', 'Meetings', 'Session %'],
              rows: rows
            }
          };
        }

        case 'LATE_ARRIVALS': {
          const data = await this.queryEngine.getLateArrivals(dateRange);
          return this.responseBuilder.buildLateArrivalsResponse(data);
        }

        // 5. MEETING STATS & EXTREMES
        case 'MEETING_COUNT':
        case 'MEETING_STATS': {
          const stats = await this.queryEngine.getMeetingStatistics(dateRange);
          return this.responseBuilder.buildMeetingStatsResponse(stats);
        }

        case 'MEETING_EXTREMES': {
          const metric = plan.entities.metric || 'attendance';
          const extremes = await this.queryEngine.getMeetingExtremes(metric, dateRange);
          if (!extremes) {
            return { text: `No meetings conducted in ${dateRange}.`, richType: null };
          }
          const timeUtils = global.MeetLedgerTimeUtils;
          const h = extremes.highest;
          const l = extremes.lowest;

          if (metric === 'duration') {
            const hDur = timeUtils ? timeUtils.formatDuration(h.durationSeconds) : `${h.durationSeconds}s`;
            const lDur = timeUtils ? timeUtils.formatDuration(l.durationSeconds) : `${l.durationSeconds}s`;
            return {
              text: `**Meeting Duration Extremes** (${extremes.dateRangeLabel}):\n- **Longest:** ${h.title || h.meetingCode} (${hDur})\n- **Shortest:** ${l.title || l.meetingCode} (${lDur})`,
              richType: null
            };
          } else {
            return {
              text: `**Meeting Attendance Extremes** (${extremes.dateRangeLabel}):\n- **Highest Attendance:** ${h.title || h.meetingCode} with **${h.participantsCount}** attendees\n- **Lowest Attendance:** ${l.title || l.meetingCode} with **${l.participantsCount}** attendees`,
              richType: null
            };
          }
        }

        case 'MEETING_TRENDS': {
          const trends = await this.queryEngine.getAttendanceTrends(dateRange);
          return {
            text: `Attendance volume trend over ${trends.totalMeetings} meetings in **${trends.dateRangeLabel}**:`,
            richType: 'trend_chart',
            richData: trends
          };
        }

        // 6. SAFE ACTIONS
        case 'ACTION_NAVIGATE': {
          const target = plan.entities.targetPage || 'meetings';
          if (global.MeetLedgerDashboard) {
            global.MeetLedgerDashboard.navigateTo(target);
          }
          return {
            text: `Navigating to **${target.toUpperCase()}**...`,
            richType: 'action_completed',
            richData: { target }
          };
        }

        case 'ACTION_DOWNLOAD_REPORT': {
          const candidateName = plan.entities.participantName;
          const searchRes = await this.queryEngine.searchParticipants(candidateName);
          if (!searchRes.exactMatch) {
            return { text: `Cannot generate report: Student "${candidateName}" not found.`, richType: null };
          }
          const p = searchRes.exactMatch;
          const data = await this.queryEngine.getParticipantAttendance(p.id, dateRange);

          // Generate CSV
          const mockMeeting = { title: `Attendance Report - ${p.name}`, meetingCode: p.enrollment || 'STUDENT', startedAt: new Date().toISOString() };
          const recordsOnly = data.history.map(h => ({
            ...h.attendance,
            name: p.name,
            enrollment: p.enrollment
          }));

          const csv = global.MeetLedgerExport.generateSummaryCSV(mockMeeting, recordsOnly);
          const fname = `Attendance_${p.enrollment || p.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
          global.MeetLedgerExport.downloadFile(csv, fname, 'text/csv;charset=utf-8;');

          return {
            text: `Attendance report for **${p.name}** has been downloaded as CSV (${recordsOnly.length} meeting records).`,
            richType: null
          };
        }

        default:
          return {
            text: `I'm not sure how to answer that question. You can ask me about participant attendance (e.g. "How many meetings did Rahul attend?"), low attendance, top regular students, meeting statistics, or extension help.`,
            richType: null
          };
      }
    }

    /**
     * Renders conversation history into the chat messages container
     */
    renderConversation() {
      const container = document.getElementById('ai-messages-list');
      if (!container) return;

      const conv = this.contextManager.getActiveConversation();
      const messages = conv ? conv.messages : [];

      if (messages.length === 0) {
        container.innerHTML = `
          <div class="ai-welcome-hero">
            <div class="ai-sparkle-circle">
              <i data-lucide="bot"></i>
            </div>
            <h2>MeetLedger AI Assistant</h2>
            <p>Ask anything about your meeting records, student attendance durations, trends, or extension features. Supports English, Hindi, and Hinglish.</p>
          </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
      }

      let html = '';
      messages.forEach(msg => {
        const isUser = msg.role === 'user';
        const timeStr = global.MeetLedgerTimeUtils ? global.MeetLedgerTimeUtils.formatTime(msg.timestamp) : '';
        const richHTML = msg.richPayload ? this.renderRichPayload(msg.richPayload) : '';

        html += `
          <div class="ai-message-row ${isUser ? 'user-row' : 'assistant-row'}">
            <div class="ai-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}">
              ${isUser ? 'U' : 'AI'}
            </div>
            <div class="ai-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}">
              <div class="ai-message-text">${this.formatMarkdownText(msg.content)}</div>
              ${richHTML}
              <div class="ai-message-time">${timeStr}</div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }

      this.bindInteractiveCards(container);
    }

    /**
     * Renders rich interactive UI payload cards
     */
    renderRichPayload(payload) {
      if (!payload || !payload.richType) return '';

      switch (payload.richType) {
        case 'participant_stat_card': {
          const d = payload.richData;
          return `
            <div class="ai-rich-card stat-card">
              <div class="ai-card-title">
                <strong>${d.name}</strong> <span class="code-pill">${d.enrollment || 'No Roll'}</span>
              </div>
              <div class="ai-metrics-grid">
                <div class="ai-m-item"><span class="ai-m-label">Attended</span><span class="ai-m-val text-success">${d.meetingsAttended} / ${d.totalMeetings}</span></div>
                <div class="ai-m-item"><span class="ai-m-label">Total Duration</span><span class="ai-m-val">${d.totalDuration}</span></div>
                <div class="ai-m-item"><span class="ai-m-label">Average %</span><span class="ai-m-val">${d.averagePercentage}%</span></div>
                <div class="ai-m-item"><span class="ai-m-label">Rejoins</span><span class="ai-m-val">${d.rejoinCount}</span></div>
              </div>
              <div class="ai-card-actions">
                <button class="btn btn-secondary btn-sm ai-btn-query" data-prompt="Show ${d.name}'s attendance history">View Full History</button>
                <button class="btn btn-secondary btn-sm ai-btn-query" data-prompt="Download ${d.name}'s attendance report">Download CSV Report</button>
              </div>
            </div>
          `;
        }

        case 'history_table': {
          const d = payload.richData;
          let tableRows = '';
          d.rows.forEach(r => {
            tableRows += `
              <tr>
                <td>${r.index}</td>
                <td><strong>${r.title}</strong></td>
                <td>${r.date}</td>
                <td>${r.joinedAt}</td>
                <td>${r.duration}</td>
                <td>${r.sessions}</td>
                <td><strong>${r.percentage}</strong></td>
              </tr>
            `;
          });
          return `
            <div class="ai-rich-card table-card">
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>#</th><th>Meeting</th><th>Date</th><th>Joined</th><th>Duration</th><th>Sessions</th><th>%</th></tr>
                  </thead>
                  <tbody>${tableRows}</tbody>
                </table>
              </div>
            </div>
          `;
        }

        case 'comparison_card': {
          const d = payload.richData;
          return `
            <div class="ai-rich-card comparison-card">
              <div class="comp-col">
                <h4>${d.p1.name} <span class="code-pill">${d.p1.enrollment || '-'}</span></h4>
                <div class="comp-stat">Attended: <strong>${d.p1.attended}</strong> meetings</div>
                <div class="comp-stat">Duration: <strong>${d.p1.duration}</strong></div>
                <div class="comp-stat">Average Rate: <strong>${d.p1.percentage}%</strong></div>
              </div>
              <div class="comp-divider">VS</div>
              <div class="comp-col">
                <h4>${d.p2.name} <span class="code-pill">${d.p2.enrollment || '-'}</span></h4>
                <div class="comp-stat">Attended: <strong>${d.p2.attended}</strong> meetings</div>
                <div class="comp-stat">Duration: <strong>${d.p2.duration}</strong></div>
                <div class="comp-stat">Average Rate: <strong>${d.p2.percentage}%</strong></div>
              </div>
            </div>
          `;
        }

        case 'ranked_table': {
          const d = payload.richData;
          let ths = d.columns.map(c => `<th>${c}</th>`).join('');
          let trs = '';
          d.rows.forEach(r => {
            trs += `
              <tr>
                <td>${r.rank}</td>
                <td><button class="btn-link ai-btn-query" data-prompt="Show attendance of ${r.name}"><strong>${r.name}</strong></button></td>
                <td><span class="code-pill">${r.enrollment}</span></td>
                <td>${r.attended || r.lateTimes}</td>
                ${r.percentage ? `<td><strong>${r.percentage}</strong></td>` : ''}
                ${r.status ? `<td><span class="status-pill ${r.status === 'Critical' ? 'interrupted' : 'late'}">${r.status}</span></td>` : ''}
              </tr>
            `;
          });
          return `
            <div class="ai-rich-card table-card">
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr>${ths}</tr></thead>
                  <tbody>${trs}</tbody>
                </table>
              </div>
            </div>
          `;
        }

        case 'meeting_stats_card': {
          const d = payload.richData;
          return `
            <div class="ai-rich-card stat-card">
              <div class="ai-metrics-grid">
                <div class="ai-m-item"><span class="ai-m-label">Total Meetings</span><span class="ai-m-val">${d.totalMeetings}</span></div>
                <div class="ai-m-item"><span class="ai-m-label">Cumulative Duration</span><span class="ai-m-val">${d.totalDuration}</span></div>
                <div class="ai-m-item"><span class="ai-m-label">Average Attendees</span><span class="ai-m-val">${d.averageAttendees}</span></div>
                <div class="ai-m-item"><span class="ai-m-label">Average Rate</span><span class="ai-m-val text-success">${d.averagePercentage}</span></div>
              </div>
            </div>
          `;
        }

        case 'ambiguous_selection': {
          const d = payload.richData;
          let chips = '';
          d.candidates.forEach(c => {
            chips += `<button class="ai-choice-chip ai-btn-query" data-prompt="Show attendance of ${c.enrollment !== 'No Roll' ? c.enrollment : c.name}">👤 ${c.name} (${c.enrollment})</button>`;
          });
          return `<div class="ai-choices-wrapper">${chips}</div>`;
        }

        default:
          return '';
      }
    }

    /**
     * Binds interactive elements in messages (e.g. choice chips, prompt triggers)
     */
    bindInteractiveCards(container) {
      const btns = container.querySelectorAll('.ai-btn-query');
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          const prompt = btn.getAttribute('data-prompt');
          if (prompt) {
            this.handleSend(prompt);
          }
        });
      });
    }

    /**
     * Renders conversation sessions in the AI sidebar
     */
    renderSidebar() {
      const listContainer = document.getElementById('ai-history-list');
      if (!listContainer) return;

      const convs = this.contextManager.getConversationList();
      const activeId = this.contextManager.activeId;

      let html = '';
      convs.forEach(c => {
        const isActive = c.id === activeId;
        html += `
          <div class="ai-hist-item ${isActive ? 'active' : ''}" data-id="${c.id}">
            <span class="ai-hist-title">${c.title || 'Conversation'}</span>
            <button class="ai-hist-del" data-del-id="${c.id}" title="Delete conversation">&times;</button>
          </div>
        `;
      });

      listContainer.innerHTML = html;

      // Click to switch
      listContainer.querySelectorAll('.ai-hist-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('ai-hist-del')) return;
          const id = el.getAttribute('data-id');
          this.contextManager.switchConversation(id);
          this.renderSidebar();
          this.renderConversation();
          this.refreshSuggestions();
        });
      });

      // Delete buttons
      listContainer.querySelectorAll('.ai-hist-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-del-id');
          this.contextManager.deleteConversation(id);
          this.renderSidebar();
          this.renderConversation();
          this.refreshSuggestions();
        });
      });
    }

    /**
     * Refreshes suggestion pills
     */
    async refreshSuggestions() {
      const container = document.getElementById('ai-suggestions-bar');
      if (!container) return;

      const context = this.contextManager.getContext();
      let totalMeetings = 0;
      if (global.MeetLedgerDB) {
        const all = await global.MeetLedgerDB.getAllMeetings({ limit: 1 });
        totalMeetings = all.length;
      }

      const suggestions = await this.suggestionsEngine.getSuggestions(context, totalMeetings);

      let html = '';
      suggestions.forEach(s => {
        html += `<button class="ai-suggestion-pill">${s}</button>`;
      });

      container.innerHTML = html;

      container.querySelectorAll('.ai-suggestion-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          this.handleSend(btn.textContent.trim());
        });
      });
    }

    /**
     * Toggles typing indicator
     */
    showTypingIndicator(show) {
      const indicator = document.getElementById('ai-typing-indicator');
      if (indicator) {
        if (show) indicator.classList.remove('hidden');
        else indicator.classList.add('hidden');
      }
    }

    /**
     * Basic Markdown to HTML formatter for message text
     */
    formatMarkdownText(text) {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }
  }

  const assistant = new AIAssistant();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = assistant;
  }
  global.MeetLedgerAI = assistant;
})(typeof window !== 'undefined' ? window : this);
