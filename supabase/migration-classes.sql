-- Migration : classes d'une matière (une matière peut concerner plusieurs classes).
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
-- Sans effet sur les matières existantes (liste vide par défaut).
alter table matieres add column if not exists classes text[] not null default '{}';
