// Export / import complet, en plus de la base Supabase elle-même (qui est déjà
// sauvegardée côté serveur). Utile pour changer de compte ou garder une copie
// hors ligne.
import { supabase, versObjets, versLigne, leverSiErreur } from '../data/supabase'
import { normaliserUrl, urlValide } from './supports'

const TABLES = ['ecoles', 'matieres', 'tarifs', 'seances', 'paiements', 'reglages', 'supports']

async function utilisateurId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  return user.id
}

export async function exporterJSON() {
  const contenu = { app: 'timer', version: 2, exporteLe: new Date().toISOString(), tables: {} }
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select('*')
    if (error) throw new Error(error.message)
    contenu.tables[t] = versObjets(data)
  }
  return contenu
}

export async function telechargerSauvegarde(suffixe = '') {
  const contenu = await exporterJSON()
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timer-sauvegarde-${new Date().toISOString().slice(0, 10)}${suffixe}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return contenu
}

/** Remplace intégralement les données du compte connecté par celles du fichier. */
export async function importerSauvegarde(fichier) {
  const texte = await fichier.text()
  const donnees = JSON.parse(texte)
  if (donnees?.app !== 'timer' || !donnees.tables) throw new Error('Fichier de sauvegarde non reconnu')

  // Filet de sécurité : copie de l'état actuel, téléchargée et gardée en mémoire,
  // pour revenir en arrière si la restauration échoue à mi-parcours.
  const avant = await telechargerSauvegarde('-avant-restauration')
  try {
    return await importerDonnees(donnees)
  } catch (err) {
    try {
      await importerDonnees(avant)
    } catch {
      throw new Error(
        `Restauration interrompue (${err.message}) et retour arrière impossible : restaurez le fichier « …-avant-restauration.json » téléchargé.`
      )
    }
    throw new Error(`Restauration annulée (${err.message}) : vos données d'avant sont rétablies.`)
  }
}

/**
 * Remplace intégralement les données du compte connecté par `donnees.tables`
 * (même forme que produite par exporterJSON — ou lue directement dans l'ancienne
 * base IndexedDB du navigateur, voir lib/migrationLocale.js).
 */
export async function importerDonnees(donnees) {
  const user_id = await utilisateurId()

  // Ordre des tables pour respecter les clés étrangères : écoles avant matières,
  // matières avant séances. reglages n'a pas d'id auto : upsert sur (user_id, cle).
  leverSiErreur(await supabase.from('seances').delete().eq('user_id', user_id))
  leverSiErreur(await supabase.from('supports').delete().eq('user_id', user_id))
  leverSiErreur(await supabase.from('paiements').delete().eq('user_id', user_id))
  leverSiErreur(await supabase.from('tarifs').delete().eq('user_id', user_id))
  leverSiErreur(await supabase.from('matieres').delete().eq('user_id', user_id))
  leverSiErreur(await supabase.from('ecoles').delete().eq('user_id', user_id))

  const correspondanceEcoles = new Map()
  const correspondanceMatieres = new Map()
  const compte = {}

  for (const e of donnees.tables.ecoles || []) {
    const { id, ...reste } = e
    const { data, error } = await supabase.from('ecoles').insert({ ...versLigne(reste), user_id }).select('id').single()
    if (error) throw new Error(error.message)
    correspondanceEcoles.set(id, data.id)
  }
  compte.ecoles = donnees.tables.ecoles?.length || 0

  for (const m of donnees.tables.matieres || []) {
    const { id, ecoleId, ...reste } = m
    const { data, error } = await supabase
      .from('matieres')
      .insert({ ...versLigne(reste), ecole_id: correspondanceEcoles.get(ecoleId), user_id })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    correspondanceMatieres.set(id, data.id)
  }
  compte.matieres = donnees.tables.matieres?.length || 0

  if (donnees.tables.tarifs?.length) {
    const lignes = donnees.tables.tarifs.map(({ id, ecoleId, ...reste }) => ({
      ...versLigne(reste),
      ecole_id: correspondanceEcoles.get(ecoleId),
      user_id,
    }))
    const { error } = await supabase.from('tarifs').insert(lignes)
    if (error) throw new Error(error.message)
  }
  compte.tarifs = donnees.tables.tarifs?.length || 0

  if (donnees.tables.seances?.length) {
    const lignes = donnees.tables.seances.map(({ id, matiereId, ...reste }) => ({
      ...versLigne(reste),
      matiere_id: correspondanceMatieres.get(matiereId),
      user_id,
    }))
    const { error } = await supabase.from('seances').insert(lignes)
    if (error) throw new Error(error.message)
  }
  compte.seances = donnees.tables.seances?.length || 0

  // Absente des sauvegardes antérieures à la bibliothèque de supports.
  if (donnees.tables.supports?.length) {
    // Un fichier de sauvegarde peut avoir été modifié : on ne garde que les liens http(s).
    const lignes = donnees.tables.supports.filter((s) => urlValide(s.url)).map(({ id, matiereId, ...reste }) => ({
      ...versLigne({ ...reste, url: normaliserUrl(reste.url) }),
      matiere_id: correspondanceMatieres.get(matiereId),
      user_id,
    }))
    const { error } = lignes.length ? await supabase.from('supports').insert(lignes) : { error: null }
    if (error) throw new Error(error.message)
  }
  compte.supports = donnees.tables.supports?.length || 0

  if (donnees.tables.paiements?.length) {
    const lignes = donnees.tables.paiements.map(({ id, ecoleId, ...reste }) => ({
      ...versLigne(reste),
      ecole_id: correspondanceEcoles.get(ecoleId),
      user_id,
    }))
    const { error } = await supabase.from('paiements').insert(lignes)
    if (error) throw new Error(error.message)
  }
  compte.paiements = donnees.tables.paiements?.length || 0

  if (donnees.tables.reglages?.length) {
    const lignes = donnees.tables.reglages.map((r) => ({ cle: r.cle, valeur: r.valeur, user_id }))
    const { error } = await supabase.from('reglages').upsert(lignes, { onConflict: 'user_id,cle' })
    if (error) throw new Error(error.message)
  }

  return compte
}

export async function viderSeances() {
  const user_id = await utilisateurId()
  const { error } = await supabase.from('seances').delete().eq('user_id', user_id)
  if (error) throw new Error(error.message)
}
