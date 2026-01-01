const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'arclab.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

const CATEGORIES = [
  'gun',
  'gun mod',
  'augment',
  'quick use',
  'crafting material',
  'ammunition',
  'shield'
];

function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

// Get all items with craftability info
function getAllItems() {
  return db.prepare(`
    SELECT i.*,
           EXISTS(SELECT 1 FROM recipes WHERE item_id = i.id) AS is_craftable
    FROM items i
    ORDER BY i.category, i.name
  `).all();
}

// Get single item by ID
function getItemById(id) {
  return db.prepare(`
    SELECT i.*,
           EXISTS(SELECT 1 FROM recipes WHERE item_id = i.id) AS is_craftable
    FROM items i
    WHERE i.id = ?
  `).get(id);
}

// Get recipe for an item (list of materials)
function getRecipeByItemId(itemId) {
  return db.prepare(`
    SELECT r.*, m.name AS material_name, m.category AS material_category, m.stack_size AS material_stack_size
    FROM recipes r
    JOIN items m ON r.material_id = m.id
    WHERE r.item_id = ?
  `).all(itemId);
}

// Get all crafting materials (for dropdown)
function getCraftingMaterials() {
  return db.prepare(`
    SELECT id, name FROM items
    WHERE category = 'crafting material'
    ORDER BY name
  `).all();
}

// Create a new item
function createItem(name, stackSize, category) {
  const stmt = db.prepare(`
    INSERT INTO items (name, stack_size, category)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(name, stackSize, category);
  return result.lastInsertRowid;
}

// Update an item
function updateItem(id, name, stackSize, category) {
  const stmt = db.prepare(`
    UPDATE items SET name = ?, stack_size = ?, category = ?
    WHERE id = ?
  `);
  return stmt.run(name, stackSize, category, id);
}

// Delete an item
function deleteItem(id) {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  return stmt.run(id);
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
  return db.prepare(`
    SELECT i.id, i.name, i.category, i.stack_size, r.quantity
    FROM recipes r
    JOIN items i ON r.item_id = i.id
    WHERE r.material_id = ?
    ORDER BY i.category, i.name
  `).all(materialId);
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

module.exports = {
  db,
  init,
  CATEGORIES,
  getAllItems,
  getItemById,
  getRecipeByItemId,
  getItemsUsingMaterial,
  getCraftingMaterials,
  createItem,
  updateItem,
  deleteItem,
  deleteRecipesByItemId,
  addRecipeEntry,
  saveRecipe
};
