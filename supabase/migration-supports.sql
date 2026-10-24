-- Migration : bibliothèque de supports (liens vers slides, TP, dépôts, vidéos) par matière.
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
-- rang : numéro de séance (1 = 1ère séance) ; null = support de toute la matière.
create table if not exists supports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  matiere_id bigint not null references matieres on delete cascade,
  titre text not null,
  url text not null check (url ~* '^https?://'),
  type text not null default 'lien',
  rang int,
  cree_le timestamptz not null default now()
);
create index if not exists supports_matiere_idx on supports (matiere_id);
alter table supports enable row level security;
create policy "proprietaire" on supports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table supports;
