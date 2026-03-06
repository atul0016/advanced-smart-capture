// Annotation Tools Module
class AnnotationTools {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isDrawing = false;
    this.currentTool = 'arrow';
    this.currentColor = '#FF0000';
    this.lineWidth = 3;
    this.annotations = [];
    this.tempAnnotation = null;
    
    this.init();
  }

  init() {
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  setLineWidth(width) {
    this.lineWidth = width;
  }

  startDrawing(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.tempAnnotation = {
      tool: this.currentTool,
      color: this.currentColor,
      lineWidth: this.lineWidth,
      startX: x,
      startY: y,
      endX: x,
      endY: y
    };
  }

  draw(e) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.tempAnnotation.endX = x;
    this.tempAnnotation.endY = y;

    this.redraw();
  }

  stopDrawing(e) {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    if (this.tempAnnotation) {
      this.annotations.push({ ...this.tempAnnotation });
      this.tempAnnotation = null;
    }
  }

  redraw() {
    // Clear and redraw all annotations
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw saved annotations
    this.annotations.forEach(ann => this.drawAnnotation(ann));

    // Draw current annotation
    if (this.tempAnnotation) {
      this.drawAnnotation(this.tempAnnotation);
    }
  }

  drawAnnotation(annotation) {
    this.ctx.strokeStyle = annotation.color;
    this.ctx.fillStyle = annotation.color;
    this.ctx.lineWidth = annotation.lineWidth;

    switch (annotation.tool) {
      case 'arrow':
        this.drawArrow(annotation);
        break;
      case 'rectangle':
        this.drawRectangle(annotation);
        break;
      case 'circle':
        this.drawCircle(annotation);
        break;
      case 'line':
        this.drawLine(annotation);
        break;
      case 'highlight':
        this.drawHighlight(annotation);
        break;
      case 'blur':
        this.drawBlur(annotation);
        break;
      case 'text':
        this.drawText(annotation);
        break;
    }
  }

  drawArrow(ann) {
    const { startX, startY, endX, endY } = ann;
    
    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 15;
    
    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - arrowLength * Math.cos(angle - Math.PI / 6),
      endY - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - arrowLength * Math.cos(angle + Math.PI / 6),
      endY - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  drawRectangle(ann) {
    const { startX, startY, endX, endY } = ann;
    const width = endX - startX;
    const height = endY - startY;
    
    this.ctx.strokeRect(startX, startY, width, height);
  }

  drawCircle(ann) {
    const { startX, startY, endX, endY } = ann;
    const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    
    this.ctx.beginPath();
    this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  drawLine(ann) {
    const { startX, startY, endX, endY } = ann;
    
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();
  }

  drawHighlight(ann) {
    const { startX, startY, endX, endY } = ann;
    const width = endX - startX;
    const height = endY - startY;
    
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillRect(startX, startY, width, height);
    this.ctx.globalAlpha = 1.0;
  }

  drawBlur(ann) {
    const { startX, startY, endX, endY } = ann;
    const width = endX - startX;
    const height = endY - startY;
    
    // Apply blur effect
    this.ctx.filter = 'blur(10px)';
    this.ctx.fillRect(startX, startY, width, height);
    this.ctx.filter = 'none';
  }

  drawText(ann) {
    if (ann.text) {
      this.ctx.font = `${ann.lineWidth * 8}px Arial`;
      this.ctx.fillText(ann.text, ann.startX, ann.startY);
    }
  }

  addText(x, y, text) {
    this.annotations.push({
      tool: 'text',
      color: this.currentColor,
      lineWidth: this.lineWidth,
      startX: x,
      startY: y,
      text: text
    });
    this.redraw();
  }

  undo() {
    this.annotations.pop();
    this.redraw();
  }

  clear() {
    this.annotations = [];
    this.redraw();
  }

  export() {
    return this.canvas.toDataURL('image/png');
  }
}

// Annotation UI
class AnnotationUI {
  constructor(imageDataUrl) {
    this.imageDataUrl = imageDataUrl;
    this.annotationTools = null;
    this.createUI();
  }

  createUI() {
    const container = document.createElement('div');
    container.id = 'annotation-container';
    container.innerHTML = `
      <div class="annotation-toolbar">
        <div class="tool-group">
          <button class="tool-btn active" data-tool="arrow" title="Arrow">➤</button>
          <button class="tool-btn" data-tool="rectangle" title="Rectangle">▭</button>
          <button class="tool-btn" data-tool="circle" title="Circle">●</button>
          <button class="tool-btn" data-tool="line" title="Line">―</button>
          <button class="tool-btn" data-tool="highlight" title="Highlight">🖍️</button>
          <button class="tool-btn" data-tool="blur" title="Blur">◉</button>
          <button class="tool-btn" data-tool="text" title="Text">T</button>
        </div>
        <div class="color-group">
          <input type="color" id="color-picker" value="#FF0000">
          <input type="range" id="line-width" min="1" max="10" value="3">
        </div>
        <div class="action-group">
          <button id="undo-btn">↶ Undo</button>
          <button id="clear-btn">✕ Clear</button>
          <button id="save-btn">💾 Save</button>
          <button id="close-btn">✕ Close</button>
        </div>
      </div>
      <div class="annotation-canvas-container">
        <canvas id="annotation-canvas"></canvas>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #annotation-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
      }
      .annotation-toolbar {
        background: white;
        padding: 15px;
        display: flex;
        gap: 20px;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .tool-group, .color-group, .action-group {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .tool-btn {
        width: 40px;
        height: 40px;
        border: 2px solid #ddd;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s;
      }
      .tool-btn:hover {
        border-color: #667eea;
        transform: scale(1.1);
      }
      .tool-btn.active {
        background: #667eea;
        color: white;
        border-color: #667eea;
      }
      #color-picker {
        width: 50px;
        height: 40px;
        border: none;
        cursor: pointer;
      }
      #line-width {
        width: 100px;
      }
      .action-group button {
        padding: 10px 15px;
        border: none;
        background: #667eea;
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }
      .action-group button:hover {
        background: #5568d3;
      }
      #close-btn {
        background: #f5576c;
      }
      #close-btn:hover {
        background: #e04555;
      }
      .annotation-canvas-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
      }
      #annotation-canvas {
        max-width: 100%;
        max-height: 100%;
        cursor: crosshair;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    this.initCanvas();
    this.attachEvents();
  }

  initCanvas() {
    const canvas = document.getElementById('annotation-canvas');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      this.annotationTools = new AnnotationTools(canvas);
    };
    
    img.src = this.imageDataUrl;
  }

  attachEvents() {
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.annotationTools.setTool(e.target.dataset.tool);
      });
    });

    // Color picker
    document.getElementById('color-picker').addEventListener('change', (e) => {
      this.annotationTools.setColor(e.target.value);
    });

    // Line width
    document.getElementById('line-width').addEventListener('input', (e) => {
      this.annotationTools.setLineWidth(parseInt(e.target.value));
    });

    // Actions
    document.getElementById('undo-btn').addEventListener('click', () => {
      this.annotationTools.undo();
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Clear all annotations?')) {
        this.annotationTools.clear();
      }
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      this.save();
    });

    document.getElementById('close-btn').addEventListener('click', () => {
      this.close();
    });
  }

  save() {
    const dataUrl = this.annotationTools.export();
    
    chrome.runtime.sendMessage({
      action: 'saveCapture',
      data: {
        dataUrl,
        format: 'png',
        mode: 'annotated',
        url: window.location.href,
        title: document.title + ' (Annotated)',
        settings: {}
      }
    });

    this.close();
  }

  close() {
    document.getElementById('annotation-container').remove();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnnotationTools, AnnotationUI };
}
