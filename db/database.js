const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'arclab.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Category enum - IDs stored directly on items
const Category = Object.freeze({
  BASIC_MATERIAL: 1,
  TOPSIDE_MATERIAL: 2,
  ADVANCED_MATERIAL: 3,
  REFINED_MATERIAL: 4,
  QUICK_USE: 5,
  KEY: 6,
  AUGMENT: 7,
  AMMUNITION: 8,
  SHIELD: 9,
  WEAPON: 10,
  MODIFICATION: 11,
  TRINKET: 12,
  MISC: 13
});

// Category names for display
const CategoryNames = Object.freeze({
  [Category.BASIC_MATERIAL]: 'Basic Material',
  [Category.TOPSIDE_MATERIAL]: 'Topside Material',
  [Category.ADVANCED_MATERIAL]: 'Advanced Material',
  [Category.REFINED_MATERIAL]: 'Refined Material',
  [Category.QUICK_USE]: 'Quick Use',
  [Category.KEY]: 'Key',
  [Category.AUGMENT]: 'Augment',
  [Category.AMMUNITION]: 'Ammunition',
  [Category.SHIELD]: 'Shield',
  [Category.WEAPON]: 'Weapon',
  [Category.MODIFICATION]: 'Modification',
  [Category.TRINKET]: 'Trinket',
  [Category.MISC]: 'Misc'
});

// Rarity enum - IDs stored directly on items
const Rarity = Object.freeze({
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5
});

// Rarity names for display
const RarityNames = Object.freeze({
  [Rarity.COMMON]: 'Common',
  [Rarity.UNCOMMON]: 'Uncommon',
  [Rarity.RARE]: 'Rare',
  [Rarity.EPIC]: 'Epic',
  [Rarity.LEGENDARY]: 'Legendary'
});

// Array of all categories (for dropdowns, validation, etc.)
const CATEGORIES = Object.entries(CategoryNames).map(([id, name]) => ({
  id: parseInt(id),
  name
}));

// Array of all rarities (for dropdowns, validation, etc.)
const RARITIES = Object.entries(RarityNames).map(([id, name]) => ({
  id: parseInt(id),
  name
}));

function init() {
  // Check if we need to migrate from old schema
  const tableInfo = db.prepare("PRAGMA table_info(items)").all();
  const hasOldSchema = tableInfo.some(col => col.name === 'category' && col.type === 'TEXT');

  if (hasOldSchema) {
    migrate();
  } else {
    // Fresh database - run schema and seed categories
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    seedCategories();
  }

  // Add image_path column if it doesn't exist (re-check after migrations)
  const currentTableInfo = db.prepare("PRAGMA table_info(items)").all();
  const hasImagePath = currentTableInfo.some(col => col.name === 'image_path');
  if (!hasImagePath) {
    db.exec('ALTER TABLE items ADD COLUMN image_path TEXT');
  }

  // Add rarity_id column if it doesn't exist
  const hasRarityId = currentTableInfo.some(col => col.name === 'rarity_id');
  if (!hasRarityId) {
    db.exec('ALTER TABLE items ADD COLUMN rarity_id INTEGER');
  }
}

function seedCategories() {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)');
  for (const [id, name] of Object.entries(CategoryNames)) {
    insert.run(parseInt(id), name);
  }
}

function migrate() {
  console.log('Migrating database to new category schema...');

  // Disable foreign keys for migration
  db.pragma('foreign_keys = OFF');

  db.exec('BEGIN TRANSACTION');

  try {
    // Create categories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);

    // Seed categories
    seedCategories();

    // Create new items table
    db.exec(`
      CREATE TABLE items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        stack_size INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    // Migrate data - map old category strings to new IDs
    db.exec(`
      INSERT INTO items_new (id, name, stack_size, category_id, created_at)
      SELECT i.id, i.name, i.stack_size, c.id, i.created_at
      FROM items i
      JOIN categories c ON i.category = c.name
    `);

    // Drop old table and rename new
    db.exec('DROP TABLE items');
    db.exec('ALTER TABLE items_new RENAME TO items');

    // Ensure stash_items table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS stash_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      )
    `);

    db.exec('COMMIT');

    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');

    console.log('Migration complete!');
  } catch (err) {
    db.exec('ROLLBACK');
    db.pragma('foreign_keys = ON');
    throw err;
  }
}

// Get all items with category info
function getAllItems() {
  const items = db.prepare(`
    SELECT i.*,
           EXISTS(SELECT 1 FROM recipes WHERE item_id = i.id) AS is_craftable
    FROM items i
    ORDER BY i.category_id, i.name
  `).all();
  // Add category and rarity names
  return items.map(item => ({
    ...item,
    category: CategoryNames[item.category_id] || 'Unknown',
    rarity: RarityNames[item.rarity_id] || null
  }));
}

// Get single item by ID
function getItemById(id) {
  const item = db.prepare(`
    SELECT i.*,
           EXISTS(SELECT 1 FROM recipes WHERE item_id = i.id) AS is_craftable
    FROM items i
    WHERE i.id = ?
  `).get(id);
  if (item) {
    item.category = CategoryNames[item.category_id] || 'Unknown';
    item.rarity = RarityNames[item.rarity_id] || null;
  }
  return item;
}

// Get recipe for an item (list of materials)
function getRecipeByItemId(itemId) {
  const recipes = db.prepare(`
    SELECT r.*, m.name AS material_name, m.category_id AS material_category_id, m.stack_size AS material_stack_size
    FROM recipes r
    JOIN items m ON r.material_id = m.id
    WHERE r.item_id = ?
  `).all(itemId);
  return recipes.map(r => ({
    ...r,
    material_category: CategoryNames[r.material_category_id] || 'Unknown'
  }));
}

// Get all crafting materials (for dropdown) - includes all material types
function getCraftingMaterials() {
  return db.prepare(`
    SELECT id, name FROM items
    WHERE category_id IN (?, ?, ?, ?)
    ORDER BY name
  `).all(Category.BASIC_MATERIAL, Category.TOPSIDE_MATERIAL, Category.ADVANCED_MATERIAL, Category.REFINED_MATERIAL);
}

// Create a new item
function createItem(name, stackSize, categoryId) {
  const stmt = db.prepare(`
    INSERT INTO items (name, stack_size, category_id)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(name, stackSize, categoryId);
  return result.lastInsertRowid;
}

// Update an item
function updateItem(id, name, stackSize, categoryId) {
  const stmt = db.prepare(`
    UPDATE items SET name = ?, stack_size = ?, category_id = ?
    WHERE id = ?
  `);
  return stmt.run(name, stackSize, categoryId, id);
}

// Delete an item
function deleteItem(id) {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  return stmt.run(id);
}

// Update item image path
function updateItemImage(id, imagePath) {
  const stmt = db.prepare('UPDATE items SET image_path = ? WHERE id = ?');
  return stmt.run(imagePath, id);
}

// Delete all recipes for an item
function deleteRecipesByItemId(itemId) {
  const stmt = db.prepare('DELETE FROM recipes WHERE item_id = ?');
  return stmt.run(itemId);
}

// Add a recipe entry
function addRecipeEntry(itemId, materialId, quantity) {
  const stmt = db.prepare(`
    INSERT INTO recipes (item_id, material_id, quantity)
    VALUES (?, ?, ?)
  `);
  return stmt.run(itemId, materialId, quantity);
}

// Get items that use this material in their recipes
function getItemsUsingMaterial(materialId) {
  const items = db.prepare(`
    SELECT i.id, i.name, i.category_id, i.stack_size, r.quantity
    FROM recipes r
    JOIN items i ON r.item_id = i.id
    WHERE r.material_id = ?
    ORDER BY i.category_id, i.name
  `).all(materialId);
  return items.map(item => ({
    ...item,
    category: CategoryNames[item.category_id] || 'Unknown'
  }));
}

// Save full recipe (delete existing and insert new)
function saveRecipe(itemId, materials) {
  const deleteStmt = db.prepare('DELETE FROM recipes WHERE item_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO recipes (item_id, material_id, quantity)
    VALUES (?, ?, ?)
  `);

  const saveAll = db.transaction((itemId, materials) => {
    deleteStmt.run(itemId);
    for (const mat of materials) {
      if (mat.materialId && mat.quantity > 0) {
        insertStmt.run(itemId, mat.materialId, mat.quantity);
      }
    }
  });

  saveAll(itemId, materials);
}

// Get saved stash configuration
function getStash() {
  const stash = db.prepare(`
    SELECT s.item_id, s.quantity, i.name, i.category_id
    FROM stash_items s
    JOIN items i ON s.item_id = i.id
    ORDER BY i.category_id, i.name
  `).all();
  return stash.map(item => ({
    ...item,
    category: CategoryNames[item.category_id] || 'Unknown'
  }));
}

// Save stash configuration (replaces existing)
function saveStash(items) {
  const deleteStmt = db.prepare('DELETE FROM stash_items');
  const insertStmt = db.prepare(`
    INSERT INTO stash_items (item_id, quantity)
    VALUES (?, ?)
  `);

  const saveAll = db.transaction((items) => {
    deleteStmt.run();
    for (const item of items) {
      if (item.itemId && item.quantity > 0) {
        insertStmt.run(item.itemId, item.quantity);
      }
    }
  });

  saveAll(items);
}

// Helper to get category ID from name (for backwards compatibility)
function getCategoryId(name) {
  const entry = Object.entries(CategoryNames).find(([_, n]) => n.toLowerCase() === name.toLowerCase());
  return entry ? parseInt(entry[0]) : null;
}

// Helper to get rarity ID from name
function getRarityId(name) {
  const entry = Object.entries(RarityNames).find(([_, n]) => n.toLowerCase() === name.toLowerCase());
  return entry ? parseInt(entry[0]) : null;
}

// Update item category and rarity (for scraper)
function updateItemCategoryAndRarity(id, categoryId, rarityId) {
  const stmt = db.prepare('UPDATE items SET category_id = ?, rarity_id = ? WHERE id = ?');
  return stmt.run(categoryId, rarityId, id);
}

module.exports = {
  db,
  init,
  Category,
  CategoryNames,
  CATEGORIES,
  Rarity,
  RarityNames,
  RARITIES,
  getAllItems,
  getItemById,
  getRecipeByItemId,
  getItemsUsingMaterial,
  getCraftingMaterials,
  createItem,
  updateItem,
  updateItemImage,
  updateItemCategoryAndRarity,
  deleteItem,
  deleteRecipesByItemId,
  addRecipeEntry,
  saveRecipe,
  getStash,
  saveStash,
  getCategoryId,
  getRarityId
};
