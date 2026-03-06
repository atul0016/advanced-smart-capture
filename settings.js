// Settings Page Logic
class SettingsManager {
  constructor() {
    this.defaultSettings = {
      defaultFormat: 'png',
      defaultQuality: 0.92,
      defaultResolution: 1,
      autoCaptureDelay: 0,
      autoSync: false,
      cloudProvider: 'none',
      showNotifications: true,
      smoothScroll: true,
      autoRemovePopups: false,
      includeUrl: true,
      historyLimit: 50,
      autoDeleteDays: 0
    };

    this.settings = { ...this.defaultSettings };
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.attachEventListeners();
  }

  async loadSettings() {
    const { settings } = await chrome.storage.local.get(['settings']);
    if (settings) {
      this.settings = { ...this.defaultSettings, ...settings };
    }
    this.applySettings();
  }

  applySettings() {
    // Apply values to UI
    document.getElementById('defaultFormat').value = this.settings.defaultFormat;
    document.getElementById('defaultQuality').value = this.settings.defaultQuality;
    document.getElementById('defaultResolution').value = this.settings.defaultResolution;
    document.getElementById('autoCaptureDelay').value = this.settings.autoCaptureDelay;
    document.getElementById('cloudProvider').value = this.settings.cloudProvider;
    document.getElementById('historyLimit').value = this.settings.historyLimit;
    document.getElementById('autoDeleteDays').value = this.settings.autoDeleteDays;

    // Apply toggles
    this.setToggle('autoSyncToggle', this.settings.autoSync);
    this.setToggle('notificationsToggle', this.settings.showNotifications);
    this.setToggle('smoothScrollToggle', this.settings.smoothScroll);
    this.setToggle('autoRemovePopupsToggle', this.settings.autoRemovePopups);
    this.setToggle('includeUrlToggle', this.settings.includeUrl);
  }

  setToggle(id, active) {
    const toggle = document.getElementById(id);
    if (active) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }

  attachEventListeners() {
    // Regular inputs
    document.getElementById('defaultFormat').addEventListener('change', (e) => {
      this.settings.defaultFormat = e.target.value;
    });

    document.getElementById('defaultQuality').addEventListener('change', (e) => {
      this.settings.defaultQuality = parseFloat(e.target.value);
    });

    document.getElementById('defaultResolution').addEventListener('change', (e) => {
      this.settings.defaultResolution = parseInt(e.target.value);
    });

    document.getElementById('autoCaptureDelay').addEventListener('input', (e) => {
      this.settings.autoCaptureDelay = parseInt(e.target.value) || 0;
    });

    document.getElementById('cloudProvider').addEventListener('change', (e) => {
      this.settings.cloudProvider = e.target.value;
    });

    document.getElementById('historyLimit').addEventListener('input', (e) => {
      this.settings.historyLimit = parseInt(e.target.value) || 50;
    });

    document.getElementById('autoDeleteDays').addEventListener('input', (e) => {
      this.settings.autoDeleteDays = parseInt(e.target.value) || 0;
    });

    // Toggles
    this.setupToggle('autoSyncToggle', 'autoSync');
    this.setupToggle('notificationsToggle', 'showNotifications');
    this.setupToggle('smoothScrollToggle', 'smoothScroll');
    this.setupToggle('autoRemovePopupsToggle', 'autoRemovePopups');
    this.setupToggle('includeUrlToggle', 'includeUrl');

    // Action buttons
    document.getElementById('saveBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetSettings());
    document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());
    document.getElementById('backBtn').addEventListener('click', () => window.close());
  }

  setupToggle(toggleId, settingKey) {
    const toggle = document.getElementById(toggleId);
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      this.settings[settingKey] = toggle.classList.contains('active');
    });
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ settings: this.settings });
      
      // Also save to sync storage for cross-device sync
      await chrome.storage.sync.set({ 
        captureSettings: {
          defaultFormat: this.settings.defaultFormat,
          defaultQuality: this.settings.defaultQuality,
          defaultResolution: this.settings.defaultResolution
        }
      });

      this.showStatus('✓ Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('✗ Error saving settings', 'error');
    }
  }

  async resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
      this.settings = { ...this.defaultSettings };
      await chrome.storage.local.set({ settings: this.settings });
      this.applySettings();
      this.showStatus('Settings reset to defaults', 'success');
    }
  }

  async clearAllData() {
    const confirmation = prompt(
      'This will delete ALL captures and reset ALL settings.\nType "DELETE" to confirm:'
    );

    if (confirmation === 'DELETE') {
      try {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
        
        // Reinitialize with defaults
        this.settings = { ...this.defaultSettings };
        await chrome.storage.local.set({ 
          settings: this.settings,
          captureHistory: []
        });

        this.applySettings();
        this.showStatus('All data cleared successfully', 'success');
      } catch (error) {
        console.error('Error clearing data:', error);
        this.showStatus('Error clearing data', 'error');
      }
    } else if (confirmation !== null) {
      alert('Confirmation text did not match. Data not cleared.');
    }
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status show ${type}`;

    setTimeout(() => {
      status.classList.remove('show');
    }, 3000);
  }
}

// Initialize
const settingsManager = new SettingsManager();
