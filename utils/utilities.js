// PDF Export Utility
class PDFExporter {
  static async exportToPDF(canvas, filename) {
    // This would use jsPDF library in production
    // For now, we'll create a basic implementation
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Create a simple PDF-like structure
    // In production, use: import { jsPDF } from 'jspdf';
    
    console.log('PDF export would happen here');
    
    // Fallback: download as image
    return imgData;
  }

  static async createPDFFromImages(images) {
    // Create multi-page PDF
    console.log('Multi-page PDF creation');
    return null;
  }
}

// Text Utilities
class TextUtils {
  static cleanText(text, options = {}) {
    let cleaned = text;

    if (options.removeAds) {
      const adPatterns = [
        /\[?advertisement\]?/gi,
        /\[?sponsored\]?/gi,
        /\[?ad\]?/gi,
        /\b(ads?|advertisement|sponsored)\b/gi
      ];
      
      adPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
    }

    if (options.removeScripts) {
      cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    if (options.removeExtraWhitespace) {
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');
    }

    return cleaned;
  }

  static extractVisibleText(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          const style = window.getComputedStyle(parent);
          
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node;
    while (node = walker.nextNode()) {
      text += node.textContent + ' ';
    }

    return text.trim();
  }
}

// Image Utilities
class ImageUtils {
  static async compressImage(dataUrl, quality = 0.8) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }

  static async resizeImage(dataUrl, maxWidth, maxHeight) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL());
      };
      img.src = dataUrl;
    });
  }

  static async convertFormat(dataUrl, format, quality = 0.92) {
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp'
    };

    const mimeType = mimeTypes[format.toLowerCase()] || 'image/png';

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.src = dataUrl;
    });
  }
}

// Storage Utilities
class StorageUtils {
  static async saveToLocal(key, data) {
    return chrome.storage.local.set({ [key]: data });
  }

  static async getFromLocal(key) {
    const result = await chrome.storage.local.get([key]);
    return result[key];
  }

  static async saveToSync(key, data) {
    return chrome.storage.sync.set({ [key]: data });
  }

  static async getFromSync(key) {
    const result = await chrome.storage.sync.get([key]);
    return result[key];
  }

  static async clearAll() {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PDFExporter,
    TextUtils,
    ImageUtils,
    StorageUtils
  };
}
