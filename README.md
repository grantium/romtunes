# RomTunes

**iTunes for ROM Management** - A beautiful Electron app for organizing your emulation library.

![RomTunes](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### Core Library Management
- **iTunes-Inspired Interface** - Clean, modern UI with dark theme
- **Smart ROM Scanning** - Automatically detect and import ROMs from directories
- **Multi-System Support** - Supports 20+ emulation platforms
- **Library Organization** - Filter by system, search, and sort your collection
- **Favorites** - Mark your favorite games for quick access
- **Grid & List Views** - Choose your preferred browsing style
- **Statistics Dashboard** - Track total ROMs, systems, and library size
- **Fast Search** - Instantly find games in your library

### Device Sync
- **Handheld Device Sync** - Sync ROMs to different handheld emulators
- **Pre-configured Profiles** - Built-in profiles for Miyoo Mini, Anbernic RG35XX, Steam Deck, Retroid Pocket
- **Custom Folder Mappings** - Map each system to specific device folders
- **Smart Sync** - Only copies new/changed files to save time
- **Artwork Sync** - Optionally sync artwork with your ROMs
- **Sync Progress Tracking** - Real-time progress display during sync operations

### Artwork Management
- **Multiple Artwork Types** - Support for box art, screenshots, banners, and fan art
- **Easy Import** - Drag and drop or select artwork files
- **Organized Storage** - Artwork stored in categorized folders
- **Visual Library** - Display artwork in grid view for beautiful browsing
- **Per-ROM Management** - Import different artwork types for each game

### Configuration & Settings
- **Persistent Settings** - JSON-based configuration system
- **Profile Management** - Enable/disable sync profiles as needed
- **Path Configuration** - Easy setup for device base paths
- **Artwork Preferences** - Choose default artwork type and display options
- **SQLite Database** - Efficient local storage for metadata

## Supported Systems

RomTunes automatically detects ROMs for these systems:

- Nintendo: NES, SNES, N64, Game Boy, GBC, GBA, DS, 3DS
- Sega: Genesis, Master System, Game Gear
- PlayStation: PS1, PSP
- Nintendo: GameCube, Wii
- And more...

### Supported File Extensions

`.nes`, `.smc`, `.sfc`, `.gb`, `.gbc`, `.gba`, `.n64`, `.z64`, `.v64`, `.nds`, `.3ds`, `.iso`, `.cue`, `.bin`, `.gcm`, `.cso`, `.md`, `.smd`, `.gen`, `.gg`, `.sms`, `.rom`, `.zip`, `.7z`

## Installation

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd romtunes
```

2. Install dependencies:
```bash
npm install
```

3. Run the app:
```bash
npm start
```

### Development Mode

To run with DevTools open:
```bash
npm run dev
```

## Usage

### Importing ROMs

1. Click the **"Import ROMs"** button in the sidebar
2. Select a folder containing your ROM files
3. RomTunes will scan all subdirectories and automatically detect ROMs
4. ROMs are added to your library with detected system information

### Organizing Your Library

- **Filter by System**: Click on any system in the sidebar to view only those ROMs
- **Search**: Use the search bar to find games by name
- **Sort**: Choose from Name, System, Date Added, or Size
- **Favorites**: Click the star icon on any ROM to mark as favorite
- **View Modes**: Toggle between Grid and List view
- **ROM Details**: Click on any ROM to view details and manage artwork

### Managing Artwork

1. Click on any ROM card to open the detail view
2. Click **"Import Box Art"** or **"Import Screenshot"**
3. Select an image file (JPG, PNG, GIF, WebP)
4. Artwork is automatically organized and displayed

Artwork is stored in your user data directory:
- Box Art: `userData/artwork/boxart/`
- Screenshots: `userData/artwork/screenshots/`
- Banners: `userData/artwork/banners/`
- Fan Art: `userData/artwork/fanart/`

### Syncing to Handheld Devices

#### Setting Up Sync Profiles

1. Click the **Settings (⚙️)** button in the toolbar
2. Go to the **"Sync Profiles"** tab
3. Choose a pre-configured profile or use Custom:
   - **Miyoo Mini Plus** - Optimized for Miyoo Mini/Plus devices
   - **Anbernic RG35XX** - Configured for Anbernic handhelds
   - **Steam Deck** - EmuDeck folder structure
   - **Retroid Pocket** - Retroid device layout
   - **Custom Profile** - Define your own mappings

4. For each profile:
   - **Enable** the profile with the toggle switch
   - Click **Browse** to set the base path (SD card or device mount point)
   - Review the system folder mappings
   - Each system maps to a specific folder on your device

Example folder mappings:
```
Miyoo Mini Plus:
  - Nintendo Entertainment System → FC
  - Super Nintendo → SFC
  - Game Boy Advance → GBA

Steam Deck:
  - Nintendo Entertainment System → Emulation/roms/nes
  - Super Nintendo → Emulation/roms/snes
  - Game Boy Advance → Emulation/roms/gba
```

#### Running a Sync

1. Insert your device's SD card or connect via USB
2. Click the **Sync (🔄)** button in the toolbar
3. Select your enabled device profile
4. Optional: Check **"Sync Artwork"** to copy artwork files
5. Click **"Start Sync"**
6. Watch the progress as ROMs are copied to your device

The sync operation:
- Only copies new or changed files (skips identical files)
- Creates necessary folders automatically
- Tracks sync status in the database
- Shows real-time progress and summary

### Configuration

Access settings via the Settings (⚙️) button:

**Sync Profiles Tab:**
- Enable/disable profiles
- Set device base paths
- View system folder mappings
- Add custom system mappings

**Artwork Tab:**
- Enable/disable artwork display
- Choose default artwork type
- Configure artwork preferences

## Project Structure

```
romtunes/
├── src/
│   ├── main.js              # Electron main process
│   ├── database.js          # SQLite database handler
│   ├── config.js            # Configuration manager
│   ├── sync.js              # Device sync manager
│   ├── preload.js           # Preload script for IPC
│   └── renderer/
│       ├── index.html       # Main UI with modals
│       ├── styles.css       # Complete styling
│       ├── renderer.js      # Core UI logic
│       └── settings.js      # Settings & sync UI
├── package.json
├── .gitignore
└── README.md
```

### User Data Structure

RomTunes stores data in your system's user data directory:

```
userData/ (OS-specific location)
├── romtunes.db              # SQLite database
├── config.json              # User settings & sync profiles
└── artwork/
    ├── boxart/              # Box art images
    ├── screenshots/         # Screenshot images
    ├── banners/             # Banner images
    └── fanart/              # Fan art images
```

## Technical Details

### Architecture

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Electron, Node.js
- **Database**: better-sqlite3
- **IPC**: Secure contextBridge communication
- **Security**: Context isolation enabled

### Database Schema

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
```

### Configuration Schema

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
      }
    }
  ],
  "artwork": {
    "enabled": true,
    "types": ["boxart", "screenshot", "banner", "fanart"],
    "defaultType": "boxart"
  }
}
```

## Supported Devices

### Pre-configured Sync Profiles

RomTunes includes optimized sync profiles for popular handheld devices:

| Device | Profile ID | Notes |
|--------|-----------|-------|
| Miyoo Mini / Mini Plus | `miyoo-mini` | Uses short folder names (FC, SFC, GBA) |
| Anbernic RG35XX / RG353 | `anbernic-rg35xx` | Standard roms/ structure |
| Steam Deck | `steam-deck` | EmuDeck-compatible paths |
| Retroid Pocket 2/3/4 | `retroid-pocket` | Android-based folder structure |
| Custom | `custom` | Define your own mappings |

Each profile can be customized with:
- Custom base path for your device
- Per-system folder mappings
- Enable/disable as needed

## Future Enhancements

Potential features for future versions:

- **Launch ROMs** - Configure emulators and launch games directly
- **Artwork Scraping** - Auto-download artwork from online databases (ScreenScraper, TheGamesDB)
- **Play Time Tracking** - Track how long you've played each game
- **Custom Tags** - User-defined tags and categories
- **Playlists** - Create custom game collections
- **Export/Import** - Share library configurations
- **ROM Verification** - CRC32/MD5 checksums for ROM authenticity
- **Multi-language** - Interface translations
- **Network Sync** - Sync between computers
- **Bulk Operations** - Batch edit, rename, organize
- **Advanced Filters** - Filter by year, genre, region
- **Emulator Integration** - Detect installed emulators

## Building for Production

To package the app for distribution:

```bash
# Install electron-builder
npm install --save-dev electron-builder

# Build for your platform
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See LICENSE file for details

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

---

**Note**: RomTunes is a library management tool. You must own the games you're managing and comply with all applicable laws regarding ROM usage.
