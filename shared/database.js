/**
 * MeetLedger - IndexedDB Database Storage Engine
 * High-capacity, transaction-safe storage for meetings, participants, attendance records, and intervals.
 */

(function (global) {
  'use strict';

  class MeetLedgerDatabase {
    constructor() {
      this.dbName = 'MeetLedgerDB';
      this.dbVersion = 1;
      this.db = null;
      this.initPromise = null;
    }

    /**
     * Initializes the IndexedDB database and object stores
     */
    async init() {
      if (this.db) return this.db;
      if (this.initPromise) return this.initPromise;

      this.initPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // 1. Meetings Store
          if (!db.objectStoreNames.contains('meetings')) {
            const meetingStore = db.createObjectStore('meetings', { keyPath: 'id' });
            meetingStore.createIndex('meetingCode', 'meetingCode', { unique: false });
            meetingStore.createIndex('startedAt', 'startedAt', { unique: false });
            meetingStore.createIndex('status', 'status', { unique: false });
          }

          // 2. Participants Store (Global Identity Directory)
          if (!db.objectStoreNames.contains('participants')) {
            const participantStore = db.createObjectStore('participants', { keyPath: 'id' });
            participantStore.createIndex('enrollment', 'enrollment', { unique: false });
            participantStore.createIndex('normalizedName', 'normalizedName', { unique: false });
            participantStore.createIndex('lastAttendedAt', 'lastAttendedAt', { unique: false });
          }

          // 3. Attendance Store (Meeting-specific participant attendance records)
          if (!db.objectStoreNames.contains('attendance')) {
            const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
            attendanceStore.createIndex('meetingId', 'meetingId', { unique: false });
            attendanceStore.createIndex('participantId', 'participantId', { unique: false });
            attendanceStore.createIndex('meeting_participant', ['meetingId', 'participantId'], { unique: true });
            attendanceStore.createIndex('status', 'status', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('[MeetLedgerDB] Failed to open database:', event.target.error);
          reject(event.target.error);
        };
      });

      return this.initPromise;
    }

    /**
     * Executes a transaction on the given stores
     */
    async getStore(storeName, mode = 'readonly') {
      const db = await this.init();
      const tx = db.transaction(storeName, mode);
      return tx.objectStore(storeName);
    }

    /* =========================================================================
     * MEETINGS OPERATIONS
     * ========================================================================= */

    async saveMeeting(meeting) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings'], 'readwrite');
        const store = tx.objectStore('meetings');
        const req = store.put(meeting);
        req.onsuccess = () => resolve(meeting);
        req.onerror = () => reject(req.error);
      });
    }

    async getMeeting(meetingId) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings'], 'readonly');
        const store = tx.objectStore('meetings');
        const req = store.get(meetingId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async updateMeeting(meetingId, updates) {
      const existing = await this.getMeeting(meetingId);
      if (!existing) {
        throw new Error(`Meeting ${meetingId} not found`);
      }
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      return this.saveMeeting(updated);
    }

    async getAllMeetings({ status, search, startDate, endDate, limit = 100 } = {}) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings'], 'readonly');
        const store = tx.objectStore('meetings');
        const req = store.getAll();

        req.onsuccess = () => {
          let results = req.result || [];

          // Status filter
          if (status && status !== 'all') {
            results = results.filter(m => m.status === status);
          }

          // Search filter (title or code)
          if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            results = results.filter(m =>
              (m.title && m.title.toLowerCase().includes(q)) ||
              (m.meetingCode && m.meetingCode.toLowerCase().includes(q))
            );
          }

          // Date range filter
          if (startDate) {
            const startEpoch = new Date(startDate).getTime();
            results = results.filter(m => new Date(m.startedAt).getTime() >= startEpoch);
          }
          if (endDate) {
            const endEpoch = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1); // end of day
            results = results.filter(m => new Date(m.startedAt).getTime() <= endEpoch);
          }

          // Sort descending by startedAt
          results.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

          if (limit && limit > 0) {
            results = results.slice(0, limit);
          }

          resolve(results);
        };

        req.onerror = () => reject(req.error);
      });
    }

    async deleteMeeting(meetingId) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings', 'attendance'], 'readwrite');
        const meetingStore = tx.objectStore('meetings');
        const attendanceStore = tx.objectStore('attendance');

        // Delete meeting
        meetingStore.delete(meetingId);

        // Cascade delete attendance records
        const attIndex = attendanceStore.index('meetingId');
        const attReq = attIndex.getAllKeys(meetingId);

        attReq.onsuccess = () => {
          const keys = attReq.result || [];
          keys.forEach(k => attendanceStore.delete(k));
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    /* =========================================================================
     * ATTENDANCE OPERATIONS
     * ========================================================================= */

    async saveAttendanceRecord(record) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
      });
    }

    async saveAttendanceBatch(records) {
      if (!Array.isArray(records) || records.length === 0) return true;
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');

        records.forEach(rec => store.put(rec));

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    async getMeetingAttendance(meetingId) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['attendance'], 'readonly');
        const store = tx.objectStore('attendance');
        const index = store.index('meetingId');
        const req = index.getAll(meetingId);

        req.onsuccess = () => {
          const records = req.result || [];
          // Sort by enrollment or name
          records.sort((a, b) => {
            if (a.enrollment && b.enrollment) return a.enrollment.localeCompare(b.enrollment);
            if (a.enrollment) return -1;
            if (b.enrollment) return 1;
            return (a.name || '').localeCompare(b.name || '');
          });
          resolve(records);
        };

        req.onerror = () => reject(req.error);
      });
    }

    /* =========================================================================
     * PARTICIPANTS OPERATIONS (Global Identity Directory)
     * ========================================================================= */

    async saveParticipant(participant) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['participants'], 'readwrite');
        const store = tx.objectStore('participants');
        const req = store.put(participant);
        req.onsuccess = () => resolve(participant);
        req.onerror = () => reject(req.error);
      });
    }

    async getParticipant(participantId) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['participants'], 'readonly');
        const store = tx.objectStore('participants');
        const req = store.get(participantId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async getAllParticipants({ search, limit = 500 } = {}) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['participants'], 'readonly');
        const store = tx.objectStore('participants');
        const req = store.getAll();

        req.onsuccess = () => {
          let list = req.result || [];

          if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p =>
              (p.name && p.name.toLowerCase().includes(q)) ||
              (p.enrollment && p.enrollment.toLowerCase().includes(q))
            );
          }

          // Sort by name or enrollment
          list.sort((a, b) => {
            if (a.enrollment && b.enrollment) return a.enrollment.localeCompare(b.enrollment);
            return (a.name || '').localeCompare(b.name || '');
          });

          if (limit && limit > 0) {
            list = list.slice(0, limit);
          }

          resolve(list);
        };

        req.onerror = () => reject(req.error);
      });
    }

    async updateParticipant(participantId, updates) {
      const existing = await this.getParticipant(participantId);
      if (!existing) {
        throw new Error(`Participant ${participantId} not found`);
      }
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      await this.saveParticipant(updated);

      // If enrollment or name changed, also update all attendance records for this participant
      if (updates.name || updates.enrollment) {
        const db = await this.init();
        const tx = db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        const index = store.index('participantId');
        const req = index.getAll(participantId);

        req.onsuccess = () => {
          const records = req.result || [];
          records.forEach(r => {
            if (updates.name) r.name = updates.name;
            if (updates.enrollment !== undefined) r.enrollment = updates.enrollment;
            store.put(r);
          });
        };
      }

      return updated;
    }

    /**
     * Merges source participant into target participant
     * Re-links all attendance records from source to target, recalculates stats, and removes source.
     */
    async mergeParticipants(sourceId, targetId) {
      if (sourceId === targetId) return false;
      const db = await this.init();

      const source = await this.getParticipant(sourceId);
      const target = await this.getParticipant(targetId);
      if (!source || !target) {
        throw new Error('Source or target participant not found');
      }

      return new Promise((resolve, reject) => {
        const tx = db.transaction(['participants', 'attendance'], 'readwrite');
        const pStore = tx.objectStore('participants');
        const aStore = tx.objectStore('attendance');
        const attIndex = aStore.index('participantId');

        const attReq = attIndex.getAll(sourceId);

        attReq.onsuccess = () => {
          const sourceRecords = attReq.result || [];

          sourceRecords.forEach(rec => {
            // Delete old record
            aStore.delete(rec.id);

            // Re-point to target
            rec.participantId = targetId;
            rec.name = target.name;
            rec.enrollment = target.enrollment;
            rec.id = `att_${rec.meetingId}_${targetId}`;
            aStore.put(rec);
          });

          // Delete source participant
          pStore.delete(sourceId);
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    /**
     * Retrieves all meetings attended by a given participant
     */
    async getParticipantHistory(participantId) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['attendance', 'meetings'], 'readonly');
        const aStore = tx.objectStore('attendance');
        const mStore = tx.objectStore('meetings');
        const attIndex = aStore.index('participantId');

        const req = attIndex.getAll(participantId);

        req.onsuccess = async () => {
          const attendanceList = req.result || [];
          const history = [];

          for (const att of attendanceList) {
            const mReq = mStore.get(att.meetingId);
            await new Promise(res => {
              mReq.onsuccess = () => {
                const meeting = mReq.result;
                history.push({
                  attendance: att,
                  meeting: meeting || { id: att.meetingId, title: 'Unknown Meeting', startedAt: att.firstJoinedAt }
                });
                res();
              };
              mReq.onerror = () => res();
            });
          }

          // Sort newest to oldest
          history.sort((a, b) => new Date(b.attendance.firstJoinedAt).getTime() - new Date(a.attendance.firstJoinedAt).getTime());
          resolve(history);
        };

        req.onerror = () => reject(req.error);
      });
    }

    /* =========================================================================
     * GLOBAL DASHBOARD ANALYTICS & STATS
     * ========================================================================= */

    async getDashboardMetrics() {
      const meetings = await this.getAllMeetings({ limit: 1000 });
      const participants = await this.getAllParticipants({ limit: 5000 });

      let totalMeetings = meetings.length;
      let totalUniqueParticipants = participants.length;
      let totalMeetingSeconds = 0;
      let activeMeetings = 0;

      meetings.forEach(m => {
        if (m.status === 'ongoing') activeMeetings++;
        totalMeetingSeconds += Number(m.durationSeconds || 0);
      });

      // Calculate attendance records and average attendance %
      const db = await this.init();
      const attendanceCount = await new Promise((res) => {
        const tx = db.transaction(['attendance'], 'readonly');
        const req = tx.objectStore('attendance').count();
        req.onsuccess = () => res(req.result || 0);
        req.onerror = () => res(0);
      });

      let avgAttendancePct = 0;
      if (totalMeetings > 0) {
        let pctSum = 0;
        let count = 0;
        meetings.forEach(m => {
          if (m.averageAttendancePercentage !== undefined) {
            pctSum += Number(m.averageAttendancePercentage || 0);
            count++;
          }
        });
        avgAttendancePct = count > 0 ? Math.round((pctSum / count) * 10) / 10 : 0;
      }

      return {
        totalMeetings,
        totalUniqueParticipants,
        totalAttendanceRecords: attendanceCount,
        averageAttendancePercentage: avgAttendancePct,
        totalMeetingHours: Math.round((totalMeetingSeconds / 3600) * 10) / 10,
        activeMeetings
      };
    }

    /* =========================================================================
     * BACKUP & RESTORE
     * ========================================================================= */

    async exportFullDatabase() {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings', 'participants', 'attendance'], 'readonly');
        const mReq = tx.objectStore('meetings').getAll();
        const pReq = tx.objectStore('participants').getAll();
        const aReq = tx.objectStore('attendance').getAll();

        tx.oncomplete = () => {
          resolve({
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            app: 'MeetLedger',
            data: {
              meetings: mReq.result || [],
              participants: pReq.result || [],
              attendance: aReq.result || []
            }
          });
        };

        tx.onerror = () => reject(tx.error);
      });
    }

    async importDatabaseBackup(backupData, replaceExisting = false) {
      if (!backupData || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings', 'participants', 'attendance'], 'readwrite');
        const mStore = tx.objectStore('meetings');
        const pStore = tx.objectStore('participants');
        const aStore = tx.objectStore('attendance');

        if (replaceExisting) {
          mStore.clear();
          pStore.clear();
          aStore.clear();
        }

        const { meetings = [], participants = [], attendance = [] } = backupData.data;

        meetings.forEach(m => mStore.put(m));
        participants.forEach(p => pStore.put(p));
        attendance.forEach(a => aStore.put(a));

        tx.oncomplete = () => resolve({
          meetingsImported: meetings.length,
          participantsImported: participants.length,
          attendanceImported: attendance.length
        });

        tx.onerror = () => reject(tx.error);
      });
    }

    async clearAllData() {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['meetings', 'participants', 'attendance'], 'readwrite');
        tx.objectStore('meetings').clear();
        tx.objectStore('participants').clear();
        tx.objectStore('attendance').clear();

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  const instance = new MeetLedgerDatabase();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = instance;
  }
  global.MeetLedgerDB = instance;
})(typeof self !== 'undefined' ? self : this);

