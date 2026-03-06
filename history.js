// History Page Logic
class HistoryManager {
  constructor() {
    this.captures = [];
    this.filteredCaptures = [];
    this.init();
  }

  async init() {
    await this.loadCaptures();
    this.attachEventListeners();
    this.render();
  }

  async loadCaptures() {
    const { captureHistory = [] } = await chrome.storage.local.get(['captureHistory']);
    this.captures = captureHistory;
    this.filteredCaptures = [...captureHistory];
    this.updateStats();
  }

  attachEventListeners() {
    document.getElementById('formatFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('modeFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
    
    document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAll());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
    document.getElementById('backBtn').addEventListener('click', () => window.close());
  }

  applyFilters() {
    const formatFilter = document.getElementById('formatFilter').value;
    const modeFilter = document.getElementById('modeFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    this.filteredCaptures = this.captures.filter(capture => {
      const matchFormat = formatFilter === 'all' || capture.format === formatFilter;
      const matchMode = modeFilter === 'all' || capture.mode === modeFilter;
      const matchSearch = !searchTerm || 
        capture.title.toLowerCase().includes(searchTerm) ||
        capture.url.toLowerCase().includes(searchTerm);

      return matchFormat && matchMode && matchSearch;
    });

    this.render();
  }

  updateStats() {
    const totalCaptures = this.captures.length;
    const syncedCaptures = this.captures.filter(c => c.synced).length;
    
    // Estimate total size (approximate)
    const totalSize = this.captures.reduce((sum, capture) => {
      const base64Length = capture.dataUrl.length - 'data:image/png;base64,'.length;
      const sizeInBytes = (base64Length * 3) / 4;
      return sum + sizeInBytes;
    }, 0);

    document.getElementById('totalCaptures').textContent = totalCaptures;
    document.getElementById('totalSize').textContent = (totalSize / (1024 * 1024)).toFixed(2) + ' MB';
    document.getElementById('syncedCaptures').textContent = syncedCaptures;
  }

  render() {
    const loading = document.getElementById('loading');
    const grid = document.getElementById('capturesGrid');
    const emptyState = document.getElementById('emptyState');

    loading.style.display = 'none';

    if (this.filteredCaptures.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = '';

    this.filteredCaptures.forEach(capture => {
      const card = this.createCaptureCard(capture);
      grid.appendChild(card);
    });
  }

  createCaptureCard(capture) {
    const card = document.createElement('div');
    card.className = 'capture-card';
    
    const date = new Date(capture.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

    card.innerHTML = `
      <img src="${capture.dataUrl}" alt="${capture.title}" class="capture-image">
      <div class="capture-info">
        <div class="capture-title" title="${capture.title}">${capture.title}</div>
        <div class="capture-meta">
          <div>📅 ${formattedDate}</div>
          <div>📐 ${capture.mode} • ${capture.format.toUpperCase()}</div>
          <div>🔗 <a href="${capture.url}" target="_blank" style="color: #667eea; text-decoration: none;">${new URL(capture.url).hostname}</a></div>
        </div>
        <div class="capture-actions">
          <button onclick="historyManager.viewCapture(${capture.id})" title="View">👁️</button>
          <button onclick="historyManager.downloadCapture(${capture.id})" title="Download">⬇️</button>
          <button onclick="historyManager.shareCapture(${capture.id})" title="Share">🔗</button>
          <button onclick="historyManager.deleteCapture(${capture.id})" title="Delete">🗑️</button>
        </div>
      </div>
    `;

    return card;
  }

  viewCapture(id) {
    const capture = this.captures.find(c => c.id === id);
    if (capture) {
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
          <head>
            <title>${capture.title}</title>
            <style>
              body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              img { max-width: 100%; max-height: 100vh; }
            </style>
          </head>
          <body>
            <img src="${capture.dataUrl}" alt="${capture.title}">
          </body>
        </html>
      `);
    }
  }

  async downloadCapture(id) {
    const capture = this.captures.find(c => c.id === id);
    if (capture) {
      const link = document.createElement('a');
      link.href = capture.dataUrl;
      link.download = `${capture.title.replace(/[^a-z0-9]/gi, '_')}.${capture.format}`;
      link.click();
    }
  }

  async shareCapture(id) {
    const capture = this.captures.find(c => c.id === id);
    if (capture) {
      // In production, this would upload to cloud and generate share link
      const shareUrl = capture.url;
      
      if (navigator.share) {
        await navigator.share({
          title: capture.title,
          text: 'Check out this capture',
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('URL copied to clipboard!');
      }
    }
  }

  async deleteCapture(id) {
    if (confirm('Delete this capture?')) {
      this.captures = this.captures.filter(c => c.id !== id);
      await chrome.storage.local.set({ captureHistory: this.captures });
      await this.loadCaptures();
      this.applyFilters();
    }
  }

  async exportAll() {
    // Export all captures as JSON
    const data = JSON.stringify(this.captures, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `capture-history-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  async clearHistory() {
    if (confirm('Clear all capture history? This cannot be undone.')) {
      await chrome.storage.local.set({ captureHistory: [] });
      await this.loadCaptures();
      this.render();
    }
  }
}

// Initialize
const historyManager = new HistoryManager();
