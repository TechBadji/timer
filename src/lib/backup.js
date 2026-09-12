// Sauvegarde et restauration complètes de la base locale (fichier JSON).
import { db } from '../data/db'

const TABLES = ['ecoles', 'matieres', 'tarifs', 'seances', 'paiements', 'reglages']

export async function exporterJSON() {
  const contenu = { app: 'timer', version: 1, exporteLe: new Date().toISOString(), tables: {} }
  for (const t of TABLES) contenu.tables[t] = await db.table(t).toArray()
  return contenu
}

export async function telechargerSauvegarde() {
  const contenu = await exporterJSON()
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timer-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  return contenu
}

/** Remplace intégralement le contenu local par celui du fichier. */
export async function importerSauvegarde(fichier) {
  const texte = await fichier.text()
  const donnees = JSON.parse(texte)
  if (donnees?.app !== 'timer' || !donnees.tables) throw new Error('Fichier de sauvegarde non reconnu')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      if (donnees.tables[t]?.length) await db.table(t).bulkAdd(donnees.tables[t])
    }
  })
  return Object.fromEntries(TABLES.map((t) => [t, donnees.tables[t]?.length || 0]))
}

export async function viderSeances() {
  await db.seances.clear()
}
