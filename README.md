# RomTunes

**iTunes for ROM Management** - A beautiful Electron app for organizing your emulation library.

![RomTunes](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Installation

### Download

**Download pre-built installers from the [Releases page](https://github.com/grantium/romtunes/releases)**

- **Windows**: Download and run the `.exe` installer
- **macOS**: Download the `.dmg` file
- **Linux**: Download the `.AppImage` or `.deb` package

### ⚠️ Important: macOS Users

**The app is currently unsigned. You MUST run this command before launching:**

```bash
xattr -cr "/Applications/RomTunes.app"
```

Or if you haven't moved it to Applications yet:

```bash
xattr -cr "RomTunes.app"
```

This removes the quarantine flag that macOS adds to unsigned apps. Without this, the app won't open.

**Why is this needed?**
- Code signing certificates cost $99/year from Apple
- This is a free, open-source project
- The `xattr` command is safe and only removes the quarantine flag

## Features

### Library Management
- **Smart ROM Scanning** - Import ROMs from any folder, scans recursively
- **Multi-System Support** - 20+ systems: NES, SNES, GB, GBA, N64, PS1, Genesis, and more
- **Beautiful Interface** - Grid and list views with dark theme
- **Fast Search & Filter** - Find games instantly by name or system
- **Favorites** - Star your favorite games for quick access
- **Statistics** - Track total ROMs, systems, and library size

### Artwork & Metadata
- **Auto-Scraping** - Download box art, screenshots, and metadata from TheGamesDB or ScreenScraper
- **Multiple Artwork Types** - Box art (2D/3D), screenshots, banners, fan art
- **Region Support** - Prefer US, EU, JP, or World region artwork
- **Manual Import** - Drag and drop your own artwork
- **Bulk Operations** - Scrape artwork for entire library at once

### Device Sync
- **Handheld Device Sync** - Copy ROMs to SD cards for portable devices
- **Pre-configured Profiles** - Miyoo Mini, Anbernic RG35XX, Steam Deck, Retroid Pocket
- **System Mapping** - Map each console to device-specific folders
- **Smart Sync** - Only copies new/changed files
- **Artwork Sync** - Automatically sync artwork in firmware-specific formats
- **Save File Sync** - Two-way sync of save files between library and device
- **Sync Verification** - Verify which ROMs are actually on your device

## Quick Start

### 1. Import Your ROMs

1. Click **"Import ROMs"** in the sidebar
2. Choose **Folder** (scans all subdirectories) or **Files** (individual ROMs)
3. ROMs are automatically detected and added to your library

### 2. Get Artwork (Optional)

**Auto-Scraping:**
1. Go to Settings (⚙️) → Scraper tab
2. Select **TheGamesDB** or **ScreenScraper**
3. For ScreenScraper: Enter your username/password (free registration at screenscraper.fr)
4. For TheGamesDB: Enter your API key (free registration at forums.thegamesdb.net)
5. Click **"Test"** to verify credentials
6. Click **"Scrape All ROMs"** or scrape individual ROMs

**Manual Import:**
1. Click any ROM to open details
2. Click **"Import Box Art"** or **"Import Screenshot"**
3. Select an image file

### 3. Sync to Device (Optional)

1. Insert your device's SD card
2. Go to Settings (⚙️) → Sync Profiles tab
3. Select a profile (Miyoo Mini, Anbernic, etc.) or use Custom
4. Click **Browse** to set your SD card path
5. Enable the profile with the toggle switch
6. Click **Sync (🔄)** in the toolbar
7. Select your profile and click **"Start Sync"**

**Verify Sync Status:**
After syncing, click **"Verify Sync Status"** to check which ROMs are actually on your device. This will:
- Scan your device to verify file presence
- Update badges to show "✓ Synced" or "💻 On Computer"
- Remove missing files from library if they don't exist anywhere

## Supported Systems

- **Nintendo**: NES, SNES, N64, Game Boy, GBC, GBA, DS, 3DS, GameCube, Wii
- **Sega**: Genesis, Master System, Game Gear
- **Sony**: PlayStation, PSP

**Supported Extensions:** `.nes`, `.smc`, `.sfc`, `.gb`, `.gbc`, `.gba`, `.n64`, `.z64`, `.nds`, `.iso`, `.cue`, `.bin`, `.md`, `.gen`, `.gg`, `.sms`, `.rom`, `.zip`, `.7z`

## Syncing to Popular Devices

### Miyoo Mini / Mini Plus
- Profile: **Miyoo Mini Plus**
- Firmware: OnionOS, MinUI
- Path: Mount point of SD card
- Mappings: FC (NES), SFC (SNES), GBA, etc.

### Anbernic RG35XX / RG353
- Profile: **Anbernic RG35XX**
- Firmware: GarlicOS, Knulli, MuOS
- Path: `/roms` or SD card mount point
- Mappings: Standard system names

### Steam Deck
- Profile: **Steam Deck**
- Firmware: EmuDeck
- Path: `/home/deck/Emulation/roms`
- Mappings: EmuDeck structure

### Retroid Pocket
- Profile: **Retroid Pocket**
- Path: Device storage or SD card
- Mappings: Android folder structure

## Configuration

All settings in Settings (⚙️) button:

### Sync Profiles Tab
- Enable/disable device profiles
- Set SD card paths
- View and customize system mappings
- Add custom system mappings

### Scraper Tab
- Choose scraper provider (TheGamesDB or ScreenScraper)
- Configure API keys/credentials
- Test connection
- Select artwork types
- Bulk scrape all ROMs

### Artwork Tab
- Configure box art preferences (2D vs 3D)
- Set preferred region (US, EU, JP, World)
- Device-specific artwork settings

## Data Storage

RomTunes stores everything locally in your system's user data directory:

- **macOS**: `~/Library/Application Support/romtunes/`
- **Windows**: `%APPDATA%\romtunes\`
- **Linux**: `~/.config/romtunes/`

```
userData/
├── romtunes.db          # SQLite database
├── config.json          # Settings & sync profiles
├── saves/               # Save files organized by ROM
└── artwork/
    ├── boxart/          # Box art images
    ├── screenshots/     # Screenshot images
    ├── banners/         # Banner images
    └── fanart/          # Fan art images
```

## Tips & Tricks

- **Bulk Selection**: Hold Shift to select multiple ROMs for batch operations
- **Filter by System**: Click any system in the sidebar to view only those ROMs
- **Favorites**: Click the star icon on ROM cards for quick access
- **Sync Only What Changed**: RomTunes only copies new/modified files, saving time
- **Save File Sync**: Enable "Sync Save Files" when syncing to backup saves between device and computer
- **Verify After Sync**: Use "Verify Sync Status" to confirm files are actually on your device

## Troubleshooting

### macOS: App won't open
Run: `xattr -cr "/Applications/RomTunes.app"`

### ScreenScraper: Rate limit errors
- Register for a free account at screenscraper.fr
- Registered users get better rate limits (2 seconds between requests)
- Consider donating for even better limits

### TheGamesDB: No results found
- Clean ROM filenames work best (remove region codes, version numbers)
- Use the search feature to try different name variations

### Sync: ROMs not appearing on device
- Check system mappings in Settings → Sync Profiles
- Verify SD card path is correct
- Run "Verify Sync Status" to check actual device state
- Check device firmware expects ROMs in specific folders

### Scanner: Slow when importing from external drive
- Scanner now filters file types before checking
- Progress is shown in real-time
- Large folders may still take time on slow USB connections

## Building from Source

See [BUILD.md](BUILD.md) for development setup and building instructions.

## Contributing

Contributions are welcome! Please submit a Pull Request.

## License

MIT License - See LICENSE file for details.

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

Scrapers:
- [TheGamesDB](https://thegamesdb.net/)
- [ScreenScraper](https://www.screenscraper.fr/)

---

**Note**: RomTunes is a library management tool. You must own the games you're managing and comply with all applicable laws regarding ROM usage.
