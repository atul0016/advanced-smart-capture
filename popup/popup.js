// Popup UI Controller
class PopupController {
  constructor() {
    this.captureMode = 'fullPage';
    this.exportFormat = 'png';
    this.premiumActive = false;
    this.PAYMENT_URL = 'https://atul0016.github.io/advanced-smart-capture/pay.html';
    this.settings = {
      width: null,
      height: null,
      resolution: 2,
      quality: 1,
      darkMode: false,
      mobileView: false,
      removeAds: false,
      watermarkText: '',
      watermarkPosition: 'none'
    };

    this.init();
  }

  async init() {
    await this.checkPremiumStatus();
    this.loadSettings();
    this.attachEventListeners();
    this.updatePremiumUI();
    this.listenForPaymentSuccess();
  }

  attachEventListeners() {
    // Capture Mode Buttons — all premium
    document.getElementById('fullPageBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.setCaptureMode('fullPage');
    });
    document.getElementById('visibleAreaBtn').addEventListener('click', () => this.setCaptureMode('visible'));
    document.getElementById('selectionBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.setCaptureMode('selection');
    });
    document.getElementById('elementBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.setCaptureMode('element');
    });

    // Format Buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fmt = e.currentTarget.dataset.format;
        if ((fmt === 'jpg' || fmt === 'pdf') && !this.premiumActive) {
          return this.showUpgradePrompt();
        }
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.exportFormat = fmt;
      });
    });

    // Settings Inputs
    document.getElementById('width').addEventListener('input', (e) => {
      if (!this.premiumActive) { e.target.value = ''; return this.showUpgradePrompt(); }
      this.settings.width = e.target.value ? parseInt(e.target.value) : null;
    });

    document.getElementById('height').addEventListener('input', (e) => {
      if (!this.premiumActive) { e.target.value = ''; return this.showUpgradePrompt(); }
      this.settings.height = e.target.value ? parseInt(e.target.value) : null;
    });

    document.getElementById('resolution').addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 1 && !this.premiumActive) {
        e.target.value = '1';
        return this.showUpgradePrompt();
      }
      this.settings.resolution = val;
    });

    document.getElementById('quality').addEventListener('change', (e) => {
      this.settings.quality = parseFloat(e.target.value);
    });

    document.getElementById('darkMode').addEventListener('change', (e) => {
      if (!this.premiumActive) { e.target.checked = false; return this.showUpgradePrompt(); }
      this.settings.darkMode = e.target.checked;
    });

    document.getElementById('mobileView').addEventListener('change', (e) => {
      if (!this.premiumActive) { e.target.checked = false; return this.showUpgradePrompt(); }
      this.settings.mobileView = e.target.checked;
    });

    document.getElementById('removeAds').addEventListener('change', (e) => {
      if (!this.premiumActive) { e.target.checked = false; return this.showUpgradePrompt(); }
      this.settings.removeAds = e.target.checked;
    });

    document.getElementById('watermarkText').addEventListener('input', (e) => {
      this.settings.watermarkText = e.target.value;
    });

    document.getElementById('watermarkPosition').addEventListener('change', (e) => {
      this.settings.watermarkPosition = e.target.value;
    });

    // Feature Buttons — all premium
    document.getElementById('annotateBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.openAnnotationMode();
    });
    document.getElementById('ocrBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.performOCR();
    });
    document.getElementById('copyTextBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.copyPageText();
    });
    document.getElementById('scheduleBtn').addEventListener('click', () => {
      if (!this.premiumActive) return this.showUpgradePrompt();
      this.scheduleCapture();
    });

    // Upgrade button
    document.getElementById('upgradeBtn').addEventListener('click', () => this.openPaymentPage());

    // Action Buttons
    document.getElementById('captureBtn').addEventListener('click', () => this.startCapture());
    document.getElementById('historyBtn').addEventListener('click', () => this.openHistory());
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
  }

  setCaptureMode(mode) {
    this.captureMode = mode;

    // Update button styles
    document.querySelectorAll('.capture-modes .btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });

    const modeMap = {
      'fullPage': 'fullPageBtn',
      'visible': 'visibleAreaBtn',
      'selection': 'selectionBtn',
      'element': 'elementBtn'
    };

    const activeBtn = document.getElementById(modeMap[mode]);
    activeBtn.classList.remove('btn-secondary');
    activeBtn.classList.add('btn-primary');
  }

  // ========== PREMIUM METHODS ==========

  async checkPremiumStatus() {
    try {
      const result = await chrome.storage.local.get(['ascPremiumActive']);
      this.premiumActive = result.ascPremiumActive === true;
    } catch (e) {
      this.premiumActive = false;
    }
  }

  updatePremiumUI() {
    const upgradeSection = document.getElementById('upgradeSection');
    const premiumActiveSection = document.getElementById('premiumActiveSection');
    if (upgradeSection) upgradeSection.style.display = this.premiumActive ? 'none' : 'block';
    if (premiumActiveSection) premiumActiveSection.style.display = this.premiumActive ? 'block' : 'none';

    document.querySelectorAll('.premium-feature').forEach(el => {
      el.classList.toggle('locked', !this.premiumActive);
    });
    document.querySelectorAll('.pro-badge').forEach(badge => {
      badge.style.display = this.premiumActive ? 'none' : 'inline';
    });

    // Lock resolution options above 1x for free users
    const resSelect = document.getElementById('resolution');
    if (resSelect && !this.premiumActive) {
      resSelect.value = '1';
      this.settings.resolution = 1;
    }

    // Keep visible area as active mode for free users
    if (!this.premiumActive && this.captureMode !== 'visible') {
      this.captureMode = 'visible';
      document.querySelectorAll('.capture-modes .btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      const visBtn = document.getElementById('visibleAreaBtn');
      if (visBtn) { visBtn.classList.remove('btn-secondary'); visBtn.classList.add('btn-primary'); }
    }
  }

  showUpgradePrompt() {
    this.showStatus('PRO feature — Upgrade for $2.99!', 'info');
    setTimeout(() => this.openPaymentPage(), 900);
  }

  openPaymentPage() {
    chrome.tabs.create({ url: this.PAYMENT_URL });
  }

  listenForPaymentSuccess() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.ascPremiumActive && changes.ascPremiumActive.newValue === true) {
        this.premiumActive = true;
        this.updatePremiumUI();
        this.showStatus('🎉 Premium unlocked! All features active.', 'success');
      }
    });
  }

  // ========== END PREMIUM METHODS ==========

  async startCapture() {
    this.showStatus('Preparing capture...', 'info');

    const captureData = {
      mode: this.captureMode,
      format: this.exportFormat,
      settings: this.settings
    };

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we can access the tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
        this.showStatus('Cannot capture browser internal pages', 'error');
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script/content-script.js']
        });

        // Small delay to let content script initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectError) {
        // Content script might already be injected, continue
        console.log('Content script injection:', injectError.message);
      }

      // Send message to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'startCapture',
        data: captureData
      });

      this.showStatus('Capture started!', 'success');

      // Close popup after short delay
      setTimeout(() => window.close(), 500);
    } catch (error) {
      console.error('Capture error:', error);
      if (error.message.includes('Receiving end does not exist')) {
        this.showStatus('Please refresh the page and try again', 'error');
      } else {
        this.showStatus('Error: ' + error.message, 'error');
      }
    }
  }

  async openAnnotationMode() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        this.showStatus('Cannot access browser internal pages', 'error');
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: 'openAnnotationMode'
      });
      window.close();
    } catch (error) {
      this.showStatus('Please refresh the page and try again', 'error');
    }
  }

  async performOCR() {
    this.showStatus('Extracting text...', 'info');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        this.showStatus('Cannot access browser internal pages', 'error');
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script/content-script.js']
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) { /* already injected */ }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'performOCR'
      });

      if (response && response.text) {
        // Copy via scripting to avoid popup clipboard issues
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
          },
          args: [response.text]
        });
        this.showStatus('Text extracted and copied!', 'success');
      } else {
        this.showStatus('No text found on page', 'info');
      }
    } catch (error) {
      this.showStatus('Please refresh the page and try again', 'error');
    }
  }

  async copyPageText() {
    this.showStatus('Copying text...', 'info');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        this.showStatus('Cannot access browser internal pages', 'error');
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script/content-script.js']
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) { /* already injected */ }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'copyPageText',
        removeAds: this.settings.removeAds
      });

      if (response && response.text) {
        // Copy via scripting to avoid popup clipboard issues
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
          },
          args: [response.text]
        });
        this.showStatus('Text copied to clipboard!', 'success');
      } else {
        this.showStatus('No text found on page', 'info');
      }
    } catch (error) {
      this.showStatus('Please refresh the page and try again', 'error');
    }
  }

  async scheduleCapture() {
    // Create inline schedule UI (prompt() doesn't work in extension popups)
    const existingModal = document.getElementById('schedule-modal');
    if (existingModal) { existingModal.remove(); return; }

    const modal = document.createElement('div');
    modal.id = 'schedule-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:white;border-radius:12px;padding:20px;width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 12px;font-size:14px;color:#333;">⏰ Schedule Capture</h3>
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <button class="sched-btn" data-min="5" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#f8f8f8;">5m</button>
          <button class="sched-btn" data-min="15" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#f8f8f8;">15m</button>
          <button class="sched-btn" data-min="30" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#f8f8f8;">30m</button>
          <button class="sched-btn" data-min="60" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#f8f8f8;">1h</button>
        </div>
        <div style="display:flex;gap:6px;">
          <input type="number" id="custom-mins" placeholder="Custom mins" min="1" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;">
          <button id="sched-custom" style="padding:8px 12px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;">Go</button>
        </div>
        <button id="sched-cancel" style="width:100%;margin-top:8px;padding:6px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:none;color:#999;">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);

    const doSchedule = (minutes) => {
      chrome.runtime.sendMessage({
        action: 'scheduleCapture',
        minutes: minutes,
        captureData: {
          mode: this.captureMode,
          format: this.exportFormat,
          settings: this.settings
        }
      });
      modal.remove();
      this.showStatus(`Capture scheduled in ${minutes} minutes`, 'success');
    };

    modal.querySelectorAll('.sched-btn').forEach(btn => {
      btn.addEventListener('click', () => doSchedule(parseInt(btn.dataset.min)));
    });
    document.getElementById('sched-custom').addEventListener('click', () => {
      const mins = parseInt(document.getElementById('custom-mins').value);
      if (mins > 0) doSchedule(mins);
    });
    document.getElementById('sched-cancel').addEventListener('click', () => modal.remove());
  }

  async openHistory() {
    chrome.runtime.sendMessage({ action: 'openHistory' });
    window.close();
  }

  async openSettings() {
    chrome.runtime.sendMessage({ action: 'openSettings' });
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status show ${type}`;

    setTimeout(() => {
      status.classList.remove('show');
    }, 3000);
  }

  async loadSettings() {
    const stored = await chrome.storage.sync.get(['captureSettings']);
    if (stored.captureSettings) {
      this.settings = { ...this.settings, ...stored.captureSettings };
      this.applyStoredSettings();
    }
  }

  applyStoredSettings() {
    if (this.settings.width) document.getElementById('width').value = this.settings.width;
    if (this.settings.height) document.getElementById('height').value = this.settings.height;
    document.getElementById('resolution').value = this.settings.resolution;
    document.getElementById('quality').value = this.settings.quality;
    document.getElementById('darkMode').checked = this.settings.darkMode;
    document.getElementById('mobileView').checked = this.settings.mobileView;
    document.getElementById('removeAds').checked = this.settings.removeAds;
    if (this.settings.watermarkText) document.getElementById('watermarkText').value = this.settings.watermarkText;
    document.getElementById('watermarkPosition').value = this.settings.watermarkPosition;
  }
}

// Initialize popup controller
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
