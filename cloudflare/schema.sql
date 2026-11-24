CREATE TABLE IF NOT EXISTS harvest_records (
  season TEXT NOT NULL,
  date TEXT NOT NULL,
  blind TEXT NOT NULL,
  species TEXT NOT NULL,
  harvest INTEGER NOT NULL CHECK (harvest >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season, date, blind, species)
);

CREATE INDEX IF NOT EXISTS idx_harvest_records_season_date
ON harvest_records (season, date);

CREATE INDEX IF NOT EXISTS idx_harvest_records_blind
ON harvest_records (blind);
