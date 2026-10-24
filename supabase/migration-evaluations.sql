-- Migration : évaluations (type de séance et suivi de la remise des notes).
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
-- type_seance : 'cours', 'controle', 'examen' ou 'soutenance'.
alter table seances add column if not exists type_seance text not null default 'cours';
alter table seances add column if not exists notes_remises boolean not null default false;
