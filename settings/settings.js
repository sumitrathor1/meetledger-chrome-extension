/**
 * MeetLedger - Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const hostNameInput = document.getElementById('opt-host-name');
  const excludedInput = document.getElementById('opt-excluded-names');
  const timeFormatSelect = document.getElementById('opt-time-format');
  const autoTrackToggle = document.getElementById('opt-auto-track');
  const scanIntervalInput = document.getElementById('opt-scan-interval');
  const gracePeriodInput = document.getElementById('opt-grace-period');
  const lateThresholdInput = document.getElementById('opt-late-threshold');
  const patternInput = document.getElementById('opt-enrollment-pattern');
  const geminiKeyInput = document.getElementById('opt-gemini-key');
  const aiModelSelect = document.getElementById('opt-ai-model');
  const testInput = document.getElementById('opt-test-input');
  const testOutput = document.getElementById('opt-test-output');

  const btnSave = document.getElementById('opt-btn-save');
  const btnExport = document.getElementById('opt-btn-export-backup');
  const inputFile = document.getElementById('opt-input-file');
  const btnClear = document.getElementById('opt-btn-clear');
  const btnBack = document.getElementById('btn-back-dashboard');
  const toast = document.getElementById('settings-toast');

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // Load existing settings
  if (window.MeetLedgerStorage) {
    const s = await window.MeetLedgerStorage.getSettings();
    if (hostNameInput) hostNameInput.value = s.hostName || '';
    if (excludedInput) excludedInput.value = (s.excludedNames || []).join(', ');
    if (timeFormatSelect) timeFormatSelect.value = s.timeFormat || '12h';
    if (autoTrackToggle) autoTrackToggle.checked = !!s.autoTrack;
    if (scanIntervalInput) scanIntervalInput.value = s.scanInterval || 3000;
    if (gracePeriodInput) gracePeriodInput.value = s.leaveGracePeriod || 15;
    if (lateThresholdInput) lateThresholdInput.value = s.lateThresholdMinutes || 5;
    if (patternInput) patternInput.value = s.enrollmentPattern || '^([A-Z0-9]{6,16})\\s+(.+)$';
    if (geminiKeyInput) geminiKeyInput.value = s.geminiApiKey || '';
    if (aiModelSelect) aiModelSelect.value = s.aiModel || 'gemini-1.5-flash';
  }

  // Test Regex Pattern
  function updateTest() {
    if (!testInput || !testOutput || !patternInput) return;
    const val = testInput.value.trim();
    if (!val) {
      testOutput.textContent = 'Extracted: [Enrollment: -] [Name: -]';
      return;
    }
    const identity = window.MeetLedgerIdentity;
    if (identity) {
      const res = identity.extractEnrollmentAndName(val, patternInput.value);
      testOutput.textContent = `Extracted: [Enrollment: "${res.enrollment || 'None'}"] [Name: "${res.name}"]`;
    }
  }

  if (testInput) testInput.addEventListener('input', updateTest);
  if (patternInput) patternInput.addEventListener('input', updateTest);

  // Save Settings
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const excluded = (excludedInput.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const updates = {
        hostName: hostNameInput.value.trim(),
        excludedNames: excluded,
        timeFormat: timeFormatSelect.value,
        autoTrack: autoTrackToggle.checked,
        scanInterval: Math.max(1000, Number(scanIntervalInput.value) || 3000),
        leaveGracePeriod: Math.max(5, Number(gracePeriodInput.value) || 15),
        lateThresholdMinutes: Math.max(1, Number(lateThresholdInput.value) || 5),
        enrollmentPattern: patternInput.value.trim(),
        geminiApiKey: geminiKeyInput ? geminiKeyInput.value.trim() : '',
        aiModel: aiModelSelect ? aiModelSelect.value : 'gemini-1.5-flash'
      };

      if (window.MeetLedgerStorage) {
        await window.MeetLedgerStorage.saveSettings(updates);
        showToast('Settings saved successfully.');
      }
    });
  }

  // Backup Export
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      if (window.MeetLedgerDB) {
        const data = await window.MeetLedgerDB.exportFullDatabase();
        const jsonStr = JSON.stringify(data, null, 2);
        const filename = `MeetLedger_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        window.MeetLedgerExport.downloadFile(jsonStr, filename, 'application/json');
        showToast('Backup file downloaded.');
      }
    });
  }

  // Restore Backup
  if (inputFile) {
    inputFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const res = await window.MeetLedgerDB.importDatabaseBackup(parsed);
          showToast(`Backup restored: ${res.meetingsImported} meetings.`);
        } catch (err) {
          alert('Invalid backup file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Clear Data
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all stored attendance records? This cannot be undone.')) {
        if (window.MeetLedgerDB) {
          await window.MeetLedgerDB.clearAllData();
          showToast('All records deleted.');
        }
      }
    });
  }

  // Back to Dashboard
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
      } else {
        window.location.href = '../dashboard/dashboard.html';
      }
    });
  }
});

