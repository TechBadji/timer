-- Migration : cahier de textes (contenu prévu, réalisé et travail donné par séance).
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
alter table seances add column if not exists contenu_prevu text not null default '';
alter table seances add column if not exists contenu_realise text not null default '';
alter table seances add column if not exists travail_donne text not null default '';
