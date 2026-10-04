-- Timer — schéma Supabase (Postgres).
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
--
-- Chaque table porte une colonne user_id et une politique RLS qui restreint
-- toute lecture/écriture à auth.uid() = user_id : deux comptes ne peuvent
-- jamais voir les données l'un de l'autre, même sur la même base.

create extension if not exists "pgcrypto";

/* ---------------------------------- Écoles --------------------------------- */
create table ecoles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  code text not null,
  nom text not null,
  couleur text not null,
  ordre int not null default 0
);

/* --------------------------------- Matières -------------------------------- */
create table matieres (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  ecole_id bigint not null references ecoles on delete cascade,
  nom text not null,
  niveau text not null,
  -- Classes concernées (ex. {'L3 IA','L3 GLRS'}) : une matière peut en regrouper plusieurs.
  classes text[] not null default '{}',
  volume_horaire numeric not null default 0,
  statut text not null default 'en_cours',
  mode_par_defaut text not null default 'presentiel',
  lieu_par_defaut text not null default '',
  lien_par_defaut text not null default '',
  note text not null default '',
  cree_le timestamptz not null default now(),
  termine_le timestamptz
);

/* ---------------------------------- Tarifs ---------------------------------- */
create table tarifs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  ecole_id bigint not null references ecoles on delete cascade,
  niveau text not null,
  taux numeric not null default 0,
  unique (user_id, ecole_id, niveau)
);

/* --------------------------------- Séances --------------------------------- */
create table seances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  matiere_id bigint not null references matieres on delete cascade,
  date date not null,
  debut text not null,
  fin text not null,
  mode text not null default 'presentiel',
  lieu text not null default '',
  lien text not null default '',
  statut text not null default 'planifie',
  notes text not null default '',
  taux_horaire numeric not null default 0,
  serie_id text
);
create index seances_date_idx on seances (user_id, date);
create index seances_matiere_idx on seances (matiere_id);
create index seances_serie_idx on seances (serie_id);

/* -------------------------------- Paiements --------------------------------- */
create table paiements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  ecole_id bigint not null references ecoles on delete cascade,
  mois text not null,
  statut text not null default 'attente',
  montant numeric not null default 0,
  date_paiement date,
  unique (user_id, ecole_id, mois)
);

/* --------------------------------- Réglages --------------------------------- */
create table reglages (
  user_id uuid not null references auth.users on delete cascade,
  cle text not null,
  valeur jsonb not null,
  primary key (user_id, cle)
);

/* ------------------------------ Sécurité (RLS) ------------------------------ */
alter table ecoles enable row level security;
alter table matieres enable row level security;
alter table tarifs enable row level security;
alter table seances enable row level security;
alter table paiements enable row level security;
alter table reglages enable row level security;

create policy "proprietaire" on ecoles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proprietaire" on matieres for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proprietaire" on tarifs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proprietaire" on seances for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proprietaire" on paiements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proprietaire" on reglages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* --------------------------- Amorçage à l'inscription ------------------------ */
-- À la création d'un compte, on crée automatiquement les 6 écoles par défaut.
-- Les réglages par défaut sont eux gérés côté application (assurerReglages), pour
-- rester modifiables sans migration SQL à chaque nouveau réglage ajouté.
create or replace function public.amorcer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.ecoles (user_id, code, nom, couleur, ordre) values
    (new.id, 'BEMTECH', 'BEMTECH', '#E11D48', 1),
    (new.id, 'AFITECH', 'AFITECH', '#F59E0B', 2),
    (new.id, 'ISM-ING', 'ISM Ingénierie', '#2563EB', 3),
    (new.id, 'ISM-MAN', 'ISM Management', '#059669', 4),
    (new.id, 'ISM-SOIR', 'ISM Cours du soir', '#7C3AED', 5),
    (new.id, 'DM', 'DigitalMatis', '#0891B2', 6);
  return new;
end;
$$;

create trigger amorcer_nouvel_utilisateur
  after insert on auth.users
  for each row execute function public.amorcer_nouvel_utilisateur();

/* ------------------------------- Temps réel --------------------------------- */
-- Nécessaire pour que l'app se mette à jour automatiquement (multi-appareils)
-- sans recharger la page.
alter publication supabase_realtime add table ecoles, matieres, tarifs, seances, paiements, reglages;
