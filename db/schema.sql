-- Items table
-- category_id and rarity_id are integer enums (no FK tables)
-- Categories: 1=Basic Material, 2=Topside Material, 3=Advanced Material, 4=Refined Material,
--             5=Quick Use, 6=Key, 7=Augment, 8=Ammunition, 9=Shield,
--             11=Modification, 12=Trinket, 13=Misc, 14=Recyclable, 15=Nature
-- Note: 10=Weapon was removed - guns now have their own tables
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

-- Guns table - represents each gun as a single entity
-- Guns have 4 upgrade levels (I-IV), except legendaries (rarity_id=5) which have 1
CREATE TABLE IF NOT EXISTS guns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,             -- Base name (e.g., 'Arpeggio', 'Anvil')
  rarity_id INTEGER,                     -- Gun rarity (same across all levels)
  image_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gun levels table - stores each upgrade level
-- Level 1 = base gun (I), Level 2 = II, Level 3 = III, Level 4 = IV
CREATE TABLE IF NOT EXISTS gun_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gun_id INTEGER NOT NULL,
  level INTEGER NOT NULL,                -- 1-4 (I-IV)
  FOREIGN KEY (gun_id) REFERENCES guns(id) ON DELETE CASCADE,
  UNIQUE(gun_id, level)
);

-- Gun level recipes - crafting requirements for each gun level
-- Only stores item materials; previous level requirement is inferred (level N requires level N-1)
CREATE TABLE IF NOT EXISTS gun_level_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gun_level_id INTEGER NOT NULL,
  material_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (gun_level_id) REFERENCES gun_levels(id) ON DELETE CASCADE,
  FOREIGN KEY (material_item_id) REFERENCES items(id) ON DELETE RESTRICT
);

-- Indexes for gun lookups
CREATE INDEX IF NOT EXISTS idx_gun_levels_gun_id ON gun_levels(gun_id);
CREATE INDEX IF NOT EXISTS idx_gun_level_recipes_gun_level_id ON gun_level_recipes(gun_level_id);

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
