-- Migration : majoration des cours du soir, en % du taux de la grille, par école (0 = même taux).
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
alter table ecoles add column if not exists majoration_soir numeric not null default 0;
