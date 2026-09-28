// Récupération ponctuelle des données de l'ancienne version 100 % locale
// (IndexedDB, base « timer ») vers le compte Supabase connecté. Lecture seule
// sur l'ancienne base : rien n'y est modifié ni supprimé.
import { importerDonnees } from './backup'

const TABLES = ['ecoles', 'matieres', 'tarifs', 'seances', 'paiements', 'reglages']

/** true si le navigateur a encore l'ancienne base locale « timer ». */
export async function baseLocaleDisponible() {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return false
  try {
    const bases = await indexedDB.databases()
    return bases.some((b) => b.name === 'timer')
  } catch {
    return false
  }
}

function ouvrirBaseLocale() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('timer')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function lireStore(db, nom) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(nom)) return resolve([])
    const tx = db.transaction(nom, 'readonly')
    const req = tx.objectStore(nom).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Importe l'ancienne base locale dans le compte Supabase connecté (remplace tout). */
export async function migrerDepuisIndexedDB() {
  const db = await ouvrirBaseLocale()
  try {
    const tables = {}
    for (const t of TABLES) tables[t] = await lireStore(db, t)
    return importerDonnees({ app: 'timer', tables })
  } finally {
    db.close()
  }
}
