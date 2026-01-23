const fs = require('fs').promises;
const path = require('path');

class SyncManager {
  constructor(config, database) {
    this.config = config;
    this.db = database;
  }

  async syncRoms(profileId, romIds = null, onProgress = null) {
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
    if (romIds) {
      // Sync specific ROMs
      roms = romIds.map(id => {
        const rom = this.db.db.prepare('SELECT * FROM roms WHERE id = ?').get(id);
        return rom;
      }).filter(Boolean);
    } else {
      // Sync all ROMs
      roms = this.db.getRoms({});
    }

    const results = {
      total: roms.length,
      synced: 0,
      skipped: 0,
      errors: []
    };

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

        if (shouldCopy) {
          // Copy the ROM file
          await fs.copyFile(rom.path, targetPath);

          // Update database
          this.db.updateRom(rom.id, {
            synced: 1,
            lastSynced: new Date().toISOString()
          });

          results.synced++;
        } else {
          results.skipped++;
        }

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: roms.length,
            rom: rom.name,
            system: rom.system
          });
        }
      } catch (error) {
        results.errors.push({
          rom: rom.name,
          error: error.message
        });
      }
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

        // Create artwork directories
        const targetDir = path.join(profile.basePath, targetFolder);

        for (const artType of artworkTypes) {
          const artPath = this.config.getArtworkPath(rom.id, artType);

          try {
            await fs.access(artPath);

            // Artwork exists, copy it
            const artDir = path.join(targetDir, artType);
            await fs.mkdir(artDir, { recursive: true });

            const artFilename = path.basename(rom.filename, rom.extension) + '.jpg';
            const targetArtPath = path.join(artDir, artFilename);

            await fs.copyFile(artPath, targetArtPath);
            results.synced++;
          } catch {
            // Artwork doesn't exist, skip
          }
        }
      } catch (error) {
        results.errors.push({
          rom: rom.name,
          error: error.message
        });
      }
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
}

module.exports = SyncManager;
