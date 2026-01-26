const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class SaveManager {
  constructor(config, database) {
    this.config = config;
    this.db = database;
    this.savesPath = path.join(app.getPath('userData'), 'saves');
  }

  // Save file extensions by system
  getSaveExtensions(system) {
    const saveExtensions = {
      'Nintendo Entertainment System': ['.sav', '.state', '.st0', '.st1', '.st2', '.st3'],
      'Super Nintendo': ['.srm', '.sav', '.state', '.st0', '.st1', '.st2', '.st3'],
      'Game Boy': ['.sav', '.sa1', '.sa2', '.sa3', '.state', '.st0', '.st1'],
      'Game Boy Color': ['.sav', '.sa1', '.sa2', '.sa3', '.state', '.st0', '.st1'],
      'Game Boy Advance': ['.sav', '.sa1', '.sa2', '.sa3', '.state', '.st0', '.st1'],
      'Nintendo 64': ['.sra', '.eep', '.fla', '.mpk', '.state', '.st0', '.st1'],
      'Nintendo DS': ['.dsv', '.sav', '.sa1', '.sa2', '.state'],
      'Sega Genesis': ['.srm', '.sav', '.state', '.st0', '.st1'],
      'Game Gear': ['.sav', '.state'],
      'Sega Master System': ['.sav', '.state'],
      'PlayStation': ['.mcr', '.mcd', '.srm', '.state'],
      'PSP': ['.sav', '.ppst']
    };

    return saveExtensions[system] || ['.sav', '.srm', '.state'];
  }

  // Get save file type from extension
  getSaveType(extension) {
    const saveTypes = {
      '.sav': 'SRAM',
      '.srm': 'SRAM',
      '.sra': 'SRAM',
      '.eep': 'EEPROM',
      '.fla': 'Flash',
      '.mpk': 'MemPak',
      '.mcr': 'Memory Card',
      '.mcd': 'Memory Card',
      '.dsv': 'Save',
      '.ppst': 'Save State',
      '.state': 'Save State',
      '.st0': 'Save State 0',
      '.st1': 'Save State 1',
      '.st2': 'Save State 2',
      '.st3': 'Save State 3',
      '.sa1': 'Save State 1',
      '.sa2': 'Save State 2',
      '.sa3': 'Save State 3'
    };

    return saveTypes[extension] || 'Save';
  }

  // Get local save directory for a ROM
  getLocalSaveDir(romId) {
    return path.join(this.savesPath, romId.toString());
  }

  // Scan for save files associated with a ROM on the device
  async scanDeviceSaves(rom, deviceBasePath, systemFolder) {
    const saves = [];

    try {
      // Build path to ROM on device
      const romDir = path.join(deviceBasePath, systemFolder);
      const romBaseName = path.basename(rom.filename, rom.extension);

      console.log(`[SaveManager] Scanning device saves for ${rom.name}`);
      console.log(`[SaveManager] ROM dir: ${romDir}`);
      console.log(`[SaveManager] ROM base name: ${romBaseName}`);

      // Check for saves in the ROM directory
      const saveExtensions = this.getSaveExtensions(rom.system);
      console.log(`[SaveManager] Looking for save extensions: ${saveExtensions.join(', ')}`);

      for (const ext of saveExtensions) {
        const saveFilename = romBaseName + ext;
        const savePath = path.join(romDir, saveFilename);

        try {
          const stats = await fs.stat(savePath);

          console.log(`[SaveManager] Found save file: ${saveFilename} (${stats.size} bytes)`);
          saves.push({
            romId: rom.id,
            saveType: this.getSaveType(ext),
            filename: saveFilename,
            devicePath: savePath,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        } catch {
          // Save file doesn't exist, skip
        }
      }

      // Also check common save subdirectories (for some firmwares)
      const saveDirs = ['Saves', 'saves', '.saves'];

      for (const saveDir of saveDirs) {
        const saveDirPath = path.join(romDir, saveDir);

        try {
          await fs.access(saveDirPath);

          for (const ext of saveExtensions) {
            const saveFilename = romBaseName + ext;
            const savePath = path.join(saveDirPath, saveFilename);

            try {
              const stats = await fs.stat(savePath);

              saves.push({
                romId: rom.id,
                saveType: this.getSaveType(ext),
                filename: saveFilename,
                devicePath: savePath,
                size: stats.size,
                lastModified: stats.mtime.toISOString()
              });
            } catch {
              // Save file doesn't exist, skip
            }
          }
        } catch {
          // Save directory doesn't exist, skip
        }
      }
    } catch (error) {
      console.error(`Error scanning device saves for ${rom.name}:`, error.message);
    }

    return saves;
  }

  // Scan local save directory for a ROM
  async scanLocalSaves(rom) {
    const saves = [];
    const localSaveDir = this.getLocalSaveDir(rom.id);

    try {
      await fs.access(localSaveDir);
      const files = await fs.readdir(localSaveDir);

      for (const file of files) {
        const filePath = path.join(localSaveDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();

          saves.push({
            romId: rom.id,
            saveType: this.getSaveType(ext),
            filename: file,
            localPath: filePath,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    } catch (error) {
      // Local save directory doesn't exist yet
    }

    return saves;
  }

  // Sync saves for a ROM to device
  async syncSavesToDevice(rom, deviceBasePath, systemFolder) {
    const results = {
      copied: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Get local saves
      const localSaves = await this.scanLocalSaves(rom);

      if (localSaves.length === 0) {
        return results;
      }

      // Determine device save directory
      const romDir = path.join(deviceBasePath, systemFolder);
      const savesDir = path.join(romDir, 'Saves');

      // Check if firmware uses a Saves subdirectory
      let usesSaveSubdir = false;
      try {
        await fs.access(savesDir);
        usesSaveSubdir = true;
      } catch {
        // No Saves subdirectory, saves go next to ROMs
      }

      const targetDir = usesSaveSubdir ? savesDir : romDir;

      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Sync each save file
      for (const save of localSaves) {
        const targetPath = path.join(targetDir, save.filename);

        try {
          // Check if save exists on device
          let shouldCopy = true;
          try {
            const targetStats = await fs.stat(targetPath);
            const localStats = await fs.stat(save.localPath);

            // Compare timestamps - only copy if local is newer
            if (new Date(localStats.mtime) <= new Date(targetStats.mtime)) {
              shouldCopy = false;
              results.skipped++;
            }
          } catch {
            // Target doesn't exist, copy
          }

          if (shouldCopy) {
            await fs.copyFile(save.localPath, targetPath);
            results.copied++;

            // Update database
            this.db.updateSave(save.id, {
              devicePath: targetPath,
              lastSynced: new Date().toISOString(),
              syncDirection: 'to-device'
            });
          }
        } catch (error) {
          results.errors.push({
            save: save.filename,
            error: error.message
          });
        }
      }
    } catch (error) {
      console.error(`Error syncing saves to device for ${rom.name}:`, error.message);
    }

    return results;
  }

  // Sync saves from device to local
  async syncSavesFromDevice(rom, deviceBasePath, systemFolder) {
    const results = {
      copied: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Get device saves
      const deviceSaves = await this.scanDeviceSaves(rom, deviceBasePath, systemFolder);

      console.log(`[SaveManager] Found ${deviceSaves.length} save(s) on device for ${rom.name}`);

      if (deviceSaves.length === 0) {
        return results;
      }

      // Ensure local save directory exists
      const localSaveDir = this.getLocalSaveDir(rom.id);
      await fs.mkdir(localSaveDir, { recursive: true });
      console.log(`[SaveManager] Local save directory: ${localSaveDir}`);

      // Sync each save file
      for (const save of deviceSaves) {
        const localPath = path.join(localSaveDir, save.filename);

        try {
          // Check if save exists locally
          let shouldCopy = true;
          try {
            const localStats = await fs.stat(localPath);
            const deviceStats = await fs.stat(save.devicePath);

            // Compare timestamps - only copy if device is newer
            if (new Date(deviceStats.mtime) <= new Date(localStats.mtime)) {
              console.log(`[SaveManager] Skipping ${save.filename} (local is newer or same)`);
              shouldCopy = false;
              results.skipped++;
            } else {
              console.log(`[SaveManager] Device save is newer: ${save.filename}`);
            }
          } catch {
            // Local doesn't exist, copy
            console.log(`[SaveManager] Local save doesn't exist: ${save.filename}`);
          }

          if (shouldCopy) {
            console.log(`[SaveManager] Copying from device: ${save.devicePath} → ${localPath}`);
            await fs.copyFile(save.devicePath, localPath);
            results.copied++;

            // Add to database
            this.db.addSave({
              ...save,
              localPath,
              lastSynced: new Date().toISOString(),
              syncDirection: 'from-device'
            });
            console.log(`[SaveManager] Successfully copied and added to database`);
          }
        } catch (error) {
          console.error(`[SaveManager] Error syncing save ${save.filename}:`, error.message);
          results.errors.push({
            save: save.filename,
            error: error.message
          });
        }
      }
    } catch (error) {
      console.error(`Error syncing saves from device for ${rom.name}:`, error.message);
    }

    console.log(`[SaveManager] Sync from device complete: ${results.copied} copied, ${results.skipped} skipped, ${results.errors.length} errors`);
    return results;
  }

  // Two-way sync - sync both directions
  async syncSavesBothWays(rom, deviceBasePath, systemFolder) {
    console.log(`[SaveManager] Starting two-way save sync for ${rom.name}`);
    console.log(`[SaveManager] Device base path: ${deviceBasePath}`);
    console.log(`[SaveManager] System folder: ${systemFolder}`);

    const toDeviceResults = await this.syncSavesToDevice(rom, deviceBasePath, systemFolder);
    console.log(`[SaveManager] To device: ${toDeviceResults.copied} copied, ${toDeviceResults.skipped} skipped`);

    const fromDeviceResults = await this.syncSavesFromDevice(rom, deviceBasePath, systemFolder);
    console.log(`[SaveManager] From device: ${fromDeviceResults.copied} copied, ${fromDeviceResults.skipped} skipped`);

    return {
      toDevice: toDeviceResults,
      fromDevice: fromDeviceResults,
      total: {
        copied: toDeviceResults.copied + fromDeviceResults.copied,
        skipped: toDeviceResults.skipped + fromDeviceResults.skipped,
        errors: [...toDeviceResults.errors, ...fromDeviceResults.errors]
      }
    };
  }
}

module.exports = SaveManager;
