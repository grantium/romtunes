# Installing RomTunes

## macOS Installation

Since RomTunes is currently unsigned, macOS Gatekeeper will block it from running. Here's how to install it safely:

### Method 1: Right-Click to Open (Recommended)
1. Download the `.dmg` file for your Mac architecture:
   - Apple Silicon (M1/M2/M3): `RomTunes-x.x.x-arm64.dmg`
   - Intel Macs: `RomTunes-x.x.x-x64.dmg`
2. Open the DMG file
3. **Right-click** (or Control-click) on the RomTunes app
4. Select "Open" from the menu
5. Click "Open" in the dialog that appears
6. Drag RomTunes to your Applications folder

### Method 2: Command Line
1. Download and open the DMG file
2. Open Terminal
3. Run this command:
   ```bash
   xattr -cr "/Volumes/RomTunes/RomTunes.app"
   ```
4. Now you can drag RomTunes to Applications and open it normally

### Why is this necessary?
RomTunes is not code-signed with an Apple Developer certificate ($99/year). This is a security feature in macOS to prevent malware, but it also blocks legitimate unsigned apps. The methods above safely bypass this restriction.

**Note:** This is open-source software. You can always review the source code at https://github.com/grantium/romtunes to verify what it does.

## Windows Installation

1. Download `RomTunes-Setup-x.x.x.exe`
2. Run the installer
3. Windows Defender may show a warning - click "More info" → "Run anyway"
4. Follow the installation wizard

**For portable version:**
1. Download `RomTunes-x.x.x.exe` (portable)
2. Run it directly - no installation needed

## Linux Installation

### AppImage (All Distributions)
1. Download `RomTunes-x.x.x.AppImage`
2. Make it executable:
   ```bash
   chmod +x RomTunes-*.AppImage
   ```
3. Run it:
   ```bash
   ./RomTunes-*.AppImage
   ```

### Debian/Ubuntu (.deb)
```bash
sudo dpkg -i RomTunes-x.x.x.deb
sudo apt-get install -f  # Install dependencies if needed
```

## First Run

After installation:
1. Launch RomTunes
2. Click "Add ROMs" or drag ROM files into the window
3. RomTunes will automatically scan and organize your library
4. Use the search and filter features to browse your collection
5. Set up device sync profiles in Settings → Sync

## Troubleshooting

### macOS: "RomTunes is damaged and can't be opened"
- This means you double-clicked the app instead of right-clicking
- Follow Method 1 or Method 2 above

### Windows: "Windows protected your PC"
- Click "More info" → "Run anyway"
- This is because the app isn't signed with a Windows code signing certificate

### Linux: Permission denied
- Make sure the AppImage is executable: `chmod +x RomTunes-*.AppImage`

## System Requirements

- **macOS**: 10.13 (High Sierra) or later
- **Windows**: Windows 10 or later
- **Linux**: Modern distribution with GLIBC 2.28 or later
- **RAM**: 512 MB minimum
- **Disk**: 100 MB for application + space for ROM library database
