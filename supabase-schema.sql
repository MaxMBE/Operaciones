-- ============================================================
--  Portfolio Snapshots — ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date        NOT NULL UNIQUE,   -- fecha del martes (YYYY-MM-DD)
  week_label    text        NOT NULL,           -- "Semana del 4 de marzo de 2025"
  projects      jsonb       NOT NULL DEFAULT '[]',
  report_data   jsonb       NOT NULL DEFAULT '{}',
  cor_manual    jsonb,                          -- datos manuales del overview (puede ser null)
  created_at    timestamptz DEFAULT now()
);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots (snapshot_date DESC);

-- Row Level Security (RLS) — habilitar si usás autenticación
-- ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all" ON portfolio_snapshots FOR ALL USING (true);

-- ============================================================
--  COR Settings (datos manuales del overview COR)
-- ============================================================

CREATE TABLE IF NOT EXISTS cor_settings (
  key        text        PRIMARY KEY,   -- e.g. 'cor_manual_data'
  value      jsonb       NOT NULL,
  updated_at timestamptz DEFAULT now()
);
