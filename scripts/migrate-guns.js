#!/usr/bin/env node

/**
 * Migrate gun data from items table to new guns/gun_levels tables
 *
 * This script:
 * 1. Creates guns and gun_levels tables if they don't exist
 * 2. Parses weapon items to extract base gun names
 * 3. Creates gun entries for each unique gun
 * 4. Creates gun_level entries linking back to original items
 *
 * The original items and recipes remain intact for backwards compatibility.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'arclab.db');
const db = new Database(dbPath);

// Roman numeral to level number mapping
const LEVEL_MAP = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };

// Pattern to match gun variants like "Arpeggio I", "Anvil IV"
const VARIANT_PATTERN = /^(.+)\s+(I|II|III|IV)$/;

function createTables() {
  console.log('Creating guns and gun_levels tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS guns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      rarity_id INTEGER,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS gun_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gun_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      item_id INTEGER,
      FOREIGN KEY (gun_id) REFERENCES guns(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
      UNIQUE(gun_id, level)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_gun_levels_gun_id ON gun_levels(gun_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gun_levels_item_id ON gun_levels(item_id)');

  console.log('Tables created.\n');
}

function migrateGuns() {
  // Get all weapon items (category_id = 10)
  const weapons = db.prepare(`
    SELECT id, name, rarity_id, image_path
    FROM items
    WHERE category_id = 10
    ORDER BY name
  `).all();

  console.log(`Found ${weapons.length} weapon items to process.\n`);

  // Group weapons by base name
  const gunGroups = {};
  const legendaryGuns = [];

  for (const weapon of weapons) {
    const match = weapon.name.match(VARIANT_PATTERN);

    if (match) {
      // Has level variant (I, II, III, IV)
      const baseName = match[1];
      const levelNum = LEVEL_MAP[match[2]];

      if (!gunGroups[baseName]) {
        gunGroups[baseName] = { levels: [], image_path: weapon.image_path };
      }
      gunGroups[baseName].levels.push({
        level: levelNum,
        item_id: weapon.id,
        rarity_id: weapon.rarity_id
      });
    } else {
      // No variant - likely a legendary gun
      legendaryGuns.push(weapon);
    }
  }

  console.log(`Found ${Object.keys(gunGroups).length} guns with Roman numeral variants (I, II, III, IV)`);
  console.log(`Found ${legendaryGuns.length} guns without variants\n`);

  // Prepare statements
  const insertGun = db.prepare(`
    INSERT OR IGNORE INTO guns (name, rarity_id, image_path)
    VALUES (?, ?, ?)
  `);

  const getGunId = db.prepare('SELECT id FROM guns WHERE name = ?');

  const insertLevel = db.prepare(`
    INSERT OR IGNORE INTO gun_levels (gun_id, level, item_id)
    VALUES (?, ?, ?)
  `);

  // Migrate guns with levels
  const migrateAll = db.transaction(() => {
    for (const [baseName, data] of Object.entries(gunGroups)) {
      // Sort levels and get rarity from level 1
      data.levels.sort((a, b) => a.level - b.level);
      const rarityId = data.levels[0]?.rarity_id || 1;

      // Insert gun
      insertGun.run(baseName, rarityId, data.image_path);
      const gun = getGunId.get(baseName);

      if (!gun) {
        console.log(`  Warning: Could not get ID for gun ${baseName}`);
        continue;
      }

      // Insert levels
      for (const lvl of data.levels) {
        insertLevel.run(gun.id, lvl.level, lvl.item_id);
      }

      console.log(`  ✓ ${baseName} (${data.levels.length} levels)`);
    }

    // Migrate guns without Roman numeral variants (single level)
    for (const weapon of legendaryGuns) {
      insertGun.run(weapon.name, weapon.rarity_id || 5, weapon.image_path);
      const gun = getGunId.get(weapon.name);

      if (gun) {
        insertLevel.run(gun.id, 1, weapon.id);
        console.log(`  ✓ ${weapon.name} (legendary)`);
      }
    }
  });

  migrateAll();
}

function printSummary() {
  const gunCount = db.prepare('SELECT COUNT(*) as count FROM guns').get().count;
  const levelCount = db.prepare('SELECT COUNT(*) as count FROM gun_levels').get().count;

  console.log('\n--- Migration Summary ---');
  console.log(`Guns: ${gunCount}`);
  console.log(`Gun Levels: ${levelCount}`);

  // Show sample data
  console.log('\nSample guns:');
  const samples = db.prepare(`
    SELECT g.name, g.is_legendary, COUNT(gl.id) as levels
    FROM guns g
    LEFT JOIN gun_levels gl ON g.id = gl.gun_id
    GROUP BY g.id
    LIMIT 5
  `).all();

  for (const s of samples) {
    console.log(`  ${s.name}: ${s.levels} level(s)${s.is_legendary ? ' (legendary)' : ''}`);
  }
}

// Run migration
console.log('=== Gun Migration Script ===\n');

try {
  createTables();
  migrateGuns();
  printSummary();
  console.log('\n✓ Migration complete!');
} catch (err) {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
}
