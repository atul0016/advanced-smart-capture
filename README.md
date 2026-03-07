# 📸 Advanced Smart Capture — Full Page Screenshot, OCR & Annotate for Chrome

> The most powerful **Chrome screenshot extension** — capture full pages, selections, or elements, extract text with OCR, annotate, and export to PDF. Free + $2.99 lifetime premium.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-brightgreen?logo=google-chrome)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/atul0016/advanced-smart-capture)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

**Advanced Smart Capture** is a Chrome extension that lets you take full-page screenshots, capture custom selections or DOM elements, extract text via OCR, annotate with arrows/highlights/blur, export to PDF, and schedule automatic captures — all without leaving your browser.

**Alternatives to:** GoFullPage, Nimbus Screenshot, Fireshot, Lightshot, Awesome Screenshot


## ✨ Features

### Capture Modes
- **Full Page Screenshot** - Capture entire scrollable pages with smooth stitching
- **Visible Area** - Capture only what's currently visible
- **Selection Capture** - Click and drag to select any area
- **Element Capture** - Click any element to capture it precisely

### Customization
- **Custom Dimensions** - Set specific width and height
- **Multiple Resolutions** - Original, HD (2x), 2K (3x), 4K (4x)
- **Quality Control** - Low, Medium, High, Ultra quality settings
- **Export Formats** - PNG, JPG, PDF support

### Text Features
- **Page Text Extraction** - Copy all text from current page
- **Selected Section Text** - Extract text from specific areas
- **Clean Text** - Automatically remove ads and scripts
- **OCR** - Extract text from images (requires Tesseract.js)

### Annotation Tools
- **Arrow** - Draw arrows to highlight important areas
- **Rectangle** - Draw rectangular boxes
- **Circle** - Draw circles around elements
- **Line** - Draw straight lines
- **Highlight** - Highlight text with transparency
- **Blur** - Blur sensitive information
- **Text** - Add custom text annotations

### View Options
- **Dark Mode Preview** - Capture pages in dark mode
- **Mobile View** - Simulate mobile viewport
- **Remove Ads** - Automatically remove advertisements

### Advanced Features
- **Scheduled Capture** - Set a timer for automatic capture
- **Cloud Sync** - Sync captures across devices
- **Version History** - Keep track of all captures
- **Share Links** - Generate shareable links
- **Watermarks** - Add custom watermarks (header/footer)

### Management
- **Capture History** - Browse all previous captures
- **Search & Filter** - Find captures by title, URL, format, or mode
- **Export/Import** - Backup your capture history
- **Storage Statistics** - Monitor storage usage

## 🚀 Installation

### From Chrome Web Store
**[Install Advanced Smart Capture →](https://chrome.google.com/webstore/search/advanced+smart+capture)**

### Manual Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `advanced-smart-capture` folder
5. The extension icon should appear in your toolbar

## 📖 Usage

### Quick Capture
1. Click the extension icon in the toolbar
2. Select your capture mode
3. Configure settings (optional)
4. Click "Capture Now"

### Context Menu
Right-click on any page to access quick capture options:
- Capture Full Page
- Capture Selection
- Capture Element
- Copy Page Text
- Extract Text (OCR)

### Keyboard Shortcuts
*(Can be configured in `chrome://extensions/shortcuts`)*
- `Ctrl+Shift+S` - Quick full page capture
- `Ctrl+Shift+A` - Open annotation mode
- `Ctrl+Shift+H` - View capture history

### Annotation Mode
1. Capture a screenshot
2. Click "Annotations" button
3. Select tool from toolbar
4. Draw on the image
5. Save or export the annotated capture

## ⚙️ Settings

Access settings by clicking the ⚙️ icon in the popup or through the extension menu.

### General Settings
- Default export format
- Default quality level
- Default resolution
- Auto-capture delay

### Cloud & Sync
- Enable/disable auto-sync
- Select cloud provider (Google Drive, Dropbox, OneDrive)
- Configure custom server

### Capture Settings
- Show notifications
- Smooth scrolling
- Auto-remove popups
- Include page URL in metadata

### Privacy & Storage
- History limit
- Auto-delete old captures
- Clear all data

## 🗂️ Project Structure

```
advanced-smart-capture/
├── manifest.json              # Extension configuration
├── background.js              # Background service worker
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup logic
├── content-script/
│   ├── content-script.js     # Main capture engine
│   └── content-script.css    # Content script styles
├── utils/
│   ├── utilities.js          # Helper functions
│   └── annotations.js        # Annotation tools
├── icons/
│   ├── icon16.png           # 16x16 icon
│   ├── icon32.png           # 32x32 icon
│   ├── icon48.png           # 48x48 icon
│   ├── icon128.png          # 128x128 icon
│   ├── icon-generator.html  # Icon generator tool
│   └── README.md            # Icons documentation
├── history.html              # Capture history page
├── history.js                # History page logic
├── settings.html             # Settings page
├── settings.js               # Settings logic
└── README.md                 # This file
```

## 🔧 Development

### Prerequisites
- Chrome browser (version 88+)
- Basic knowledge of JavaScript, HTML, CSS
- Text editor or IDE

### Building from Source
1. Clone the repository
2. Make your changes
3. Test in Chrome developer mode
4. Submit a pull request

### Adding New Features
1. Update `manifest.json` if new permissions are needed
2. Implement feature in appropriate module
3. Add UI controls in popup if needed
4. Update this README

### Testing
- Test all capture modes on various websites
- Verify export formats work correctly
- Check storage limits aren't exceeded
- Test on different screen resolutions
- Verify cross-browser compatibility (if applicable)

## 📝 Permissions Explained

- **activeTab** - Access current tab for capturing
- **tabs** - Query and interact with tabs
- **storage** - Save captures and settings
- **unlimitedStorage** - Store large capture files
- **scripting** - Inject content scripts
- **downloads** - Download captured images
- **contextMenus** - Right-click menu options
- **alarms** - Schedule captures
- **host_permissions: <all_urls>** - Work on all websites

## 🐛 Known Issues

- PDF export requires additional library (jsPDF)
- OCR requires Tesseract.js for full functionality
- Very large pages may take time to capture
- Some dynamic content may not render correctly
- Cloud sync is currently a placeholder (requires backend)

## 🛣️ Roadmap

- [ ] Complete PDF export functionality
- [ ] Integrate Tesseract.js for OCR
- [ ] Implement actual cloud sync with providers
- [ ] Add more annotation tools
- [ ] Video screen recording
- [ ] GIF creation from multiple captures
- [ ] Batch processing
- [ ] Template system for watermarks
- [ ] Browser action shortcuts
- [ ] Firefox and Edge support

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this extension for personal or commercial projects.

## 🆘 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check the FAQ section
- Review existing issues before creating new ones

## 🙏 Acknowledgments

- Inspired by various screenshot tools
- Icons designed with modern UI principles
- Community feedback and suggestions

## 📊 Version History

### v1.0.0 (Current)
- Initial release
- Full page capture
- Selection and element capture
- Basic annotation tools
- Text extraction
- Export to PNG/JPG/PDF
- Capture history
- Settings management
- Watermark support
- Scheduled captures
- Cloud sync framework

---

Made with ❤️ for productivity and convenience
