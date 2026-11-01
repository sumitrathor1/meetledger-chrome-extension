/**
 * MeetLedger - Dashboard Participants Directory Module
 * Global identity management, enrollment correction, identity merging, and attendance history.
 */

(function (global) {
  'use strict';

  let participantsCache = [];

  const ParticipantsModule = {
    /**
     * Initializes participants page listeners
     */
    init() {
      const searchInput = document.getElementById('participants-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', () => this.loadParticipants());
      }

      // Merge Modal Open
      const btnOpenMerge = document.getElementById('btn-merge-participants-modal');
      if (btnOpenMerge) {
        btnOpenMerge.addEventListener('click', () => this.openMergeModal());
      }

      // Merge Confirmation
      const btnConfirmMerge = document.getElementById('btn-confirm-merge');
      if (btnConfirmMerge) {
        btnConfirmMerge.addEventListener('click', () => this.executeMerge());
      }

      // Edit Participant Save
      const btnSaveParticipant = document.getElementById('btn-save-participant');
      if (btnSaveParticipant) {
        btnSaveParticipant.addEventListener('click', () => this.saveParticipantEdit());
      }
    },

    /**
     * Loads participants directory
     */
    async loadParticipants() {
      const tbody = document.getElementById('tbody-global-participants');
      if (!tbody) return;

      const searchInput = document.getElementById('participants-search-input');
      const search = (searchInput ? searchInput.value : '').trim();

      try {
        const participants = await global.MeetLedgerDB.getAllParticipants({ search, limit: 500 });
        participantsCache = participants;

        if (participants.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center">No participants recorded yet.</td></tr>';
          return;
        }

        const timeUtils = global.MeetLedgerTimeUtils;
        let html = '';

        participants.forEach(p => {
          const enr = p.enrollment ? `<strong class="code-pill">${p.enrollment}</strong>` : '<span class="text-muted">Not Set</span>';
          const lastDate = p.lastAttendedAt ? (timeUtils ? timeUtils.formatDate(p.lastAttendedAt, 'readable') : p.lastAttendedAt.slice(0, 10)) : '-';
          const attended = p.totalMeetingsAttended || 1;

          html += `
            <tr>
              <td>${enr}</td>
              <td><strong>${p.name || 'Anonymous'}</strong></td>
              <td><span class="code-pill">${attended} ${attended === 1 ? 'meeting' : 'meetings'}</span></td>
              <td>${lastDate}</td>
              <td class="text-right">
                <button class="btn btn-secondary btn-sm" onclick="MeetLedgerParticipants.openEditModal('${p.id}')">
                  Edit
                </button>
                <button class="btn btn-secondary btn-sm" onclick="MeetLedgerParticipants.viewHistory('${p.id}')">
                  History
                </button>
              </td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
      } catch (e) {
        console.error('Error loading participants:', e);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading participants.</td></tr>';
      }
    },

    /**
     * Opens Edit Participant Modal
     */
    async openEditModal(participantId) {
      const p = await global.MeetLedgerDB.getParticipant(participantId);
      if (!p) return;

      const modal = document.getElementById('modal-edit-participant');
      const idInput = document.getElementById('edit-participant-id');
      const enrInput = document.getElementById('edit-participant-enrollment');
      const nameInput = document.getElementById('edit-participant-name');

      if (modal && idInput && enrInput && nameInput) {
        idInput.value = p.id;
        enrInput.value = p.enrollment || '';
        nameInput.value = p.name || '';
        modal.classList.remove('hidden');
      }
    },

    /**
     * Saves changes to participant identity
     */
    async saveParticipantEdit() {
      const id = document.getElementById('edit-participant-id').value;
      const enrollment = document.getElementById('edit-participant-enrollment').value.trim();
      const name = document.getElementById('edit-participant-name').value.trim();
      const modal = document.getElementById('modal-edit-participant');

      if (!id || !name) {
        alert('Participant name cannot be empty.');
        return;
      }

      try {
        await global.MeetLedgerDB.updateParticipant(id, { enrollment, name });
        if (modal) modal.classList.add('hidden');
        global.MeetLedgerDashboard.showToast('Participant identity updated.');
        this.loadParticipants();
      } catch (e) {
        console.error('Failed to update participant:', e);
        global.MeetLedgerDashboard.showToast('Update failed.');
      }
    },

    /**
     * Opens Merge Modal and populates participant dropdowns
     */
    openMergeModal() {
      const modal = document.getElementById('modal-merge-participants');
      const sourceSelect = document.getElementById('merge-source-select');
      const targetSelect = document.getElementById('merge-target-select');

      if (!modal || !sourceSelect || !targetSelect) return;

      let options = '';
      participantsCache.forEach(p => {
        const label = p.enrollment ? `[${p.enrollment}] ${p.name}` : `${p.name} (No Roll)`;
        options += `<option value="${p.id}">${label}</option>`;
      });

      sourceSelect.innerHTML = options;
      targetSelect.innerHTML = options;

      modal.classList.remove('hidden');
    },

    /**
     * Executes merge operation
     */
    async executeMerge() {
      const sourceId = document.getElementById('merge-source-select').value;
      const targetId = document.getElementById('merge-target-select').value;
      const modal = document.getElementById('modal-merge-participants');

      if (sourceId === targetId) {
        alert('Source and target participants must be different.');
        return;
      }

      if (!confirm('Are you sure you want to merge these identities? All attendance history from the source identity will be combined into the target identity.')) {
        return;
      }

      try {
        await global.MeetLedgerDB.mergeParticipants(sourceId, targetId);
        if (modal) modal.classList.add('hidden');
        global.MeetLedgerDashboard.showToast('Participants merged successfully.');
        this.loadParticipants();
      } catch (e) {
        console.error('Merge error:', e);
        global.MeetLedgerDashboard.showToast('Failed to merge participants.');
      }
    },

    /**
     * Views cross-meeting history for a student
     */
    async viewHistory(participantId) {
      try {
        const history = await global.MeetLedgerDB.getParticipantHistory(participantId);
        const p = await global.MeetLedgerDB.getParticipant(participantId);
        const name = p ? p.name : 'Participant';

        if (history.length === 0) {
          alert(`No meeting history found for ${name}.`);
          return;
        }

        const timeUtils = global.MeetLedgerTimeUtils;
        let msg = `Attendance History for: ${name}\n\n`;

        history.forEach((h, idx) => {
          const m = h.meeting;
          const a = h.attendance;
          const date = timeUtils ? timeUtils.formatDate(m.startedAt, 'readable') : (m.startedAt || '').slice(0, 10);
          const dur = timeUtils ? timeUtils.formatDuration(a.totalDurationSeconds) : `${a.totalDurationSeconds}s`;
          msg += `${idx + 1}. ${m.title || 'Meeting'} (${date})\n   Duration: ${dur} | Status: ${(a.status || 'present').toUpperCase()} | Pct: ${a.attendancePercentage || 0}%\n\n`;
        });

        alert(msg);
      } catch (e) {
        console.error('History view error:', e);
      }
    }
  };

  global.MeetLedgerParticipants = ParticipantsModule;
})(typeof window !== 'undefined' ? window : this);

