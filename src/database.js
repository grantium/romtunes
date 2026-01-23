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
        rating INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_system ON roms(system);
      CREATE INDEX IF NOT EXISTS idx_name ON roms(name);
      CREATE INDEX IF NOT EXISTS idx_favorite ON roms(favorite);
    `);
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

    // Sorting
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'ASC';
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
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
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

  close() {
    this.db.close();
  }
}

module.exports = RomDatabase;
