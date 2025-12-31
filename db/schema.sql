-- Items table
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  stack_size INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('gun', 'gun mod', 'augment', 'quick use', 'crafting material', 'ammunition', 'shield')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Recipes table (crafting requirements)
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES items(id) ON DELETE RESTRICT,
  UNIQUE(item_id, material_id)
);

-- Index for faster recipe lookups
CREATE INDEX IF NOT EXISTS idx_recipes_item_id ON recipes(item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_material_id ON recipes(material_id);
