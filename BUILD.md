# Building RomTunes from Source

This guide is for developers who want to build RomTunes from source or contribute to development.

## Prerequisites

- **Node.js 18.x - 22.x (LTS recommended)** - v20 LTS is recommended
  - ⚠️ **Important**: Node.js v23+ may have compatibility issues with better-sqlite3
  - Download Node.js v20 LTS from [nodejs.org](https://nodejs.org/)
  - Check your version: `node --version`
- npm or yarn
- Platform-specific requirements:
  - **Windows**: No additional requirements
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `dpkg` (Debian) or `rpm` (Red Hat) depending on target

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/grantium/romtunes.git
cd romtunes
```

### 2. Install dependencies

```bash
npm install
```

This automatically rebuilds native modules (better-sqlite3) for Electron.

### 3. Run in development mode

```bash
# Run with standard output
npm start

# Run with DevTools open
npm run dev
```

## Building for Production

### Quick Build (Current Platform)

Build for your current operating system:

```bash
npm run build
```

Installers will be created in the `dist/` directory.

### Platform-Specific Builds

Build for specific platforms:

```bash
# Windows (creates .exe installer and portable)
npm run build:win

# macOS (creates .dmg and .zip)
npm run build:mac

# Linux (creates AppImage and .deb)
npm run build:linux

# All platforms (requires platform dependencies)
npm run build:all
```

**Note:** Cross-platform building has limitations:
- Windows builds work on Windows, macOS (with Wine), and Linux (with Wine)
- macOS builds only work on macOS (requires Xcode)
- Linux builds work on all platforms

For the most reliable builds, use GitHub Actions which builds on native runners for each platform.

## Build Output

After building, you'll find these files in `dist/`:

**Windows:**
- `RomTunes Setup 1.0.0.exe` - Installer (recommended)
- `RomTunes 1.0.0.exe` - Portable version (no installation required)

**macOS:**
- `RomTunes-1.0.0.dmg` - Disk image installer
- `RomTunes-1.0.0-mac.zip` - Zipped application

**Linux:**
- `RomTunes-1.0.0.AppImage` - Universal Linux app (recommended)
- `romtunes_1.0.0_amd64.deb` - Debian/Ubuntu package

## GitHub Actions (Automated Builds)

RomTunes includes a GitHub Actions workflow that automatically builds for all platforms.

### Automatic Builds

Builds are triggered automatically:
- On every push to `main` branch
- On every pull request to `main`
- Builds for Windows, macOS, and Linux simultaneously
- Uploads build artifacts for download (available in Actions tab)

### Creating Releases

To create a new release with binaries:

1. Update version in `package.json`
2. Commit changes
3. Create and push a version tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

GitHub Actions will automatically:
- Build for all platforms
- Create a GitHub Release
- Attach all installers to the release
- Generate release notes from commits

### Manual Workflow Trigger

Trigger a build manually without creating a release:
1. Go to Actions tab → Build and Release
2. Click "Run workflow"
3. Select branch and run

## Project Structure

```
romtunes/
├── src/
│   ├── main.js              # Electron main process
│   ├── database.js          # SQLite database handler
│   ├── config.js            # Configuration manager
│   ├── sync.js              # Device sync manager
│   ├── saveManager.js       # Save file sync manager
│   ├── scraper.js           # ScreenScraper API client
│   ├── scrapers/
│   │   └── thegamesdb.js    # TheGamesDB API client
│   ├── preload.js           # Preload script for IPC
│   └── renderer/
│       ├── index.html       # Main UI with modals
│       ├── styles.css       # Complete styling
│       ├── renderer.js      # Core UI logic
│       └── settings.js      # Settings & sync UI
├── build/                   # Build resources (icons, etc.)
├── .github/
│   └── workflows/
│       └── build.yml        # GitHub Actions workflow
├── package.json             # Dependencies and build config
└── README.md                # User documentation
```

## Custom Icons

To use custom app icons:

1. Create your icons with these sizes:
   - **macOS**: 1024x1024 PNG (converted to .icns)
   - **Windows**: 256x256 PNG (converted to .ico)
   - **Linux**: 512x512 PNG
2. Place in `build/` directory:
   - `icon.icns` - macOS
   - `icon.ico` - Windows
   - `icon.png` - Linux
3. Run build again

## Database Schema

```sql
CREATE TABLE roms (
  id INTEGER PRIMARY KEY,
  name TEXT,
  filename TEXT,
  path TEXT UNIQUE,
  size INTEGER,
  extension TEXT,
  system TEXT,
  dateAdded TEXT,
  lastPlayed TEXT,
  playCount INTEGER,
  favorite INTEGER,
  rating INTEGER,
  -- Artwork fields
  boxart TEXT,
  screenshot TEXT,
  banner TEXT,
  fanart TEXT,
  -- Sync tracking
  synced INTEGER DEFAULT 0,
  lastSynced TEXT
);

CREATE TABLE sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profileId TEXT,
  profileName TEXT,
  timestamp TEXT,
  operation TEXT,
  romCount INTEGER,
  romsSynced INTEGER,
  romsSkipped INTEGER,
  romsErrored INTEGER,
  savesCopied INTEGER,
  savesSkipped INTEGER,
  totalSize INTEGER,
  duration INTEGER,
  status TEXT,
  errorMessage TEXT,
  details TEXT
);

CREATE TABLE saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  romId INTEGER,
  filename TEXT,
  localPath TEXT,
  devicePath TEXT,
  size INTEGER,
  lastModified TEXT,
  lastSynced TEXT,
  syncDirection TEXT,
  saveType TEXT,
  FOREIGN KEY(romId) REFERENCES roms(id) ON DELETE CASCADE
);
```

## Configuration Schema

Config is stored in `userData/config.json`:

```json
{
  "version": "1.0.0",
  "theme": "dark",
  "defaultView": "grid",
  "syncProfiles": [
    {
      "id": "miyoo-mini",
      "name": "Miyoo Mini Plus",
      "enabled": false,
      "basePath": "/path/to/sd/card",
      "systemMappings": {
        "Nintendo Entertainment System": "FC",
        "Super Nintendo": "SFC"
      },
      "artworkSettings": {
        "enabled": true,
        "folder": "Imgs",
        "format": "png",
        "preferredType": "2d"
      }
    }
  ],
  "artwork": {
    "enabled": true,
    "types": ["boxart", "screenshot", "banner", "fanart"],
    "defaultType": "boxart",
    "boxartPreferences": {
      "preferredStyle": "2d",
      "preferredRegion": "us",
      "fallbackRegions": ["wor", "us", "eu", "jp"],
      "downloadAllVariants": false
    }
  },
  "scraper": {
    "enabled": false,
    "provider": "screenscraper",
    "thegamesdb": {
      "apiKey": ""
    },
    "credentials": {
      "username": "",
      "password": ""
    },
    "artworkTypes": ["boxart", "screenshot"]
  }
}
```

## Distribution

### For End Users

Users should download pre-built installers from the [Releases page](https://github.com/grantium/romtunes/releases).

### Code Signing (Future)

**macOS:**
- Requires Apple Developer account ($99/year)
- App must be notarized to avoid Gatekeeper warnings
- Currently using ad-hoc signing (requires `xattr -cr` command)

**Windows:**
- Code signing certificate recommended for Windows SmartScreen
- Unsigned apps show warnings to users
- Users can still install by clicking "More info" → "Run anyway"

### Auto-Updates (Future)

The app is configured for electron-builder but auto-updates are not yet enabled. To add auto-updates:
- Set up a release server (GitHub Releases, S3, etc.)
- Configure `publish` in package.json
- Add update checking code in main.js
- Sign your builds (required for auto-updates on macOS)

## Development Tips

### Opening DevTools

```bash
npm run dev
```

Or add this to main.js temporarily:
```javascript
mainWindow.webContents.openDevTools();
```

### Rebuilding Native Modules

If you change Electron versions:
```bash
npm run rebuild
```

### Testing Builds Locally

Test the built app before releasing:
```bash
npm run build
# Then open the app from dist/ folder
```

### Debugging Database Issues

The SQLite database is stored in:
- **macOS**: `~/Library/Application Support/romtunes/romtunes.db`
- **Windows**: `%APPDATA%\romtunes\romtunes.db`
- **Linux**: `~/.config/romtunes/romtunes.db`

Use a SQLite browser to inspect during development.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Follow existing patterns in the codebase
- Add comments for complex logic
- Update README.md for user-facing changes

### Testing Checklist

Before submitting a PR:
- [ ] Test on your platform
- [ ] Test with multiple ROM systems
- [ ] Test sync to device (if changes affect sync)
- [ ] Test with and without artwork
- [ ] Check for console errors
- [ ] Verify database migrations work
- [ ] Test settings persist correctly

## License

MIT License - See LICENSE file for details.
