// Background Service Worker
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener(() => this.onInstalled());
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenu(info, tab);
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });
  }

  onInstalled() {
    // Create context menus
    chrome.contextMenus.create({
      id: 'captureFullPage',
      title: '📸 Capture Full Page',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'captureSelection',
      title: '✂️ Capture Selection',
      contexts: ['page', 'selection']
    });

    chrome.contextMenus.create({
      id: 'captureElement',
      title: '🎯 Capture Element',
      contexts: ['page', 'link', 'image']
    });

    chrome.contextMenus.create({
      id: 'copyPageText',
      title: '📋 Copy Page Text',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'performOCR',
      title: '🔍 Extract Text (OCR)',
      contexts: ['image']
    });

    // Initialize storage
    chrome.storage.local.set({
      captureHistory: [],
      settings: {
        autoSync: false,
        cloudProvider: 'none',
        defaultFormat: 'png',
        defaultQuality: 0.92
      }
    });

    console.log('Advanced Smart Capture installed!');
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'saveCapture':
          await this.saveCapture(request.data);
          sendResponse({ success: true });
          break;

        case 'scheduleCapture':
          await this.scheduleCapture(request.minutes, request.captureData, sender.tab);
          sendResponse({ success: true });
          break;

        case 'openHistory':
          await this.openHistoryPage();
          sendResponse({ success: true });
          break;

        case 'openSettings':
          await this.openSettingsPage();
          sendResponse({ success: true });
          break;

        case 'syncToCloud':
          await this.syncToCloud(request.data);
          sendResponse({ success: true });
          break;

        case 'getHistory':
          const history = await this.getHistory();
          sendResponse({ history });
          break;

        case 'captureFullPage':
          const fullPageCapture = await this.captureFullPageWithDebugger(sender.tab.id, request.data);
          sendResponse(fullPageCapture);
          break;

        case 'captureVisibleArea':
          const visibleCapture = await this.captureVisibleTab(sender.tab.id, request.data);
          sendResponse(visibleCapture);
          break;

        case 'captureArea':
          const areaCapture = await this.captureAreaWithDebugger(sender.tab.id, request.data);
          sendResponse(areaCapture);
          break;

        case 'captureFullPageForAnnotation':
          // Capture full page but return dataUrl instead of saving
          const annotationCapture = await this.captureFullPageForAnnotation(sender.tab.id, request.data);
          sendResponse(annotationCapture);
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleContextMenu(info, tab) {
    const message = {
      action: info.menuItemId,
      data: {
        srcUrl: info.srcUrl,
        selectionText: info.selectionText
      }
    };

    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      console.error('Context menu error:', error);
    }
  }

  async handleAlarm(alarm) {
    if (alarm.name.startsWith('scheduledCapture_')) {
      const tabId = parseInt(alarm.name.split('_')[1]);
      const captureData = await chrome.storage.local.get([`schedule_${tabId}`]);

      if (captureData[`schedule_${tabId}`]) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'startCapture',
            data: captureData[`schedule_${tabId}`]
          });

          // Clean up
          await chrome.storage.local.remove([`schedule_${tabId}`]);
        } catch (error) {
          console.error('Scheduled capture failed:', error);
        }
      }
    }
  }

  async saveCapture(captureData) {
    const timestamp = new Date().toISOString();
    const capture = {
      id: Date.now(),
      timestamp,
      url: captureData.url,
      title: captureData.title,
      dataUrl: captureData.dataUrl,
      format: captureData.format,
      mode: captureData.mode,
      settings: captureData.settings
    };

    // Save to local storage
    const { captureHistory = [] } = await chrome.storage.local.get(['captureHistory']);
    captureHistory.unshift(capture);

    // Keep only last 50 captures
    if (captureHistory.length > 50) {
      captureHistory.splice(50);
    }

    await chrome.storage.local.set({ captureHistory });

    // Auto-sync if enabled
    const { settings } = await chrome.storage.local.get(['settings']);
    if (settings && settings.autoSync) {
      await this.syncToCloud(capture);
    }

    // Download the file
    await this.downloadCapture(capture);
  }

  async downloadCapture(capture) {
    const filename = this.generateFilename(capture);
    console.log('[Download] Saving:', filename, 'format:', capture.format);

    try {
      let downloadUrl = capture.dataUrl;

      if (capture.format === 'pdf') {
        try {
          console.log('[Download] Generating PDF...');
          downloadUrl = await this.createPdfFromImage(capture.dataUrl);
          console.log('[Download] PDF generated successfully');
        } catch (pdfError) {
          console.error('[Download] PDF generation failed, saving as PNG:', pdfError);
          // Fallback to saving as PNG if PDF generation fails
          downloadUrl = capture.dataUrl;
        }
      }

      const downloadId = await chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: true
      });
      console.log('[Download] Download started, id:', downloadId);
    } catch (error) {
      console.error('[Download] Download error:', error);
    }
  }

  /**
   * Create a proper PDF document from an image data URL
   * Uses raw PDF structure (no external libraries needed)
   */
  async createPdfFromImage(imageDataUrl) {
    // Extract base64 data and mime type
    const matches = imageDataUrl.match(/^data:(image\/(png|jpeg));base64,(.+)$/);
    if (!matches) throw new Error('Invalid image data URL');

    const mimeType = matches[1];
    const imgFormat = matches[2] === 'jpeg' ? 'JPEG' : 'PNG';
    const base64Data = matches[3];

    // Decode base64 to get raw bytes
    const binaryStr = atob(base64Data);
    const imgBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      imgBytes[i] = binaryStr.charCodeAt(i);
    }

    // Get image dimensions by loading it
    const dimensions = await new Promise((resolve, reject) => {
      // Use OffscreenCanvas approach for service worker
      const blob = new Blob([imgBytes], { type: mimeType });
      createImageBitmap(blob).then(bitmap => {
        resolve({ width: bitmap.width, height: bitmap.height });
        bitmap.close();
      }).catch(reject);
    });

    const imgWidth = dimensions.width;
    const imgHeight = dimensions.height;

    // PDF uses points (1 pt = 1/72 inch). Scale image to fit reasonably.
    // Use 72 DPI so 1 pixel = 1 point for simplicity
    const pageWidth = imgWidth * 0.75;   // scale down a bit for reasonable PDF size
    const pageHeight = imgHeight * 0.75;

    // Build PDF structure
    const imgFilter = imgFormat === 'JPEG' ? '/DCTDecode' : '/FlateDecode';
    const colorSpace = '/DeviceRGB';

    // For PNG, we need to embed as raw image data, but PDF doesn't natively support PNG.
    // The simplest approach: convert to JPEG using OffscreenCanvas
    let jpegBytes;
    const blob = new Blob([imgBytes], { type: mimeType });
    const bitmap = await createImageBitmap(blob);
    const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpegBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
    const jpegBuffer = await jpegBlob.arrayBuffer();
    jpegBytes = new Uint8Array(jpegBuffer);

    // Build the PDF manually
    const objects = [];
    let objCount = 0;

    const addObj = (content) => {
      objCount++;
      objects.push({ id: objCount, content });
      return objCount;
    };

    // Obj 1: Catalog
    const catalogId = addObj('<< /Type /Catalog /Pages 2 0 R >>');
    // Obj 2: Pages
    const pagesId = addObj(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
    // Obj 3: Page
    const pageId = addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>`);
    // Obj 4: Content stream (draw image to fill page)
    const contentStream = `q ${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm /Img Do Q`;
    const contentId = addObj(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    // Obj 5: Image XObject
    const imageHeader = `<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`;

    // Build final PDF bytes
    const encoder = new TextEncoder();
    const parts = [];

    parts.push(encoder.encode('%PDF-1.4\n'));

    const offsets = [];

    // Write objects 1-4
    for (let i = 0; i < objects.length; i++) {
      const currentSize = parts.reduce((sum, p) => sum + p.length, 0);
      offsets.push(currentSize);
      const objStr = `${objects[i].id} 0 obj\n${objects[i].content}\nendobj\n`;
      parts.push(encoder.encode(objStr));
    }

    // Write object 5 (image) - binary data
    const imgObjStart = parts.reduce((sum, p) => sum + p.length, 0);
    offsets.push(imgObjStart);
    parts.push(encoder.encode(`5 0 obj\n${imageHeader}\nstream\n`));
    parts.push(jpegBytes);
    parts.push(encoder.encode('\nendstream\nendobj\n'));

    // Cross-reference table
    const xrefOffset = parts.reduce((sum, p) => sum + p.length, 0);
    let xref = `xref\n0 ${objCount + 1}\n`;
    xref += '0000000000 65535 f \n';
    for (const offset of offsets) {
      xref += offset.toString().padStart(10, '0') + ' 00000 n \n';
    }
    parts.push(encoder.encode(xref));

    // Trailer
    const trailer = `trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(encoder.encode(trailer));

    // Combine all parts into single Uint8Array
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const pdfBytes = new Uint8Array(totalLength);
    let pos = 0;
    for (const part of parts) {
      pdfBytes.set(part, pos);
      pos += part.length;
    }

    // Create blob URL
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);
    return url;
  }

  generateFilename(capture) {
    const date = new Date(capture.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const title = capture.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);

    return `capture_${title}_${dateStr}_${timeStr}.${capture.format}`;
  }

  async scheduleCapture(minutes, captureData, tab) {
    const alarmName = `scheduledCapture_${tab.id}`;

    // Store capture data
    await chrome.storage.local.set({
      [`schedule_${tab.id}`]: captureData
    });

    // Create alarm
    await chrome.alarms.create(alarmName, {
      delayInMinutes: minutes
    });

    console.log(`Capture scheduled for ${minutes} minutes`);
  }

  async syncToCloud(captureData) {
    // Placeholder for cloud sync functionality
    // In a real implementation, this would sync to services like:
    // - Google Drive
    // - Dropbox
    // - OneDrive
    // - Custom backend server

    console.log('Cloud sync would happen here:', captureData.id);

    // For now, just mark as synced
    const { captureHistory = [] } = await chrome.storage.local.get(['captureHistory']);
    const capture = captureHistory.find(c => c.id === captureData.id);
    if (capture) {
      capture.synced = true;
      await chrome.storage.local.set({ captureHistory });
    }
  }

  async getHistory() {
    const { captureHistory = [] } = await chrome.storage.local.get(['captureHistory']);
    return captureHistory;
  }

  async openHistoryPage() {
    const url = chrome.runtime.getURL('history.html');
    await chrome.tabs.create({ url });
  }

  async openSettingsPage() {
    const url = chrome.runtime.getURL('settings.html');
    await chrome.tabs.create({ url });
  }

  async captureVisibleTab(tabId, data) {
    try {
      // Convert quality from 0-1 range to 0-100 integer
      const quality = Math.round((data.settings.quality || 0.92) * 100);

      // Capture the visible area of the tab
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: data.format === 'jpg' ? 'jpeg' : 'png',
        quality: quality
      });

      // If caller wants the dataUrl back (e.g. annotation mode), return it without saving
      if (data.returnDataUrl) {
        return { success: true, dataUrl: dataUrl };
      }

      // Otherwise save directly
      await this.saveCapture({
        dataUrl,
        format: data.format,
        mode: data.mode,
        url: data.url,
        title: data.title,
        settings: data.settings
      });

      return { success: true };
    } catch (error) {
      console.error('Capture visible tab error:', error);
      return { error: error.message || 'Failed to capture visible area' };
    }
  }

  /**
   * Capture full page for annotation - returns dataUrl instead of saving
   */
  async captureFullPageForAnnotation(tabId, data) {
    console.log('[Debugger API] Capturing full page for annotation');
    let debuggerAttached = false;

    try {
      const target = { tabId: tabId };
      await chrome.debugger.attach(target, "1.3");
      debuggerAttached = true;

      // Hide scrollbars
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const style = document.createElement('style');
          style.id = 'debugger-capture-style';
          style.textContent = `::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }`;
          document.head.appendChild(style);
        }
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get page dimensions from DOM
      const pageDimensions = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          window.scrollTo(0, 0);
          const body = document.body;
          const html = document.documentElement;
          return {
            width: window.innerWidth,
            height: Math.max(
              body.scrollHeight || 0, body.offsetHeight || 0,
              html.clientHeight || 0, html.scrollHeight || 0, html.offsetHeight || 0
            )
          };
        }
      });

      const captureWidth = pageDimensions[0].result.width;
      const captureHeight = pageDimensions[0].result.height;

      console.log(`[Debugger API] Annotation capture: ${captureWidth}x${captureHeight}px`);

      // Zoom out viewport to full page size
      await chrome.debugger.sendCommand(target, "Emulation.setDeviceMetricsOverride", {
        width: captureWidth, height: captureHeight, deviceScaleFactor: 1, mobile: false
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture at scale 1 (annotation doesn't need 2x, keeps canvas manageable)
      const result = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
        format: 'png',
        clip: { x: 0, y: 0, width: captureWidth, height: captureHeight, scale: 1 }
      });

      // Restore
      await chrome.debugger.sendCommand(target, "Emulation.clearDeviceMetricsOverride");
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => { const s = document.getElementById('debugger-capture-style'); if (s) s.remove(); }
      });
      await chrome.debugger.detach(target);
      debuggerAttached = false;

      const dataUrl = `data:image/png;base64,${result.data}`;
      return { success: true, dataUrl: dataUrl };

    } catch (error) {
      console.error('[Debugger API] Annotation capture error:', error);
      if (debuggerAttached) {
        try {
          await chrome.debugger.sendCommand({ tabId }, "Emulation.clearDeviceMetricsOverride").catch(() => { });
          await chrome.debugger.detach({ tabId });
        } catch (e) { }
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => { const s = document.getElementById('debugger-capture-style'); if (s) s.remove(); }
        });
      } catch (e) { }
      return { error: error.message || 'Failed to capture full page for annotation' };
    }
  }

  /**
   * Capture a specific rectangular area using Chrome Debugger API
   * Used for selection capture and element capture modes
   */
  async captureAreaWithDebugger(tabId, data) {
    console.log('[Debugger API] Starting area capture', data.rect);
    let debuggerAttached = false;

    try {
      const quality = Math.round((data.settings.quality || 0.92) * 100);
      const target = { tabId: tabId };

      await chrome.debugger.attach(target, "1.3");
      debuggerAttached = true;

      // Capture screenshot with clip region matching the selected area
      const result = await chrome.debugger.sendCommand(
        target,
        "Page.captureScreenshot",
        {
          format: data.format === 'jpg' ? 'jpeg' : 'png',
          quality: quality,
          clip: {
            x: data.rect.x,
            y: data.rect.y,
            width: data.rect.width,
            height: data.rect.height,
            scale: 2
          }
        }
      );

      console.log('[Debugger API] Area screenshot captured, data length:', result.data.length);

      // Detach debugger
      await chrome.debugger.detach(target);
      debuggerAttached = false;

      // Convert base64 to data URL
      const dataUrl = `data:image/${data.format === 'jpg' ? 'jpeg' : 'png'};base64,${result.data}`;

      // Save the capture
      await this.saveCapture({
        dataUrl: dataUrl,
        format: data.format,
        mode: data.mode || 'selection',
        url: data.url,
        title: data.title,
        settings: data.settings
      });

      return { success: true };

    } catch (error) {
      console.error('[Debugger API] Area capture error:', error);

      if (debuggerAttached) {
        try {
          await chrome.debugger.detach({ tabId: tabId });
        } catch (e) { /* ignore */ }
      }

      return { error: error.message || 'Failed to capture area' };
    }
  }

  /**
   * Capture full page using Chrome Debugger API - "Zoom Out to Full Height" approach
   * This method captures the entire page in ONE shot by:
   * 1. Getting full page dimensions
   * 2. Resizing the virtual viewport to match full page size
   * 3. Capturing the screenshot (entire page visible at once)
   * 4. Restoring original viewport
   * 
   * Benefits:
   * - Fixed/sticky elements appear only once (no duplication)
   * - No complex stitching required
   * - More reliable for modern websites
   * Drawback:
   * - Shows "Debugger attached" warning during capture
   */
  async captureFullPageWithDebugger(tabId, data) {
    console.log('[Debugger API] Starting full page capture (zoom-out method)');
    let debuggerAttached = false;

    try {
      // Convert quality from 0-1 range to 0-100 integer
      const quality = Math.round((data.settings.quality || 0.92) * 100);

      // Attach debugger to the tab
      const target = { tabId: tabId };
      await chrome.debugger.attach(target, "1.3");
      debuggerAttached = true;
      console.log('[Debugger API] Attached to tab');

      // Hide scrollbars before capture
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const style = document.createElement('style');
          style.id = 'debugger-capture-style';
          style.textContent = `
            ::-webkit-scrollbar { display: none !important; }
            * { scrollbar-width: none !important; }
          `;
          document.head.appendChild(style);
        }
      });

      // Wait for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100));

      // STEP 1: Get the ACTUAL page dimensions from the DOM
      // CDP's contentSize often over-reports height (includes invisible overflow,
      // absolute elements, extended margins). DOM scroll dimensions are more accurate.
      const pageDimensions = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Scroll to top first for accurate measurement
          window.scrollTo(0, 0);

          const body = document.body;
          const html = document.documentElement;

          // Get the actual scrollable width - use viewport width to avoid responsive reflow
          const viewportWidth = window.innerWidth;

          // Get the actual scrollable height using multiple methods
          // scrollHeight is the most reliable for "how tall is the content"
          const scrollHeight = Math.max(
            body.scrollHeight || 0,
            body.offsetHeight || 0,
            html.clientHeight || 0,
            html.scrollHeight || 0,
            html.offsetHeight || 0
          );

          return {
            width: viewportWidth,
            height: scrollHeight
          };
        }
      });

      const captureWidth = pageDimensions[0].result.width;
      const captureHeight = pageDimensions[0].result.height;

      console.log(`[Debugger API] DOM scroll dimensions: ${captureWidth}x${captureHeight}px`);

      // STEP 2: "Zoom out" - Override device metrics to set viewport to full page size
      // Keep the ORIGINAL viewport width to avoid responsive reflow
      // Only expand the height to show the full page content
      // deviceScaleFactor MUST be 1 to keep 1:1 CSS pixel mapping
      await chrome.debugger.sendCommand(
        target,
        "Emulation.setDeviceMetricsOverride",
        {
          width: captureWidth,
          height: captureHeight,
          deviceScaleFactor: 1,
          mobile: false
        }
      );

      console.log('[Debugger API] Viewport resized to full page dimensions');

      // Wait for the page to re-render at the new viewport size
      await new Promise(resolve => setTimeout(resolve, 300));

      // STEP 3: Capture the screenshot at 2x resolution for ultra quality
      // clip.scale = 2 doubles the pixel density without changing layout
      // This gives retina-quality output (e.g. 1920px page → 3840px image)
      const result = await chrome.debugger.sendCommand(
        target,
        "Page.captureScreenshot",
        {
          format: data.format === 'jpg' ? 'jpeg' : 'png',
          quality: quality,
          clip: {
            x: 0,
            y: 0,
            width: captureWidth,
            height: captureHeight,
            scale: 2
          }
        }
      );

      console.log('[Debugger API] Screenshot captured, data length:', result.data.length);

      // CRITICAL: Clear the device metrics override to restore original viewport
      await chrome.debugger.sendCommand(
        target,
        "Emulation.clearDeviceMetricsOverride"
      );

      console.log('[Debugger API] Viewport restored to original dimensions');

      // Restore scrollbars
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const style = document.getElementById('debugger-capture-style');
          if (style) style.remove();
        }
      });

      // Detach debugger
      await chrome.debugger.detach(target);
      debuggerAttached = false;
      console.log('[Debugger API] Detached from tab');

      // Convert base64 to data URL
      const dataUrl = `data:image/${data.format === 'jpg' ? 'jpeg' : 'png'};base64,${result.data}`;

      // Save the capture
      await this.saveCapture({
        dataUrl: dataUrl,
        format: data.format,
        mode: data.mode,
        url: data.url,
        title: data.title,
        settings: data.settings
      });

      return { success: true };

    } catch (error) {
      console.error('[Debugger API] Capture error:', error);

      // Make sure to clean up on error
      if (debuggerAttached) {
        try {
          // Try to clear metrics override before detaching
          await chrome.debugger.sendCommand(
            { tabId: tabId },
            "Emulation.clearDeviceMetricsOverride"
          ).catch(() => { });

          await chrome.debugger.detach({ tabId: tabId });
          console.log('[Debugger API] Detached after error');
        } catch (detachError) {
          console.error('[Debugger API] Failed to detach:', detachError);
        }
      }

      // Restore scrollbars even on error
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            const style = document.getElementById('debugger-capture-style');
            if (style) style.remove();
          }
        });
      } catch (e) { /* ignore */ }

      return { error: error.message || 'Failed to capture full page with debugger' };
    }
  }

  async captureFullPageWithScrolling(tabId, data) {
    try {
      // Convert quality from 0-1 range to 0-100 integer
      const quality = Math.round((data.settings.quality || 0.92) * 100);

      // Get viewport info
      const viewportInfo = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return {
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            devicePixelRatio: window.devicePixelRatio || 1
          };
        }
      });

      const dimensions = viewportInfo[0].result;
      dimensions.fullHeight = data.fullHeight; // Use the fullHeight passed from content script

      const screenshots = [];
      const viewportHeight = dimensions.viewportHeight;
      const fullHeight = dimensions.fullHeight;

      // Calculate number of captures needed
      const numCaptures = Math.ceil(fullHeight / viewportHeight);

      console.log(`Capturing ${numCaptures} sections (Viewport: ${viewportHeight}px, Full: ${fullHeight}px, DPR: ${dimensions.devicePixelRatio})`);

      // Capture each viewport section with retry logic
      for (let i = 0; i < numCaptures; i++) {
        const targetScrollY = i * viewportHeight;
        let retryCount = 0;
        const maxRetries = 2;
        let success = false;

        console.log(`\n=== CAPTURE SECTION ${i + 1}/${numCaptures} ===`);
        console.log(`Target scroll position: ${targetScrollY}px`);

        while (!success && retryCount <= maxRetries) {
          try {
            // Scroll to position with longer wait and validation
            const scrollResult = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: (y, sectionIndex, totalSections) => {
                // Scroll to target
                window.scrollTo(0, y);

                // Wait for scroll to settle and content to load
                return new Promise(resolve => {
                  setTimeout(() => {
                    const result = {
                      targetY: y,
                      actualY: window.scrollY,
                      scrollHeight: document.documentElement.scrollHeight,
                      viewportHeight: window.innerHeight,
                      sectionIndex: sectionIndex,
                      totalSections: totalSections
                    };

                    console.log(`[Background Debug] Section ${sectionIndex + 1}: Scrolled to ${window.scrollY}px (target: ${y}px)`);
                    resolve(result);
                  }, 300); // Increased wait time
                });
              },
              args: [targetScrollY, i, numCaptures]
            });

            const scrollInfo = scrollResult[0].result;

            // CRITICAL: Validate actual scroll position
            const scrollDifference = Math.abs(scrollInfo.actualY - targetScrollY);
            console.log(`Scroll validation: target=${targetScrollY}px, actual=${scrollInfo.actualY}px, diff=${scrollDifference}px`);

            // If we couldn't scroll to the target (within tolerance), check if we're at the end
            const maxScrollY = scrollInfo.scrollHeight - scrollInfo.viewportHeight;
            if (scrollDifference > 50 && scrollInfo.actualY < targetScrollY - 10) {
              // We're not where we should be and we're not at the bottom
              console.warn(`⚠️  Scroll position mismatch! Expected ${targetScrollY}px, got ${scrollInfo.actualY}px`);

              // Check if we've reached the maximum scroll
              if (scrollInfo.actualY >= maxScrollY - 10) {
                console.log('At maximum scroll position, continuing...');
              } else {
                throw new Error(`Scroll failed: target=${targetScrollY}px, actual=${scrollInfo.actualY}px`);
              }
            }

            // Wait for content to render
            await new Promise(resolve => setTimeout(resolve, 800));

            // Force reflow
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                document.body.offsetHeight;
                // Also check for any lazy-loaded images
                document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                  img.loading = 'eager';
                });
              }
            });

            // Additional wait for lazy content
            await new Promise(resolve => setTimeout(resolve, 200));

            // Capture screenshot
            const screenshot = await chrome.tabs.captureVisibleTab(null, {
              format: 'png',
              quality: 100
            });

            if (!screenshot) {
              throw new Error('Capture returned empty');
            }

            screenshots.push({
              dataUrl: screenshot,
              index: i,
              scrollY: targetScrollY,
              actualScrollY: scrollInfo.actualY,
              scrollInfo: scrollInfo  // Store complete scroll info for debugging
            });

            console.log(`✓ Captured section ${i + 1}/${numCaptures} successfully`);
            console.log(`  Scroll: ${scrollInfo.actualY}px / Screenshot data length: ${screenshot.length} chars`);
            success = true;

          } catch (error) {
            retryCount++;
            console.warn(`Capture attempt ${retryCount} failed for section ${i + 1}: ${error.message}`);

            if (retryCount > maxRetries) {
              throw new Error(`Failed to capture section ${i + 1} after ${maxRetries} retries: ${error.message}`);
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Stitch
      const stitchedDataUrl = await this.stitchScreenshotsPerfect(
        screenshots,
        dimensions,
        data.format,
        quality
      );

      await this.saveCapture({
        dataUrl: stitchedDataUrl,
        format: data.format,
        mode: data.mode,
        url: data.url,
        title: data.title,
        settings: data.settings
      });

      return { success: true };
    } catch (error) {
      console.error('Capture error:', error);
      return { error: error.message || 'Failed to capture full page' };
    }
  }

  async stitchScreenshotsPerfect(screenshots, dimensions, format, quality) {
    console.log(`\n=== STITCHING ${screenshots.length} SCREENSHOTS ===`);

    // DEBUGGING: Check if all screenshots are unique
    const uniqueDataUrls = new Set(screenshots.map(s => s.dataUrl.substring(0, 100)));
    console.log(`Unique screenshot prefixes: ${uniqueDataUrls.size} (should be ${screenshots.length})`);
    if (uniqueDataUrls.size < screenshots.length) {
      console.error(`⚠️  WARNING: ${screenshots.length - uniqueDataUrls.size} duplicate screenshots detected!`);
      console.error('This means some captures got the same content.');
      console.error('Scroll positions:', screenshots.map(s => `[${s.index}]: actual=${s.actualScrollY}px`).join(', '));
    }

    // Load first image to get actual pixel dimensions
    const firstImg = await this.loadImage(screenshots[0].dataUrl);
    const screenshotWidth = firstImg.width;
    const screenshotHeight = firstImg.height;

    console.log(`First screenshot dimensions: ${screenshotWidth}x${screenshotHeight}px`);

    // Load all images to check for size variations
    const allImages = [];
    for (let i = 0; i < screenshots.length; i++) {
      const img = await this.loadImage(screenshots[i].dataUrl);
      allImages.push(img);
      if (img.height !== screenshotHeight) {
        console.log(`  Screenshot ${i + 1} height: ${img.height}px (expected ${screenshotHeight}px)`);
      }
    }

    // CRITICAL: Use actual screenshot height, not calculated viewport height
    // The actual screenshot dimensions may differ from window.innerHeight * DPR
    // due to browser rendering, toolbar visibility, zoom, etc.

    const numScreenshots = screenshots.length;
    const dpr = dimensions.devicePixelRatio || 1;
    const fullHeightLogical = dimensions.fullHeight;
    const viewportHeightLogical = dimensions.viewportHeight;

    // Calculate canvas height: use actual screenshot height for positioning
    // Last screenshot might be partial, so calculate precisely
    const lastScreenshotFraction = (fullHeightLogical % viewportHeightLogical) / viewportHeightLogical;
    const lastScreenshotHeight = lastScreenshotFraction > 0
      ? Math.round(screenshotHeight * lastScreenshotFraction)
      : screenshotHeight;

    // Canvas height = (n-1) full screenshots + partial last screenshot
    const finalHeightPx = (numScreenshots - 1) * screenshotHeight + lastScreenshotHeight;

    // Validate canvas size limits
    const maxCanvasSize = 32000;
    if (finalHeightPx > maxCanvasSize) {
      console.error(`Canvas height ${finalHeightPx}px exceeds maximum ${maxCanvasSize}px`);
      throw new Error(`Page too tall to capture: ${finalHeightPx}px exceeds ${maxCanvasSize}px limit`);
    }

    console.log(`Stitching parameters:`);
    console.log(`  Screenshot size: ${screenshotWidth}x${screenshotHeight}px`);
    console.log(`  DPR: ${dpr}`);
    console.log(`  Viewport: ${viewportHeightLogical}px, Full page: ${fullHeightLogical}px`);
    console.log(`  Canvas size: ${screenshotWidth}x${finalHeightPx}px`);
    console.log(`  Last screenshot: ${Math.round(lastScreenshotFraction * 100)}% (${lastScreenshotHeight}px)`);

    // Create canvas
    const canvas = new OffscreenCanvas(screenshotWidth, finalHeightPx);
    const ctx = canvas.getContext('2d');

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, screenshotWidth, finalHeightPx);

    console.log(`\nDrawing screenshots onto canvas:`);
    // Draw each screenshot using actual screenshot height for positioning
    for (let i = 0; i < screenshots.length; i++) {
      const img = allImages[i];
      const screenshot = screenshots[i];

      // Position based on actual screenshot height, not calculated viewport height
      const destY = i * screenshotHeight;

      // Calculate how much height we need from this screenshot
      const remainingHeight = finalHeightPx - destY;
      const heightToDraw = Math.min(screenshotHeight, remainingHeight);

      if (heightToDraw > 0) {
        console.log(`  [${i + 1}/${screenshots.length}] Drawing ${heightToDraw}px at canvas Y=${destY}px (scroll was ${screenshot.actualScrollY}px)`);

        // Draw the screenshot (or portion of it)
        ctx.drawImage(
          img,
          0, 0, screenshotWidth, Math.round(heightToDraw),  // Source: top portion only
          0, destY, screenshotWidth, Math.round(heightToDraw)  // Destination
        );
      } else {
        console.log(`  [${i + 1}/${screenshots.length}] Skipped (no height remaining)`);
      }
    }

    console.log(`Stitching complete: ${screenshotWidth}x${finalHeightPx}px`);

    // Convert to final format
    const blob = await canvas.convertToBlob({
      type: format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: quality / 100
    });

    return await this.blobToDataURL(blob);
  }

  async stitchScreenshotsSimple(screenshots, dimensions, format, quality) {
    // Get dimensions from first screenshot
    const firstImg = await this.loadImage(screenshots[0].dataUrl);
    const screenshotWidth = firstImg.width;
    const screenshotHeight = firstImg.height;

    // For the last screenshot, we might have captured less than full viewport
    // So we need to calculate the actual content height
    const viewportHeightPx = dimensions.viewportHeight * dimensions.devicePixelRatio;
    const fullHeightPx = dimensions.fullHeight * dimensions.devicePixelRatio;

    // Calculate actual canvas height needed
    let canvasHeight;
    if (screenshots.length === 1) {
      canvasHeight = screenshotHeight;
    } else {
      // All full screenshots except possibly the last one
      const lastScreenshotHeight = Math.min(screenshotHeight, fullHeightPx - ((screenshots.length - 1) * viewportHeightPx));
      canvasHeight = ((screenshots.length - 1) * viewportHeightPx) + lastScreenshotHeight;
    }

    // Create canvas
    const canvas = new OffscreenCanvas(screenshotWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Stack screenshots
    for (let i = 0; i < screenshots.length; i++) {
      const img = await this.loadImage(screenshots[i].dataUrl);
      const yPosition = i * viewportHeightPx;

      if (i < screenshots.length - 1) {
        // Not the last screenshot - draw full viewport
        ctx.drawImage(img, 0, yPosition);
      } else {
        // Last screenshot - might be partial
        const remainingHeight = canvasHeight - yPosition;
        ctx.drawImage(
          img,
          0, 0,  // Source
          screenshotWidth, remainingHeight,
          0, yPosition,  // Destination
          screenshotWidth, remainingHeight
        );
      }
    }

    // Convert to blob
    const blob = await canvas.convertToBlob({
      type: format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: quality / 100
    });

    return await this.blobToDataURL(blob);
  }

  async stitchScreenshotsWithOverlap(screenshots, dimensions, overlap, format, quality) {
    // Get actual screenshot dimensions from first capture
    const firstImg = await this.loadImage(screenshots[0].dataUrl);
    const screenshotWidth = firstImg.width;
    const screenshotHeight = firstImg.height;

    // Calculate effective height per screenshot (excluding overlap)
    const effectiveHeight = screenshotHeight - (overlap * (dimensions.devicePixelRatio || 1));

    // Calculate total canvas height
    const totalHeight = screenshotHeight + (effectiveHeight * (screenshots.length - 1));

    // Create an offscreen canvas for stitching
    const canvas = new OffscreenCanvas(screenshotWidth, totalHeight);
    const ctx = canvas.getContext('2d');

    // Draw each screenshot onto the canvas
    for (let i = 0; i < screenshots.length; i++) {
      const img = await this.loadImage(screenshots[i].dataUrl);

      if (i === 0) {
        // First screenshot: draw completely
        ctx.drawImage(img, 0, 0);
      } else {
        // Subsequent screenshots: skip the overlapping top part
        const yPosition = screenshotHeight + (effectiveHeight * (i - 1));
        const overlapPixels = overlap * (dimensions.devicePixelRatio || 1);

        // Draw only the non-overlapping part
        ctx.drawImage(
          img,
          0, overlapPixels,  // Source: skip overlap from top
          screenshotWidth, screenshotHeight - overlapPixels,  // Source: dimensions
          0, yPosition,  // Destination position
          screenshotWidth, screenshotHeight - overlapPixels  // Destination dimensions
        );
      }
    }

    // Convert to blob and then to data URL
    const blob = await canvas.convertToBlob({
      type: format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: quality / 100
    });

    return await this.blobToDataURL(blob);
  }

  async stitchScreenshotsVertical(screenshots, dimensions, format, quality) {
    // Get actual screenshot dimensions from first capture
    const firstImg = await this.loadImage(screenshots[0].dataUrl);
    const screenshotWidth = firstImg.width;
    const screenshotHeight = firstImg.height;

    // Calculate total canvas height based on actual screenshot heights
    const totalHeight = screenshots.length * screenshotHeight;

    // Create an offscreen canvas for stitching
    const canvas = new OffscreenCanvas(screenshotWidth, totalHeight);
    const ctx = canvas.getContext('2d');

    // Draw each screenshot onto the canvas (simple vertical stacking by row)
    for (let i = 0; i < screenshots.length; i++) {
      const img = await this.loadImage(screenshots[i].dataUrl);
      // Stack screenshots vertically based on their row index
      const yPosition = i * screenshotHeight;
      ctx.drawImage(img, 0, yPosition);
    }

    // Convert to blob and then to data URL
    const blob = await canvas.convertToBlob({
      type: format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: quality / 100
    });

    return await this.blobToDataURL(blob);
  }

  async stitchScreenshots(screenshots, dimensions, format, quality) {
    // Create an offscreen canvas for stitching
    const canvas = new OffscreenCanvas(dimensions.fullWidth, dimensions.fullHeight);
    const ctx = canvas.getContext('2d');

    // Draw each screenshot onto the canvas
    for (const screenshot of screenshots) {
      const img = await this.loadImage(screenshot.dataUrl);
      ctx.drawImage(img, screenshot.x, screenshot.y);
    }

    // Convert to blob and then to data URL
    const blob = await canvas.convertToBlob({
      type: format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: quality / 100
    });

    return await this.blobToDataURL(blob);
  }

  async loadImage(dataUrl) {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    // Create ImageBitmap (available in service workers)
    return await createImageBitmap(blob);
  }

  async blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
