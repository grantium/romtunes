# Release Guide

This guide explains how to create and distribute RomTunes releases.

## Quick Release Process

### 1. Prepare for Release

```bash
# Ensure you're on main branch with latest code
git checkout main
git pull

# Install dependencies
npm install

# Test the app
npm start
```

### 2. Build for All Platforms

**On macOS** (recommended - can build for all platforms):
```bash
npm run build:all
```

**On Windows** (can build Windows and Linux):
```bash
npm run build:win
npm run build:linux
```

**On Linux** (can build Linux only):
```bash
npm run build:linux
```

### 3. Test the Built Apps

Before releasing, test the installers:

- **Windows**: Run the .exe installer and test the app
- **macOS**: Open the .dmg and test the app
- **Linux**: Run the AppImage and test the app

### 4. Create GitHub Release

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag version: `v1.0.0`
4. Release title: `RomTunes v1.0.0`
5. Write release notes (see template below)
6. Upload files from `dist/`:
   - Windows: `RomTunes Setup 1.0.0.exe` and `RomTunes 1.0.0.exe`
   - macOS: `RomTunes-1.0.0.dmg`
   - Linux: `RomTunes-1.0.0.AppImage` and `romtunes_1.0.0_amd64.deb`
7. Click "Publish release"

## Release Notes Template

```markdown
# RomTunes v1.0.0

## 🎮 What is RomTunes?

iTunes for ROM management - A beautiful Electron app for organizing your emulation library with device sync, automatic artwork scraping, and more!

## 📥 Downloads

### Windows
- [RomTunes-Setup-1.0.0.exe](link) - Installer (Recommended)
- [RomTunes-1.0.0.exe](link) - Portable version

### macOS
- [RomTunes-1.0.0.dmg](link) - Disk image

### Linux
- [RomTunes-1.0.0.AppImage](link) - Universal (Recommended)
- [romtunes_1.0.0_amd64.deb](link) - Debian/Ubuntu package

## ✨ Features

- iTunes-style ROM library management
- Sync to handheld devices (Miyoo Mini, Anbernic, Steam Deck, etc.)
- Automatic artwork scraping via ScreenScraper.fr
- Support for 20+ emulation systems
- Grid and list views
- Favorites and search
- And much more!

## 📖 Getting Started

1. Download the installer for your platform
2. Install and launch RomTunes
3. Click "Import ROMs" to scan your ROM folders
4. (Optional) Configure ScreenScraper in Settings for automatic artwork
5. (Optional) Set up device sync profiles for your handhelds

## 🐛 Known Issues

- None yet! Report issues at [GitHub Issues](link)

## 🔧 System Requirements

- Windows 10 or later
- macOS 10.13 or later
- Linux (most distributions)
- 100MB free disk space

## 📝 Full Changelog

See [CHANGELOG.md](link) for details.
```

## Version Numbering

Use [Semantic Versioning](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features, backwards compatible
- **Patch** (1.0.1): Bug fixes

## Changelog Maintenance

Update `CHANGELOG.md` before each release:

```markdown
# Changelog

## [1.0.0] - 2024-01-XX

### Added
- Initial release
- ROM library management
- Device sync for handhelds
- ScreenScraper integration
- Support for 20+ systems

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)
```

## Platform Notes

### Windows

- **Code Signing**: For production releases, sign with a certificate to avoid SmartScreen warnings
- **Installer Types**: NSIS installer and portable version are both created
- **System Tray**: Currently not implemented

### macOS

- **Notarization**: Required for distribution outside Mac App Store
- **App Signing**: Required for Gatekeeper
- **DMG**: Easy drag-and-drop installation

### Linux

- **AppImage**: Universal, works on all distros, no installation required
- **Debian Package**: For apt-based systems (Ubuntu, Debian, Mint)
- **Permissions**: AppImage needs execute permission: `chmod +x RomTunes-*.AppImage`

## Troubleshooting Builds

### Windows Build Issues

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build:win
```

### macOS Signing Issues

If you get signing errors, you can build unsigned:
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:mac
```

### Linux Build Issues

Ensure you have required packages:
```bash
# Debian/Ubuntu
sudo apt-get install fakeroot dpkg

# Fedora/RHEL
sudo dnf install rpm-build
```

## CI/CD (Future)

For automated releases, consider GitHub Actions:
- Build on push to tags
- Automatically create releases
- Upload artifacts
- Cross-platform builds

## Support

For build issues, check:
1. [electron-builder docs](https://www.electron.build/)
2. GitHub Issues
3. Community forums
