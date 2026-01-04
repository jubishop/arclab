#!/usr/bin/env node

/**
 * Migrate gun recipes from items/recipes tables to gun_level_recipes table
 * Then remove gun items from items table
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'arclab.db');
const db = new Database(dbPath);

// Roman numeral pattern
const VARIANT_PATTERN = /^(.+)\s+(I|II|III|IV)$/;
const LEVEL_MAP = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };

function main() {
  console.log('=== Gun Recipe Migration ===\n');

  db.pragma('foreign_keys = OFF');

  try {
    db.exec('BEGIN TRANSACTION');

    // 1. Create gun_level_recipes table
    console.log('1. Creating gun_level_recipes table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS gun_level_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gun_level_id INTEGER NOT NULL,
        material_item_id INTEGER,
        material_gun_level_id INTEGER,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (gun_level_id) REFERENCES gun_levels(id) ON DELETE CASCADE,
        FOREIGN KEY (material_item_id) REFERENCES items(id) ON DELETE RESTRICT,
        FOREIGN KEY (material_gun_level_id) REFERENCES gun_levels(id) ON DELETE RESTRICT
      )
    `);

    // 2. Get all gun levels with their old item_ids
    console.log('2. Migrating recipes...');
    const gunLevels = db.prepare(`
      SELECT gl.id as gun_level_id, gl.gun_id, gl.level, gl.item_id, g.name as gun_name
      FROM gun_levels gl
      JOIN guns g ON gl.gun_id = g.id
      WHERE gl.item_id IS NOT NULL
    `).all();

    // Build a map of item_id -> gun_level_id for gun items
    const itemToGunLevel = {};
    for (const gl of gunLevels) {
      itemToGunLevel[gl.item_id] = gl.gun_level_id;
    }

    let migratedCount = 0;
    const insertRecipe = db.prepare(`
      INSERT INTO gun_level_recipes (gun_level_id, material_item_id, material_gun_level_id, quantity)
      VALUES (?, ?, ?, ?)
    `);

    for (const gl of gunLevels) {
      // Get recipes for this gun level's item
      const recipes = db.prepare(`
        SELECT r.material_id, r.quantity, m.name as material_name, m.category_id
        FROM recipes r
        JOIN items m ON r.material_id = m.id
        WHERE r.item_id = ?
      `).all(gl.item_id);

      for (const recipe of recipes) {
        // Check if material is a gun item
        const materialGunLevelId = itemToGunLevel[recipe.material_id];

        if (materialGunLevelId) {
          // Material is another gun level
          insertRecipe.run(gl.gun_level_id, null, materialGunLevelId, recipe.quantity);
        } else {
          // Material is a regular item
          insertRecipe.run(gl.gun_level_id, recipe.material_id, null, recipe.quantity);
        }
        migratedCount++;
      }
    }
    console.log(`   Migrated ${migratedCount} recipe entries`);

    // 3. Drop item_id from gun_levels
    console.log('3. Removing item_id from gun_levels...');
    db.exec(`
      CREATE TABLE gun_levels_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gun_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        FOREIGN KEY (gun_id) REFERENCES guns(id) ON DELETE CASCADE,
        UNIQUE(gun_id, level)
      )
    `);
    db.exec(`
      INSERT INTO gun_levels_new (id, gun_id, level)
      SELECT id, gun_id, level FROM gun_levels
    `);
    db.exec('DROP TABLE gun_levels');
    db.exec('ALTER TABLE gun_levels_new RENAME TO gun_levels');
    db.exec('CREATE INDEX idx_gun_levels_gun_id ON gun_levels(gun_id)');

    // 4. Delete gun recipes from recipes table
    console.log('4. Removing gun recipes from recipes table...');
    const weaponItemIds = db.prepare('SELECT id FROM items WHERE category_id = 10').all().map(r => r.id);
    if (weaponItemIds.length > 0) {
      const placeholders = weaponItemIds.map(() => '?').join(',');
      const deleteRecipes = db.prepare(`DELETE FROM recipes WHERE item_id IN (${placeholders})`);
      const result = deleteRecipes.run(...weaponItemIds);
      console.log(`   Deleted ${result.changes} recipe entries`);
    }

    // 5. Delete gun items from items table
    console.log('5. Removing gun items from items table...');
    const deleteItems = db.prepare('DELETE FROM items WHERE category_id = 10');
    const deleteResult = deleteItems.run();
    console.log(`   Deleted ${deleteResult.changes} gun items`);

    // 6. Create index
    db.exec('CREATE INDEX IF NOT EXISTS idx_gun_level_recipes_gun_level_id ON gun_level_recipes(gun_level_id)');

    db.exec('COMMIT');
    db.pragma('foreign_keys = ON');

    // Print summary
    console.log('\n--- Migration Summary ---');
    const gunCount = db.prepare('SELECT COUNT(*) as count FROM guns').get().count;
    const levelCount = db.prepare('SELECT COUNT(*) as count FROM gun_levels').get().count;
    const recipeCount = db.prepare('SELECT COUNT(*) as count FROM gun_level_recipes').get().count;
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE category_id = 10').get().count;

    console.log(`Guns: ${gunCount}`);
    console.log(`Gun Levels: ${levelCount}`);
    console.log(`Gun Level Recipes: ${recipeCount}`);
    console.log(`Remaining weapon items: ${itemCount}`);

    console.log('\n✓ Migration complete!');

  } catch (err) {
    db.exec('ROLLBACK');
    db.pragma('foreign_keys = ON');
    console.error('\n✗ Migration failed:', err.message);
    throw err;
  }
}

main();
