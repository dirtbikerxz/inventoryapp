-- SQLite Database Schema for WCP Parts Import
-- Includes automatic validation constraints to ensure data quality

-- Spec configurations reference table (loaded from spec_config_import.csv)
CREATE TABLE IF NOT EXISTS spec_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_code TEXT NOT NULL,
  category_name TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  type TEXT NOT NULL,
  spec1_label TEXT,
  spec2_label TEXT,
  spec3_label TEXT,
  spec4_label TEXT,
  spec5_label TEXT,
  UNIQUE(category_code, subcategory, type)
);

-- Parts table with no validation constraints
CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  price REAL NOT NULL,
  url TEXT,
  category_code TEXT NOT NULL,
  category_name TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  type TEXT NOT NULL,
  spec1 TEXT,
  spec2 TEXT,
  spec3 TEXT,
  spec4 TEXT,
  spec5 TEXT
);

-- Enable foreign key constraints (SQLite requires explicit enable)
PRAGMA foreign_keys = ON;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category_code);
CREATE INDEX IF NOT EXISTS idx_parts_subcategory ON parts(subcategory);
CREATE INDEX IF NOT EXISTS idx_parts_type ON parts(type);
CREATE INDEX IF NOT EXISTS idx_spec_configs_lookup ON spec_configs(category_code, subcategory, type);
