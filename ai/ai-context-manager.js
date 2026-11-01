/**
 * MeetLedger AI - Conversation Context & Session Memory
 * Maintains conversation history, entity memory, date filter context, and follow-up states.
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'meetledger_ai_conversations';
  const ACTIVE_KEY = 'meetledger_ai_active_id';

  class AIContextManager {
    constructor() {
      this.conversations = new Map();
      this.activeId = null;
      this.load();
    }

    /**
     * Loads conversations from local storage
     */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          list.forEach(c => this.conversations.set(c.id, c));
        }

        const active = localStorage.getItem(ACTIVE_KEY);
        if (active && this.conversations.has(active)) {
          this.activeId = active;
        } else if (this.conversations.size > 0) {
          this.activeId = Array.from(this.conversations.keys())[0];
        } else {
          this.createNewConversation('General Meeting Query');
        }
      } catch (e) {
        console.warn('[AIContextManager] Load error:', e);
        this.createNewConversation('New Chat');
      }
    }

    /**
     * Persists conversations to local storage
     */
    save() {
      try {
        const arr = Array.from(this.conversations.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        if (this.activeId) {
          localStorage.setItem(ACTIVE_KEY, this.activeId);
        }
      } catch (e) {
        console.warn('[AIContextManager] Save error:', e);
      }
    }

    /**
     * Creates a new conversation session
     */
    createNewConversation(title = 'New Meeting Analysis') {
      const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const conv = {
        id: id,
        title: title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        context: {
          lastParticipant: null,
          lastParticipant2: null,
          lastMeeting: null,
          dateRange: 'all_time',
          lastIntent: null
        }
      };

      this.conversations.set(id, conv);
      this.activeId = id;
      this.save();
      return conv;
    }

    /**
     * Gets the currently active conversation
     */
    getActiveConversation() {
      if (!this.activeId || !this.conversations.has(this.activeId)) {
        return this.createNewConversation();
      }
      return this.conversations.get(this.activeId);
    }

    /**
     * Switches to a conversation
     */
    switchConversation(id) {
      if (this.conversations.has(id)) {
        this.activeId = id;
        this.save();
        return this.conversations.get(id);
      }
      return null;
    }

    /**
     * Deletes a conversation
     */
    deleteConversation(id) {
      this.conversations.delete(id);
      if (this.activeId === id) {
        const remaining = Array.from(this.conversations.keys());
        this.activeId = remaining.length > 0 ? remaining[0] : null;
        if (!this.activeId) {
          this.createNewConversation();
        }
      }
      this.save();
    }

    /**
     * Clears all conversations
     */
    clearAll() {
      this.conversations.clear();
      this.activeId = null;
      this.createNewConversation();
      this.save();
    }

    /**
     * Adds message to current conversation
     */
    addMessage(role, content, richPayload = null) {
      const conv = this.getActiveConversation();
      const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        role: role, // 'user' | 'assistant'
        content: content,
        timestamp: new Date().toISOString(),
        richPayload: richPayload
      };

      conv.messages.push(msg);
      conv.updatedAt = new Date().toISOString();

      // Auto update conversation title on first user message
      if (conv.messages.length === 1 && role === 'user') {
        conv.title = content.slice(0, 32).trim() + (content.length > 32 ? '...' : '');
      }

      this.save();
      return msg;
    }

    /**
     * Updates context memory (e.g. participant entity, date range)
     */
    updateContext(updates) {
      const conv = this.getActiveConversation();
      conv.context = {
        ...conv.context,
        ...updates
      };
      conv.updatedAt = new Date().toISOString();
      this.save();
    }

    /**
     * Gets context object
     */
    getContext() {
      const conv = this.getActiveConversation();
      return conv ? conv.context : {};
    }

    /**
     * Lists all conversation summaries for sidebar
     */
    getConversationList() {
      return Array.from(this.conversations.values())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }

  const manager = new AIContextManager();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = manager;
  }
  global.MeetLedgerAIContext = manager;
})(typeof window !== 'undefined' ? window : this);
