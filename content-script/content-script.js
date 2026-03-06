// Content Script - Main Capture Engine
class SmartCapture {
  constructor() {
    this.captureMode = null;
    this.settings = null;
    this.selectionOverlay = null;
    this.annotationMode = false;
    this.isInitialized = false;

    this.init();
  }

  init() {
    // Check if already initialized to prevent double initialization
    if (window.smartCaptureInitialized) {
      return;
    }
    window.smartCaptureInitialized = true;
    this.isInitialized = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sendResponse);
      return true; // Keep the message channel open for async response
    });

    console.log('Advanced Smart Capture initialized');
  }

  async handleMessage(request, sendResponse) {
    try {
      switch (request.action) {
        case 'startCapture':
          await this.startCapture(request.data);
          sendResponse({ success: true });
          break;

        case 'captureFullPage':
          await this.captureFullPage();
          sendResponse({ success: true });
          break;

        case 'captureSelection':
          this.initSelectionMode();
          sendResponse({ success: true });
          break;

        case 'captureElement':
          this.initElementMode();
          sendResponse({ success: true });
          break;

        case 'openAnnotationMode':
          await this.openAnnotationMode();
          sendResponse({ success: true });
          break;

        case 'performOCR':
          const ocrText = await this.performOCR();
          sendResponse({ text: ocrText });
          break;

        case 'copyPageText':
          const pageText = await this.extractPageText(request.removeAds);
          sendResponse({ text: pageText });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ error: error.message });
    }
  }

  async startCapture(data) {
    this.settings = data.settings;

    switch (data.mode) {
      case 'fullPage':
        await this.captureFullPage(data);
        break;
      case 'visible':
        await this.captureVisibleArea(data);
        break;
      case 'selection':
        this.initSelectionMode(data);
        break;
      case 'element':
        this.initElementMode(data);
        break;
    }
  }

  async captureFullPage(data) {
    let scrollbarStyle = null;
    const originalOverflow = { html: '', body: '' };
    const originalScroll = { x: 0, y: 0 };

    try {
      console.log('[Capture] Starting full page capture with Debugger API...');

      // Hide scrollbars (but allow scrolling) for clean capture
      const forceScrollStyleId = 'smart-capture-force-scroll';
      let forceScrollStyle = document.getElementById(forceScrollStyleId);
      if (!forceScrollStyle) {
        forceScrollStyle = document.createElement('style');
        forceScrollStyle.id = forceScrollStyleId;
        forceScrollStyle.textContent = `
          /* Hide scrollbars while keeping scroll functionality */
          ::-webkit-scrollbar {
            display: none !important;
          }
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
        `;
        document.head.appendChild(forceScrollStyle);
      }

      // Give browser time to apply styles
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get browser zoom level
      const zoomLevel = window.devicePixelRatio / (window.outerWidth / window.innerWidth) || 1;

      // CRITICAL FIX: Hide scrollbars WITHOUT preventing scrolling
      // We inject CSS to hide scrollbar appearance, but allow scroll functionality
      const scrollbarStyleId = 'smart-capture-hide-scrollbars';
      scrollbarStyle = document.getElementById(scrollbarStyleId);
      if (!scrollbarStyle) {
        scrollbarStyle = document.createElement('style');
        scrollbarStyle.id = scrollbarStyleId;
        scrollbarStyle.textContent = `
          /* Hide scrollbar for Chrome, Safari and Opera */
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          /* Hide scrollbar for IE, Edge and Firefox */
          html,
          body {
            -ms-overflow-style: none !important; /* IE and Edge */
            scrollbar-width: none !important; /* Firefox */
          }
        `;
        document.head.appendChild(scrollbarStyle);
      }

      // Save original overflow (in case page had custom overflow settings)
      originalOverflow.html = document.documentElement.style.overflow;
      originalOverflow.body = document.body.style.overflow;

      // Save current scroll position and scroll to top
      originalScroll.x = window.scrollX;
      originalScroll.y = window.scrollY;
      window.scrollTo(0, 0);

      // Wait for any layout adjustments and lazy-loaded images
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force any pending layouts to complete
      document.body.offsetHeight;

      // Get page dimensions with multiple measurement approaches
      const docBody = document.body;
      const docElement = document.documentElement;

      const fullWidth = Math.max(
        docBody.scrollWidth || 0,
        docBody.offsetWidth || 0,
        docElement.clientWidth || 0,
        docElement.scrollWidth || 0,
        docElement.offsetWidth || 0
      );

      const fullHeight = Math.max(
        docBody.scrollHeight || 0,
        docBody.offsetHeight || 0,
        docElement.clientHeight || 0,
        docElement.scrollHeight || 0,
        docElement.offsetHeight || 0
      );

      // Sanity check - height should be at least viewport height
      const minHeight = window.innerHeight;
      const finalHeight = Math.max(fullHeight, minHeight);

      console.log(`Capturing page: ${fullWidth}x${finalHeight} (Viewport: ${window.innerWidth}x${window.innerHeight}, Zoom: ${zoomLevel.toFixed(2)})`);

      // Check if page is too large (memory safety)
      const maxHeight = 50000; // Max 50000px height
      if (finalHeight > maxHeight) {
        throw new Error(`Page too large (${finalHeight}px). Maximum: ${maxHeight}px`);
      }

      // Request background script to capture using scroll method
      const response = await chrome.runtime.sendMessage({
        action: 'captureFullPage',
        data: {
          fullWidth,
          fullHeight: finalHeight,  // Use the validated height
          format: data.format,
          settings: this.settings,
          url: window.location.href,
          title: document.title,
          mode: data.mode
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      this.showNotification('✓ Full page captured successfully!', 'success');
    } catch (error) {
      const errorMsg = error.message || 'Unknown error occurred';
      this.showNotification('✗ Capture failed: ' + errorMsg, 'error');
      console.error('Capture error:', error);
    } finally {
      // Always clean up, even if there was an error
      console.log('[Capture] Restoring page state...');

      // Remove scrollbar hiding style
      const forceScrollStyle = document.getElementById('smart-capture-force-scroll');
      if (forceScrollStyle && forceScrollStyle.parentNode) {
        forceScrollStyle.remove();
      }

      // Restore original overflow if it was set
      if (originalOverflow.html) {
        document.documentElement.style.overflow = originalOverflow.html;
      }
      if (originalOverflow.body) {
        document.body.style.overflow = originalOverflow.body;
      }

      // Restore scroll position
      if (originalScroll.x !== undefined || originalScroll.y !== undefined) {
        window.scrollTo(originalScroll.x, originalScroll.y);
      }
    }
  }

  async captureVisibleArea(data) {
    try {
      // Request background script to capture visible area
      const response = await chrome.runtime.sendMessage({
        action: 'captureVisibleArea',
        data: {
          format: data.format,
          settings: this.settings,
          url: window.location.href,
          title: document.title,
          mode: data.mode
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      this.showNotification('✓ Visible area captured!', 'success');
    } catch (error) {
      const errorMsg = error.message || 'Unknown error occurred';
      this.showNotification('✗ Capture failed: ' + errorMsg, 'error');
      console.error('Capture error:', error);
    }
  }

  initSelectionMode(data) {
    this.captureData = data;

    // Create selection overlay
    this.selectionOverlay = document.createElement('div');
    this.selectionOverlay.id = 'smart-capture-selection';
    this.selectionOverlay.innerHTML = `
      <div class="selection-instructions">
        Click and drag to select area. Press ESC to cancel.
      </div>
      <div class="selection-box"></div>
    `;
    document.body.appendChild(this.selectionOverlay);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #smart-capture-selection {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 2147483647;
        cursor: crosshair;
      }
      .selection-instructions {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #667eea;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      .selection-box {
        position: absolute;
        border: 2px solid #667eea;
        background: rgba(102, 126, 234, 0.1);
        display: none;
      }
    `;
    document.head.appendChild(style);

    // Handle selection
    this.handleSelectionDrag();
  }

  handleSelectionDrag() {
    let startX, startY, selectionBox;
    const overlay = this.selectionOverlay;
    selectionBox = overlay.querySelector('.selection-box');

    const onMouseDown = (e) => {
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      selectionBox.style.display = 'block';
    };

    const onMouseMove = (e) => {
      if (selectionBox.style.display === 'none') return;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    };

    const onMouseUp = async (e) => {
      const rect = selectionBox.getBoundingClientRect();
      overlay.remove();

      if (rect.width > 10 && rect.height > 10) {
        await this.captureArea(rect, this.captureData);
      }

      // Cleanup
      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mouseup', onMouseUp);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
      }
    };

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }

  async captureArea(rect, data) {
    try {
      // Convert viewport-relative rect to page coordinates
      const pageRect = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };

      // Send to background script to capture using Debugger API
      // No loading indicator — it would appear in the screenshot!
      const response = await chrome.runtime.sendMessage({
        action: 'captureArea',
        data: {
          rect: pageRect,
          format: data?.format || 'png',
          settings: this.settings,
          url: window.location.href,
          title: document.title,
          mode: data?.mode || 'selection'
        }
      });

      if (response && response.error) {
        throw new Error(response.error);
      }

      this.showNotification('✓ Area captured!', 'success');
    } catch (error) {
      this.showNotification('✗ Capture failed: ' + error.message, 'error');
      console.error('Capture area error:', error);
    }
  }

  initElementMode(data) {
    this.captureData = data;
    this.showNotification('Hover over elements and click to capture', 'info');

    let highlightedElement = null;
    const highlightStyle = document.createElement('style');
    highlightStyle.textContent = `
      .smart-capture-highlight {
        outline: 3px solid #667eea !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(highlightStyle);

    const onMouseOver = (e) => {
      if (highlightedElement) {
        highlightedElement.classList.remove('smart-capture-highlight');
      }
      e.target.classList.add('smart-capture-highlight');
      highlightedElement = e.target;
    };

    const onClick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const element = e.target;
      element.classList.remove('smart-capture-highlight');

      // Cleanup listeners
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown);
      highlightStyle.remove();

      // Capture element
      const rect = element.getBoundingClientRect();
      await this.captureArea(rect, this.captureData);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (highlightedElement) {
          highlightedElement.classList.remove('smart-capture-highlight');
        }
        document.removeEventListener('mouseover', onMouseOver);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown);
        highlightStyle.remove();
        this.showNotification('Element capture cancelled', 'info');
      }
    };

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown);
  }

  async captureWithStitching(fullWidth, fullHeight) {
    const canvas = document.createElement('canvas');
    const resolution = this.settings.resolution || 1;

    canvas.width = fullWidth * resolution;
    canvas.height = fullHeight * resolution;

    const ctx = canvas.getContext('2d');
    ctx.scale(resolution, resolution);

    // Use a library like html2canvas conceptually
    // For this implementation, we'll use a simplified approach
    await this.renderToCanvas(canvas, document.documentElement, {
      x: 0,
      y: 0,
      width: fullWidth,
      height: fullHeight
    });

    return canvas;
  }

  async renderToCanvas(canvas, element, viewport) {
    // This is a simplified render function
    // In production, you'd use html2canvas or similar library
    const ctx = canvas.getContext('2d');

    // For now, capture using background image approach
    // In a real implementation, this would recursively render all elements
    const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${element.outerHTML}
        </div>
      </foreignObject>
    </svg>`;

    const img = new Image();
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  applyWatermark(canvas, text, position) {
    const ctx = canvas.getContext('2d');
    const fontSize = Math.max(16, canvas.width * 0.02);

    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;

    const metrics = ctx.measureText(text);
    const padding = 20;
    let x, y;

    switch (position) {
      case 'top-left':
        x = padding;
        y = padding + fontSize;
        break;
      case 'top-right':
        x = canvas.width - metrics.width - padding;
        y = padding + fontSize;
        break;
      case 'bottom-left':
        x = padding;
        y = canvas.height - padding;
        break;
      case 'bottom-right':
        x = canvas.width - metrics.width - padding;
        y = canvas.height - padding;
        break;
    }

    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  async exportCanvas(canvas, format, quality) {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    return canvas.toDataURL(mimeType, quality);
  }

  applyDarkMode() {
    document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)';
    document.querySelectorAll('img, video, [style*="background-image"]').forEach(el => {
      el.style.filter = 'invert(1) hue-rotate(180deg)';
    });
  }

  applyMobileView() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=375px');
    }
    document.body.style.width = '375px';
  }

  async extractPageText(removeAds) {
    // Clone body to avoid modifying the actual page
    const clone = document.body.cloneNode(true);

    if (removeAds) {
      // Remove common ad containers by selector
      const adSelectors = [
        '[class*="ad-"]', '[class*="ad_"]', '[class*="ads-"]', '[class*="ads_"]',
        '[id*="ad-"]', '[id*="ad_"]', '[id*="ads-"]', '[id*="ads_"]',
        '[class*="banner"]', '[class*="sponsor"]', '[class*="promo"]',
        'iframe[src*="ad"]', 'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
        '[data-ad]', '[data-ads]', '[data-ad-slot]', '.adsbygoogle',
        'ins.adsbygoogle', '[class*="cookie"]', '[id*="cookie"]',
        'nav', 'footer', 'aside'
      ];
      adSelectors.forEach(sel => {
        try { clone.querySelectorAll(sel).forEach(el => el.remove()); } catch (e) { }
      });
    }

    // Remove script and style tags
    clone.querySelectorAll('script, style, noscript, svg').forEach(el => el.remove());

    let text = clone.innerText || clone.textContent || '';
    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    return text;
  }

  async performOCR() {
    // Extract visible text from the page using DOM analysis
    // This works without Tesseract.js by extracting text from visible elements
    try {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) {
              return NodeFilter.FILTER_REJECT;
            }
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return NodeFilter.FILTER_REJECT;
            }
            const rect = parent.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT;
            const text = node.textContent.trim();
            if (!text) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textParts = [];
      let currentNode;
      while (currentNode = walker.nextNode()) {
        const text = currentNode.textContent.trim();
        if (text) textParts.push(text);
      }

      const extractedText = textParts.join(' ').replace(/\s+/g, ' ').trim();
      if (!extractedText) {
        return 'No visible text found on this page.';
      }
      return extractedText;
    } catch (error) {
      console.error('OCR extraction error:', error);
      return 'Failed to extract text: ' + error.message;
    }
  }

  async openAnnotationMode() {
    // Capture the FULL page first, then open annotation canvas on top
    this.showNotification('Capturing full page for annotation...', 'info');
    try {
      // Get page dimensions for full page capture
      const body = document.body;
      const html = document.documentElement;
      const fullWidth = window.innerWidth;
      const fullHeight = Math.max(
        body.scrollHeight || 0, body.offsetHeight || 0,
        html.clientHeight || 0, html.scrollHeight || 0, html.offsetHeight || 0
      );

      const response = await chrome.runtime.sendMessage({
        action: 'captureFullPageForAnnotation',
        data: {
          fullWidth,
          fullHeight,
          format: 'png',
          settings: this.settings || { quality: 1 },
          url: window.location.href,
          title: document.title,
          mode: 'annotation'
        }
      });

      if (response && response.dataUrl) {
        this.openAnnotationCanvas(response.dataUrl);
      } else if (response && response.error) {
        throw new Error(response.error);
      } else {
        throw new Error('No image data returned');
      }
    } catch (error) {
      console.error('Annotation mode error:', error);
      this.showNotification('Failed to start annotation mode: ' + error.message, 'error');
    }
  }

  openAnnotationCanvas(imageDataUrl) {
    // Remove existing annotation canvas if any
    const existing = document.getElementById('smart-capture-annotation');
    if (existing) existing.remove();

    // Create fullscreen annotation overlay
    const overlay = document.createElement('div');
    overlay.id = 'smart-capture-annotation';
    overlay.innerHTML = `
      <div class="annotation-toolbar">
        <button data-tool="pen" class="ann-btn active" title="Pen">✏️</button>
        <button data-tool="rect" class="ann-btn" title="Rectangle">⬜</button>
        <button data-tool="arrow" class="ann-btn" title="Arrow">➡️</button>
        <button data-tool="text" class="ann-btn" title="Text">T</button>
        <button data-tool="highlight" class="ann-btn" title="Highlight">🖍️</button>
        <span class="ann-separator"></span>
        <input type="color" id="ann-color" value="#ff0000" title="Color">
        <select id="ann-size" title="Size">
          <option value="2">Thin</option>
          <option value="4" selected>Medium</option>
          <option value="8">Thick</option>
        </select>
        <span class="ann-separator"></span>
        <button id="ann-undo" class="ann-btn" title="Undo">↩️</button>
        <button id="ann-save" class="ann-btn ann-save" title="Save">💾 Save</button>
        <button id="ann-close" class="ann-btn ann-close" title="Close">✕</button>
      </div>
      <div class="annotation-canvas-container">
        <canvas id="annotation-canvas"></canvas>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'smart-capture-annotation-style';
    style.textContent = `
      #smart-capture-annotation {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        z-index: 2147483647; background: rgba(0,0,0,0.85);
        display: flex; flex-direction: column;
      }
      .annotation-toolbar {
        display: flex; align-items: center; gap: 6px; padding: 8px 16px;
        background: #222; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        z-index: 10; flex-shrink: 0; justify-content: center;
      }
      .ann-btn {
        background: #444; border: none; color: white; padding: 8px 12px;
        border-radius: 6px; cursor: pointer; font-size: 14px;
        transition: background 0.2s;
      }
      .ann-btn:hover { background: #666; }
      .ann-btn.active { background: #667eea; }
      .ann-save { background: #38ef7d !important; color: #000 !important; font-weight: bold; }
      .ann-save:hover { background: #2dd46a !important; }
      .ann-close { background: #f5576c !important; }
      .ann-close:hover { background: #e0435a !important; }
      .ann-separator { width: 1px; height: 24px; background: #555; margin: 0 4px; }
      #ann-color { width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; }
      #ann-size { background: #444; color: white; border: none; padding: 8px; border-radius: 6px; }
      .annotation-canvas-container {
        flex: 1; overflow-y: auto; overflow-x: auto;
        text-align: center; padding: 0;
      }
      .annotation-canvas-container::-webkit-scrollbar { width: 8px; }
      .annotation-canvas-container::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
      .annotation-canvas-container::-webkit-scrollbar-thumb { background: #667eea; border-radius: 4px; }
      #annotation-canvas {
        cursor: crosshair;
        display: block;
        margin: 0 auto;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Setup canvas
    const canvas = document.getElementById('annotation-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Set canvas internal resolution to image size (1:1 pixels)
      canvas.width = img.width;
      canvas.height = img.height;

      // Set CSS display size to fill the container width
      // This makes the page readable at approximately the same size as the original
      const containerWidth = window.innerWidth;
      const displayScale = containerWidth / img.width;
      canvas.style.width = containerWidth + 'px';
      canvas.style.height = (img.height * displayScale) + 'px';

      ctx.drawImage(img, 0, 0, img.width, img.height);

      // Store original for undo
      const history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      let currentTool = 'pen';
      let isDrawing = false;
      let startX, startY;

      const getColor = () => document.getElementById('ann-color').value;
      const getSize = () => parseInt(document.getElementById('ann-size').value);

      // Map mouse CSS position to internal canvas coordinates
      const getCanvasCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
      };

      // Tool selection
      overlay.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentTool = btn.dataset.tool;
          canvas.style.cursor = currentTool === 'text' ? 'text' : 'crosshair';
        });
      });

      // Drawing
      canvas.addEventListener('mousedown', (e) => {
        const coords = getCanvasCoords(e);
        startX = coords.x;
        startY = coords.y;
        isDrawing = true;

        if (currentTool === 'text') {
          isDrawing = false;
          const text = prompt('Enter annotation text:');
          if (text) {
            ctx.font = `${getSize() * 5}px Arial`;
            ctx.fillStyle = getColor();
            ctx.fillText(text, startX, startY);
            history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
          }
          return;
        }

        if (currentTool === 'pen' || currentTool === 'highlight') {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.strokeStyle = getColor();
          ctx.lineWidth = currentTool === 'highlight' ? getSize() * 4 : getSize();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (currentTool === 'highlight') {
            ctx.globalAlpha = 0.3;
          }
        }
      });

      canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const coords = getCanvasCoords(e);
        const x = coords.x;
        const y = coords.y;

        if (currentTool === 'pen' || currentTool === 'highlight') {
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (currentTool === 'rect' || currentTool === 'arrow') {
          // Restore previous state for live preview
          ctx.putImageData(history[history.length - 1], 0, 0);
          ctx.strokeStyle = getColor();
          ctx.lineWidth = getSize();
          if (currentTool === 'rect') {
            ctx.strokeRect(startX, startY, x - startX, y - startY);
          } else {
            // Arrow
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
            // Arrowhead
            const angle = Math.atan2(y - startY, x - startX);
            const headLen = getSize() * 5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x, y);
            ctx.lineTo(x - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
        }
      });

      canvas.addEventListener('mouseup', () => {
        if (isDrawing) {
          isDrawing = false;
          ctx.globalAlpha = 1;
          history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
      });

      // Undo
      document.getElementById('ann-undo').addEventListener('click', () => {
        if (history.length > 1) {
          history.pop();
          ctx.putImageData(history[history.length - 1], 0, 0);
        }
      });

      // Save
      document.getElementById('ann-save').addEventListener('click', async () => {
        const dataUrl = canvas.toDataURL('image/png', 1);
        await chrome.runtime.sendMessage({
          action: 'saveCapture',
          data: {
            dataUrl,
            format: 'png',
            mode: 'annotation',
            url: window.location.href,
            title: document.title + ' (annotated)',
            settings: this.settings || {}
          }
        });
        overlay.remove();
        style.remove();
        this.showNotification('✓ Annotated screenshot saved!', 'success');
      });

      // Close
      document.getElementById('ann-close').addEventListener('click', () => {
        overlay.remove();
        style.remove();
      });
    };

    img.src = imageDataUrl;
  }

  async saveCapture(captureData) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'saveCapture',
        data: captureData
      }, resolve);
    });
  }

  showLoadingIndicator(message) {
    const existing = document.getElementById('smart-capture-loading');
    if (existing) existing.remove();

    const loader = document.createElement('div');
    loader.id = 'smart-capture-loading';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <div class="message">${message}</div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #smart-capture-loading {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
      }
      .loader-content {
        background: white;
        padding: 30px 40px;
        border-radius: 12px;
        text-align: center;
      }
      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .loader-content .message {
        font-family: sans-serif;
        color: #333;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loader);
  }

  hideLoadingIndicator() {
    const loader = document.getElementById('smart-capture-loading');
    if (loader) loader.remove();
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `smart-capture-notification ${type}`;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
      .smart-capture-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 2147483647;
        font-family: sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease;
      }
      .smart-capture-notification.success {
        border-left: 4px solid #38ef7d;
      }
      .smart-capture-notification.error {
        border-left: 4px solid #f5576c;
      }
      .smart-capture-notification.info {
        border-left: 4px solid #667eea;
      }
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;

    if (!document.querySelector('style[data-smart-capture-notifications]')) {
      style.setAttribute('data-smart-capture-notifications', '');
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize content script (only once)
if (!window.smartCaptureInstance) {
  window.smartCaptureInstance = new SmartCapture();
}

// Also create global reference for debugging
const smartCapture = window.smartCaptureInstance;
