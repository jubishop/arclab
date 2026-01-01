-- Items table
-- category_id and rarity_id are integer enums (no FK tables)
-- Categories: 1=Basic Material, 2=Topside Material, 3=Advanced Material, 4=Refined Material,
--             5=Quick Use, 6=Key, 7=Augment, 8=Ammunition, 9=Shield, 10=Weapon,
--             11=Modification, 12=Trinket, 13=Misc
-- Rarities: 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  stack_size INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  rarity_id INTEGER,
  image_path TEXT,
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

-- Stash configuration (global singleton)
CREATE TABLE IF NOT EXISTS stash_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
