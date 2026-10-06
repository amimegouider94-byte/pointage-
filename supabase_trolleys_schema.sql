-- ===============================================================
-- SCRIPT DE MIGRATION SUPABASE - TABLE 'trolleys' (SERRE KAS 8)
-- À exécuter dans : Supabase Dashboard > SQL Editor > New Query
-- ===============================================================

-- 1. Création de la table 'trolleys'
CREATE TABLE IF NOT EXISTS public.trolleys (
    id INT PRIMARY KEY,
    worker TEXT DEFAULT '',
    pins_assigned INT DEFAULT 10,
    pins_found INT DEFAULT 10,
    charge_status TEXT DEFAULT 'Normale',
    charge_pct INT DEFAULT 100,
    charge_day TEXT DEFAULT 'Lundi',
    charger_num TEXT DEFAULT 'Chargeur 1',
    notes TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Configuration des Politiques de Sécurité (RLS)
ALTER TABLE public.trolleys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on trolleys" ON public.trolleys;
CREATE POLICY "Allow public read access on trolleys" ON public.trolleys FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access on trolleys" ON public.trolleys;
CREATE POLICY "Allow public write access on trolleys" ON public.trolleys FOR ALL USING (true);

-- 3. Initialisation par défaut des 42 chariots de la serre KAS 8
INSERT INTO public.trolleys (id, worker, pins_assigned, pins_found, charge_status, charge_pct, charge_day, charger_num)
SELECT 
    i,
    '',
    10,
    10,
    'Normale',
    100,
    CASE ((i - 1) % 7)
        WHEN 0 THEN 'Lundi'
        WHEN 1 THEN 'Mardi'
        WHEN 2 THEN 'Mercredi'
        WHEN 3 THEN 'Jeudi'
        WHEN 4 THEN 'Vendredi'
        WHEN 5 THEN 'Samedi'
        ELSE 'Dimanche'
    END,
    'Chargeur ' || (((i - 1) % 10) + 1)
FROM generate_series(1, 42) AS i
ON CONFLICT (id) DO NOTHING;
