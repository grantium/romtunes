const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class RomDatabase {
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'romtunes.db');

    this.db = new Database(dbPath);
    this.initDatabase();
  }

  initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        size INTEGER,
        extension TEXT,
        system TEXT,
        dateAdded TEXT,
        lastPlayed TEXT,
        playCount INTEGER DEFAULT 0,
        favorite INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 0,
        boxart TEXT,
        screenshot TEXT,
        banner TEXT,
        fanart TEXT,
        synced INTEGER DEFAULT 0,
        lastSynced TEXT
      );

      CREATE TABLE IF NOT EXISTS saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        romId INTEGER NOT NULL,
        saveType TEXT NOT NULL,
        filename TEXT NOT NULL,
        localPath TEXT,
        devicePath TEXT,
        size INTEGER,
        lastModified TEXT,
        lastSynced TEXT,
        syncDirection TEXT,
        FOREIGN KEY (romId) REFERENCES roms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profileId TEXT NOT NULL,
        profileName TEXT,
        timestamp TEXT NOT NULL,
        operation TEXT NOT NULL,
        romCount INTEGER DEFAULT 0,
        romsSynced INTEGER DEFAULT 0,
        romsSkipped INTEGER DEFAULT 0,
        romsErrored INTEGER DEFAULT 0,
        savesCopied INTEGER DEFAULT 0,
        savesSkipped INTEGER DEFAULT 0,
        totalSize INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        errorMessage TEXT,
        details TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_system ON roms(system);
      CREATE INDEX IF NOT EXISTS idx_name ON roms(name);
      CREATE INDEX IF NOT EXISTS idx_favorite ON roms(favorite);
      CREATE INDEX IF NOT EXISTS idx_saves_romId ON saves(romId);
      CREATE INDEX IF NOT EXISTS idx_sync_history_timestamp ON sync_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_history_profileId ON sync_history(profileId);
    `);

    // Migrate existing database if needed
    this.migrateSchema();
  }

  migrateSchema() {
    // Check if artwork columns exist, add them if not
    const columns = this.db.prepare("PRAGMA table_info(roms)").all();
    const columnNames = columns.map(c => c.name);

    const newColumns = [
      'boxart TEXT',
      'boxart2d TEXT',
      'boxart3d TEXT',
      'boxartRegion TEXT',
      'screenshot TEXT',
      'banner TEXT',
      'fanart TEXT',
      'synced INTEGER DEFAULT 0',
      'lastSynced TEXT'
    ];

    for (const col of newColumns) {
      const colName = col.split(' ')[0];
      if (!columnNames.includes(colName)) {
        try {
          this.db.exec(`ALTER TABLE roms ADD COLUMN ${col}`);
        } catch (error) {
          // Column might already exist
          console.log(`Column ${colName} already exists or error:`, error.message);
        }
      }
    }
  }

  addRom(rom) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO roms (name, filename, path, size, extension, system, dateAdded)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      return stmt.run(
        rom.name,
        rom.filename,
        rom.path,
        rom.size,
        rom.extension,
        rom.system,
        rom.dateAdded
      );
    } catch (error) {
      console.error('Error adding ROM:', error);
      return null;
    }
  }

  getRoms(filters = {}) {
    let query = 'SELECT * FROM roms WHERE 1=1';
    const params = [];

    if (filters.system && filters.system !== 'all') {
      query += ' AND system = ?';
      params.push(filters.system);
    }

    if (filters.search) {
      query += ' AND name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    if (filters.favorite) {
      query += ' AND favorite = 1';
    }

    // Sorting - whitelist allowed columns to prevent SQL injection
    const allowedSortColumns = ['name', 'system', 'dateAdded', 'size', 'lastPlayed', 'rating'];
    const sortBy = allowedSortColumns.includes(filters.sortBy) ? filters.sortBy : 'name';
    const sortOrder = filters.sortOrder === 'DESC' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getSystems() {
    const stmt = this.db.prepare(`
      SELECT system, COUNT(*) as count
      FROM roms
      GROUP BY system
      ORDER BY system
    `);
    return stmt.all();
  }

  deleteRom(id) {
    const stmt = this.db.prepare('DELETE FROM roms WHERE id = ?');
    return stmt.run(id);
  }

  updateRom(id, updates) {
    // Whitelist allowed fields to prevent SQL injection
    const allowedFields = [
      'name', 'filename', 'path', 'size', 'extension', 'system',
      'dateAdded', 'lastPlayed', 'playCount', 'favorite', 'rating',
      'boxart', 'boxart2d', 'boxart3d', 'boxartRegion',
      'screenshot', 'banner', 'fanart', 'synced', 'lastSynced'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE roms SET ${fields.join(', ')} WHERE id = ?
    `);

    return stmt.run(...values);
  }

  getStats() {
    const totalRoms = this.db.prepare('SELECT COUNT(*) as count FROM roms').get();
    const totalSize = this.db.prepare('SELECT SUM(size) as size FROM roms').get();
    const systemCount = this.db.prepare('SELECT COUNT(DISTINCT system) as count FROM roms').get();

    return {
      totalRoms: totalRoms.count,
      totalSize: totalSize.size || 0,
      systemCount: systemCount.count
    };
  }

  // Save game management
  addSave(save) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO saves
      (romId, saveType, filename, localPath, devicePath, size, lastModified, lastSynced, syncDirection)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      save.romId,
      save.saveType,
      save.filename,
      save.localPath || null,
      save.devicePath || null,
      save.size || 0,
      save.lastModified || new Date().toISOString(),
      save.lastSynced || null,
      save.syncDirection || null
    );
  }

  getSaves(romId) {
    const stmt = this.db.prepare('SELECT * FROM saves WHERE romId = ?');
    return stmt.all(romId);
  }

  getAllSaves() {
    const stmt = this.db.prepare('SELECT * FROM saves');
    return stmt.all();
  }

  updateSave(id, updates) {
    const allowedFields = [
      'localPath', 'devicePath', 'size', 'lastModified', 'lastSynced', 'syncDirection'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE saves SET ${fields.join(', ')} WHERE id = ?
    `);

    return stmt.run(...values);
  }

  deleteSave(id) {
    const stmt = this.db.prepare('DELETE FROM saves WHERE id = ?');
    return stmt.run(id);
  }

  // Sync history management
  addSyncHistory(history) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_history
      (profileId, profileName, timestamp, operation, romCount, romsSynced, romsSkipped, romsErrored,
       savesCopied, savesSkipped, totalSize, duration, status, errorMessage, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      history.profileId,
      history.profileName || null,
      history.timestamp || new Date().toISOString(),
      history.operation || 'sync',
      history.romCount || 0,
      history.romsSynced || 0,
      history.romsSkipped || 0,
      history.romsErrored || 0,
      history.savesCopied || 0,
      history.savesSkipped || 0,
      history.totalSize || 0,
      history.duration || 0,
      history.status || 'success',
      history.errorMessage || null,
      history.details ? JSON.stringify(history.details) : null
    );
  }

  getSyncHistory(limit = 50, profileId = null) {
    let query = 'SELECT * FROM sync_history';
    const params = [];

    if (profileId) {
      query += ' WHERE profileId = ?';
      params.push(profileId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params);

    // Parse JSON details
    return results.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));
  }

  getLastSync(profileId) {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_history
      WHERE profileId = ? AND status = 'success'
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const result = stmt.get(profileId);

    if (result && result.details) {
      result.details = JSON.parse(result.details);
    }

    return result;
  }

  getSyncStats(profileId = null) {
    let query = `
      SELECT
        COUNT(*) as totalSyncs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successfulSyncs,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failedSyncs,
        SUM(romsSynced) as totalRomsSynced,
        SUM(savesCopied) as totalSavesCopied,
        MAX(timestamp) as lastSyncTime
      FROM sync_history
    `;

    const params = [];
    if (profileId) {
      query += ' WHERE profileId = ?';
      params.push(profileId);
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params);
  }

  clearSyncHistory(olderThanDays = null) {
    if (olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const stmt = this.db.prepare('DELETE FROM sync_history WHERE timestamp < ?');
      return stmt.run(cutoffDate.toISOString());
    } else {
      const stmt = this.db.prepare('DELETE FROM sync_history');
      return stmt.run();
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = RomDatabase;
