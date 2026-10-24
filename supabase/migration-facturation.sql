-- Migration : facturation (numéro et date d'émission de la facture mensuelle par école).
-- À exécuter une fois dans Supabase : Project → SQL Editor → New query → coller → Run.
-- Statuts possibles de paiements.statut : 'en_attente' (à facturer), 'facture', 'paye'.
alter table paiements add column if not exists numero_facture text not null default '';
alter table paiements add column if not exists date_facture date;
