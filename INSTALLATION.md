# Installation & Setup Guide

## Quick Start

### 1. Load Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right corner)
4. Click **Load unpacked**
5. Navigate to and select: `d:\CUSTOMS\ChromeExtension\advanced-smart-capture`
6. The extension icon should appear in your toolbar

### 2. Pin the Extension

1. Click the puzzle piece icon (🧩) in Chrome toolbar
2. Find "Advanced Smart Capture"
3. Click the pin icon to keep it visible

### 3. First Use

1. Click the extension icon
2. Navigate to any webpage
3. Select a capture mode (Full Page, Visible Area, Selection, or Element)
4. Configure optional settings
5. Click "Capture Now"

### 4. Generate Better Icons (Optional)

The extension includes basic functional icons. For better-looking icons:

1. Open `icons/icon-generator.html` in Chrome
2. Click "Generate All Icons"
3. Click "Download All"
4. Replace the existing icon files in the `icons/` folder
5. Reload the extension in `chrome://extensions/`

## Features Overview

### Capture Modes
- **Full Page** - Captures entire scrollable page
- **Visible Area** - Captures current viewport
- **Selection** - Click and drag to select area
- **Element** - Click any element to capture it

### Customization Options
- Custom width and height
- Multiple resolutions (1x, 2x, 3x, 4x)
- Quality settings (Low to Ultra)
- Export formats (PNG, JPG, PDF)

### Advanced Features
- Text extraction from page
- OCR from images (requires Tesseract.js)
- Annotation tools (arrows, shapes, highlights, blur)
- Dark mode and mobile view simulation
- Scheduled captures
- Watermark support
- Capture history with search
- Cloud sync framework

## Keyboard Shortcuts (Optional Setup)

1. Go to `chrome://extensions/shortcuts`
2. Find "Advanced Smart Capture"
3. Set your preferred shortcuts:
   - Full page capture
   - Open annotation mode
   - View history

## Context Menu

Right-click on any page to access:
- Capture Full Page
- Capture Selection
- Capture Element
- Copy Page Text
- Extract Text (OCR)

## Permissions Explained

This extension requires the following permissions:

- **Active Tab** - To capture the current page
- **Storage** - To save your captures and settings
- **Downloads** - To save captured images to your computer
- **Context Menus** - For right-click capture options
- **Alarms** - For scheduled captures
- **All URLs** - To work on any website

All permissions are used exclusively for screenshot functionality. No data is sent to external servers.

## Storage Management

- Captures are stored locally in Chrome's storage
- Default limit: 50 captures (configurable in settings)
- View storage usage in History page
- Export history to backup your captures
- Clear old captures in Settings

## Troubleshooting

### Extension not appearing
- Make sure Developer mode is enabled
- Try reloading the extension
- Check Chrome console for errors (F12)

### Captures not working
- Ensure the extension has proper permissions
- Try refreshing the page
- Check if the page has security restrictions

### Large pages timing out
- Increase the auto-capture delay in settings
- Use visible area capture instead
- Try capturing in sections

### Icons not showing
- Reload the extension
- Use the icon-generator.html to create new icons
- Check that all 4 icon sizes exist (16, 32, 48, 128)

## Privacy

- All captures are stored locally on your device
- No data is transmitted to external servers
- Cloud sync feature is a framework (requires setup)
- You can clear all data at any time in Settings

## Next Steps

1. ✅ Extension loaded and working
2. 📸 Try capturing a few pages
3. ✏️ Test annotation tools
4. ⚙️ Customize settings to your preference
5. 📚 Explore capture history
6. 🔄 Set up cloud sync (optional, requires backend)

## Need Help?

- Check the main README.md for detailed documentation
- Review the Known Issues section
- Check if your use case has any limitations
- Consider browser security restrictions

---

Enjoy capturing! 📸
