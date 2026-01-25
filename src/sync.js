const fs = require('fs').promises;
const path = require('path');
const SaveManager = require('./saveManager');

class SyncManager {
  constructor(config, database) {
    this.config = config;
    this.db = database;
    this.saveManager = new SaveManager(config, database);
  }

  async syncRoms(profileId, romIds = null, options = {}, onProgress = null) {
    const { syncSaves = true } = options;
    const startTime = Date.now();

    const profile = this.config.getSyncProfiles().find(p => p.id === profileId);

    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    if (!profile.enabled || !profile.basePath) {
      throw new Error('Profile is not enabled or base path is not set');
    }

    // Verify base path exists
    try {
      await fs.access(profile.basePath);
    } catch (error) {
      throw new Error(`Base path does not exist: ${profile.basePath}`);
    }

    // Get ROMs to sync
    let roms;
    if (romIds && Array.isArray(romIds) && romIds.length > 0) {
      // Sync specific ROMs
      console.log(`[Sync] Syncing ${romIds.length} specific ROMs`);
      roms = romIds.map(id => {
        const rom = this.db.db.prepare('SELECT * FROM roms WHERE id = ?').get(id);
        return rom;
      }).filter(Boolean);
    } else {
      // Sync all ROMs
      console.log(`[Sync] Syncing all ROMs in library`);
      roms = this.db.getRoms({});
    }

    const results = {
      total: roms.length,
      synced: 0,
      skipped: 0,
      errors: [],
      saves: {
        copied: 0,
        skipped: 0,
        errors: []
      }
    };

    let totalSize = 0;

    for (let i = 0; i < roms.length; i++) {
      const rom = roms[i];

      try {
        // Get target folder for this ROM's system
        const targetFolder = profile.systemMappings[rom.system];

        if (!targetFolder) {
          results.skipped++;
          results.errors.push({
            rom: rom.name,
            error: `No folder mapping for system: ${rom.system}`
          });
          continue;
        }

        // Build full target path
        const targetDir = path.join(profile.basePath, targetFolder);
        const targetPath = path.join(targetDir, rom.filename);

        // Create target directory if it doesn't exist
        await fs.mkdir(targetDir, { recursive: true });

        // Check if file already exists and is identical
        let shouldCopy = true;
        try {
          const targetStat = await fs.stat(targetPath);
          const sourceStat = await fs.stat(rom.path);

          if (targetStat.size === sourceStat.size) {
            // Files are same size, skip
            shouldCopy = false;
          }
        } catch {
          // Target doesn't exist, need to copy
        }

        let status = 'skipped';
        if (shouldCopy) {
          // Copy the ROM file
          await fs.copyFile(rom.path, targetPath);

          // Update database
          this.db.updateRom(rom.id, {
            synced: 1,
            lastSynced: new Date().toISOString()
          });

          results.synced++;
          totalSize += rom.size || 0;
          status = 'copied';
        } else {
          results.skipped++;
          status = 'skipped';
        }

        // Sync saves if enabled
        if (syncSaves) {
          try {
            const saveResults = await this.saveManager.syncSavesBothWays(
              rom,
              profile.basePath,
              targetFolder
            );

            results.saves.copied += saveResults.total.copied;
            results.saves.skipped += saveResults.total.skipped;
            results.saves.errors.push(...saveResults.total.errors);
          } catch (saveError) {
            console.error(`Error syncing saves for ${rom.name}:`, saveError.message);
          }
        }

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: roms.length,
            rom: rom.name,
            system: rom.system,
            status,
            targetPath: targetPath.replace(profile.basePath, '')
          });
        }
      } catch (error) {
        results.errors.push({
          rom: rom.name,
          error: error.message
        });
      }
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Log sync operation to history
    try {
      this.db.addSyncHistory({
        profileId: profileId,
        profileName: profile.name || profile.id,
        timestamp: new Date().toISOString(),
        operation: romIds ? 'sync_selected' : 'sync_all',
        romCount: results.total,
        romsSynced: results.synced,
        romsSkipped: results.skipped,
        romsErrored: results.errors.length,
        savesCopied: results.saves.copied,
        savesSkipped: results.saves.skipped,
        totalSize: totalSize,
        duration: duration,
        status: results.errors.length > 0 ? 'partial' : 'success',
        errorMessage: results.errors.length > 0 ? `${results.errors.length} errors occurred` : null,
        details: {
          romIds: romIds || null,
          syncSaves: syncSaves,
          errors: results.errors.slice(0, 10) // Store first 10 errors
        }
      });
    } catch (historyError) {
      console.error('Failed to log sync history:', historyError);
    }

    return results;
  }

  async syncArtwork(profileId, romIds = null, artworkTypes = ['boxart']) {
    const profile = this.config.getSyncProfiles().find(p => p.id === profileId);

    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    if (!profile.enabled || !profile.basePath) {
      throw new Error('Profile is not enabled or base path is not set');
    }

    // Get artwork settings for this profile
    const artworkSettings = profile.artworkSettings || {};
    const artworkEnabled = artworkSettings.enabled !== false;

    if (!artworkEnabled) {
      return { total: 0, synced: 0, skipped: 0, errors: [], message: 'Artwork sync disabled for this profile' };
    }

    // Get ROMs
    let roms;
    if (romIds) {
      roms = romIds.map(id => {
        const rom = this.db.db.prepare('SELECT * FROM roms WHERE id = ?').get(id);
        return rom;
      }).filter(Boolean);
    } else {
      roms = this.db.getRoms({});
    }

    const results = {
      total: roms.length,
      synced: 0,
      skipped: 0,
      errors: []
    };

    for (const rom of roms) {
      try {
        const targetFolder = profile.systemMappings[rom.system];
        if (!targetFolder) continue;

        // Create artwork directories based on firmware requirements
        const targetDir = path.join(profile.basePath, targetFolder);
        const artworkFolder = artworkSettings.folder || 'boxart';
        const preferredType = artworkSettings.preferredType || '2d';

        for (const artType of artworkTypes) {
          if (artType !== 'boxart') continue; // Only sync boxart for now

          // Try to find the best boxart variant for this device
          let sourceArtPath = null;

          // First try preferred style (2d or 3d)
          if (preferredType === '2d') {
            sourceArtPath = this.config.getArtworkPath(rom.id, 'boxart', '2d');
            try {
              await fs.access(sourceArtPath);
            } catch {
              // Try 3D as fallback
              sourceArtPath = this.config.getArtworkPath(rom.id, 'boxart', '3d');
              try {
                await fs.access(sourceArtPath);
              } catch {
                // Try default boxart
                sourceArtPath = this.config.getArtworkPath(rom.id, 'boxart');
              }
            }
          } else {
            // Prefer 3D
            sourceArtPath = this.config.getArtworkPath(rom.id, 'boxart', '3d');
            try {
              await fs.access(sourceArtPath);
            } catch {
              // Try 2D as fallback
              sourceArtPath = this.config.getArtworkPath(rom.id, 'boxart', '2d');
              try {
                await fs.access(sourceArtPath);
              } catch {
                // Try default boxart
                sourceArtPath = this.config.getArtworkPath(rom.id, 'boxart');
              }
            }
          }

          try {
            await fs.access(sourceArtPath);

            // Artwork exists, copy it to firmware-specific location
            const artDir = path.join(targetDir, artworkFolder);
            await fs.mkdir(artDir, { recursive: true });

            // Use firmware-specific filename format
            const artFilename = path.basename(rom.filename, rom.extension) + '.' + (artworkSettings.format || 'png');
            const targetArtPath = path.join(artDir, artFilename);

            // Copy artwork
            // TODO: Add image resizing to match artworkSettings.dimensions if autoConvert is enabled
            // This would require adding an image processing library like 'sharp'
            await fs.copyFile(sourceArtPath, targetArtPath);
            results.synced++;
          } catch (error) {
            // Artwork doesn't exist, skip
            console.log(`Skipping artwork for ${rom.name}: ${error.message}`);
            results.skipped++;
          }
        }
      } catch (error) {
        results.errors.push({
          rom: rom.name,
          error: error.message
        });
      }
    }

    // Add helpful message if nothing was synced
    if (results.synced === 0 && results.skipped > 0) {
      results.message = 'No artwork found to sync. Use the "Scrape Artwork" button to download artwork from ScreenScraper first.';
    }

    return results;
  }

  async verifySync(profileId) {
    const profile = this.config.getSyncProfiles().find(p => p.id === profileId);

    if (!profile || !profile.basePath) {
      return { valid: false, message: 'Invalid profile or base path' };
    }

    try {
      await fs.access(profile.basePath);
      return { valid: true };
    } catch {
      return { valid: false, message: 'Base path does not exist or is not accessible' };
    }
  }

  async getSyncStatus() {
    const syncedCount = this.db.db.prepare('SELECT COUNT(*) as count FROM roms WHERE synced = 1').get();
    const totalCount = this.db.db.prepare('SELECT COUNT(*) as count FROM roms').get();

    return {
      synced: syncedCount.count,
      total: totalCount.count,
      unsynced: totalCount.count - syncedCount.count
    };
  }

  // Import ROMs from device
  async scanDeviceForRoms(profileId) {
    const profile = this.config.getSyncProfiles().find(p => p.id === profileId);

    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    if (!profile.basePath) {
      throw new Error('Profile base path is not set');
    }

    // Verify base path exists
    try {
      await fs.access(profile.basePath);
    } catch (error) {
      throw new Error(`Base path does not exist: ${profile.basePath}`);
    }

    const romExtensions = [
      '.nes', '.smc', '.sfc', '.gb', '.gbc', '.gba',
      '.n64', '.z64', '.v64', '.nds', '.3ds',
      '.iso', '.cue', '.bin', '.gcm', '.cso',
      '.md', '.smd', '.gen', '.gg', '.sms',
      '.rom', '.zip', '.7z'
    ];

    const foundRoms = [];
    const existingPaths = new Set(
      this.db.getRoms({}).map(rom => rom.path)
    );

    // Scan each system folder
    for (const [system, folder] of Object.entries(profile.systemMappings || {})) {
      const systemPath = path.join(profile.basePath, folder);

      try {
        await fs.access(systemPath);
        const files = await fs.readdir(systemPath);

        for (const file of files) {
          const filePath = path.join(systemPath, file);
          const ext = path.extname(file).toLowerCase();

          if (romExtensions.includes(ext)) {
            // Check if already in library
            if (existingPaths.has(filePath)) {
              continue; // Skip, already imported
            }

            try {
              const stats = await fs.stat(filePath);

              if (stats.isFile()) {
                foundRoms.push({
                  name: path.basename(file, ext),
                  filename: file,
                  path: filePath,
                  size: stats.size,
                  extension: ext,
                  system: system,
                  dateAdded: new Date().toISOString(),
                  onDevice: true
                });
              }
            } catch (error) {
              // Skip files that can't be accessed
              console.error(`Error accessing ${filePath}:`, error.message);
            }
          }
        }
      } catch (error) {
        // System folder doesn't exist or can't be accessed
        console.log(`Skipping ${system} - folder not found or inaccessible`);
      }
    }

    return {
      found: foundRoms.length,
      roms: foundRoms
    };
  }

  // Import ROMs from device to library
  async importFromDevice(profileId, romPaths) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const romPath of romPaths) {
      try {
        // Check if ROM already exists
        const existing = this.db.db.prepare('SELECT * FROM roms WHERE path = ?').get(romPath);

        if (existing) {
          results.skipped++;
          continue;
        }

        // Get ROM info
        const stats = await fs.stat(romPath);
        const filename = path.basename(romPath);
        const ext = path.extname(filename).toLowerCase();

        // Detect system from path or extension
        let system = 'Unknown';
        const profile = this.config.getSyncProfiles().find(p => p.id === profileId);

        if (profile && profile.systemMappings) {
          for (const [sys, folder] of Object.entries(profile.systemMappings)) {
            if (romPath.includes(folder)) {
              system = sys;
              break;
            }
          }
        }

        // Add to database
        const rom = {
          name: path.basename(filename, ext),
          filename: filename,
          path: romPath,
          size: stats.size,
          extension: ext,
          system: system,
          dateAdded: new Date().toISOString()
        };

        this.db.addRom(rom);
        results.imported++;

        // Also import any saves found on device
        try {
          const systemFolder = profile.systemMappings[system];
          if (systemFolder) {
            const romId = this.db.db.prepare('SELECT id FROM roms WHERE path = ?').get(romPath).id;
            rom.id = romId;

            await this.saveManager.syncSavesFromDevice(
              rom,
              profile.basePath,
              systemFolder
            );
          }
        } catch (saveError) {
          console.error(`Error importing saves for ${rom.name}:`, saveError.message);
        }
      } catch (error) {
        results.errors.push({
          path: romPath,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = SyncManager;
