# App Icons

Place your app icons in this directory:

- `icon.icns` - macOS icon (1024x1024)
- `icon.ico` - Windows icon (256x256)
- `icon.png` - Linux icon (512x512)

## Creating Icons

You can create icons from a single PNG file using various tools:

### Online Tools
- [iConvert](https://iconverticons.com/online/)
- [CloudConvert](https://cloudconvert.com/)

### Command Line Tools

**For macOS (.icns):**
```bash
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

**For Windows (.ico):**
Use ImageMagick:
```bash
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

**For Linux (.png):**
Just use a 512x512 PNG file.

## Temporary Icons

If you don't have custom icons yet, electron-builder will use default icons, but it's recommended to create your own for a professional look.

You can use emoji or text-based icons as placeholders:
1. Create a 1024x1024 PNG with your logo/emoji
2. Convert to the formats above
3. Place in this directory
