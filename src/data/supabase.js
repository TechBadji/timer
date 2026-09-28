// Client Supabase — base Postgres hébergée, un compte par enseignant, données
// cloisonnées par utilisateur (RLS, voir supabase/schema.sql). Contrairement à la
// version précédente (IndexedDB), les données vivent sur le serveur : mêmes
// données sur tous les appareils, connexion internet requise.
import { createClient } from '@supabase/supabase-js'
import { REGLAGES_DEFAUT } from './constants'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'Supabase non configuré : copiez .env.example vers .env.local et renseignez VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')

/* ------------------------------ camelCase ↔ snake_case ----------------------- */
const versLigneCle = (k) => k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
const versObjetCle = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

/** Objet applicatif (camelCase) → ligne Postgres (snake_case), sans les undefined. */
export function versLigne(o) {
  const r = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue
    r[versLigneCle(k)] = v
  }
  return r
}

/** Ligne Postgres → objet applicatif (camelCase), sans user_id (implicite). */
export function versObjet(row) {
  if (!row) return row
  const r = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue
    r[versObjetCle(k)] = v
  }
  return r
}

export const versObjets = (rows) => (rows || []).map(versObjet)

export function leverSiErreur({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

async function utilisateurId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  return user.id
}

/* ---------------------------------- Réglages --------------------------------- */
export async function lireReglages() {
  const { data, error } = await supabase.from('reglages').select('cle, valeur')
  if (error) throw new Error(error.message)
  const lignes = Object.fromEntries((data || []).map((r) => [r.cle, r.valeur]))
  return { ...REGLAGES_DEFAUT, ...lignes }
}

export async function ecrireReglage(cle, valeur) {
  const user_id = await utilisateurId()
  const { error } = await supabase.from('reglages').upsert({ user_id, cle, valeur }, { onConflict: 'user_id,cle' })
  if (error) throw new Error(error.message)
}

/** Complète les réglages manquants (nouveaux réglages ajoutés depuis la dernière connexion). */
export async function assurerReglages() {
  const { data, error } = await supabase.from('reglages').select('cle')
  if (error) throw new Error(error.message)
  const connus = new Set((data || []).map((r) => r.cle))
  const manquants = Object.entries(REGLAGES_DEFAUT).filter(([cle]) => !connus.has(cle))
  if (!manquants.length) return
  const user_id = await utilisateurId()
  const { error: e2 } = await supabase.from('reglages').upsert(manquants.map(([cle, valeur]) => ({ user_id, cle, valeur })))
  if (e2) throw new Error(e2.message)
}
