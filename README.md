# RomTunes

**iTunes for ROM Management** - A beautiful Electron app for organizing your emulation library.

![RomTunes](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- **iTunes-Inspired Interface** - Clean, modern UI with dark theme
- **Smart ROM Scanning** - Automatically detect and import ROMs from directories
- **Multi-System Support** - Supports 20+ emulation platforms
- **Library Organization** - Filter by system, search, and sort your collection
- **Favorites** - Mark your favorite games for quick access
- **Grid & List Views** - Choose your preferred browsing style
- **Statistics Dashboard** - Track total ROMs, systems, and library size
- **Fast Search** - Instantly find games in your library
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

### Library Management

- **All ROMs**: View your entire collection
- **Favorites**: Quick access to starred games
- **System Filters**: Browse by specific platform
- **Statistics**: View total ROMs, systems, and storage usage

## Project Structure

```
romtunes/
├── src/
│   ├── main.js              # Electron main process
│   ├── database.js          # SQLite database handler
│   ├── preload.js           # Preload script for IPC
│   └── renderer/
│       ├── index.html       # Main UI
│       ├── styles.css       # Styling
│       └── renderer.js      # UI logic
├── package.json
└── README.md
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
  rating INTEGER
);
```

## Future Enhancements

Potential features for future versions:

- Launch ROMs with configured emulators
- Cover art scraping and display
- Play time tracking
- Custom tags and categories
- Export/import library
- ROM file verification (checksums)
- Multi-language support
- Cloud sync capabilities

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
