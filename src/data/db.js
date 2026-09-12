import Dexie from 'dexie'
import { ECOLES_PAR_DEFAUT, REGLAGES_DEFAUT } from './constants'

/**
 * Base locale IndexedDB. Aucune donnée ne quitte l'appareil.
 *
 *  ecoles    : les 6 structures (couleur = code couleur du calendrier)
 *  matieres  : nom + école + niveau + volume horaire à réaliser (quota)
 *  tarifs    : taux horaire pour un couple (école, niveau) — unique
 *  seances   : un créneau du calendrier, rattaché à une matière
 *  paiements : statut de paiement d'une école pour un mois donné
 *  reglages  : préférences (clé/valeur)
 */
export const db = new Dexie('timer')

db.version(1).stores({
  ecoles: '++id, code, ordre',
  matieres: '++id, ecoleId, niveau, statut, nom',
  tarifs: '++id, &[ecoleId+niveau], ecoleId',
  seances: '++id, date, matiereId, statut, serieId, [date+statut]',
  paiements: '++id, &[ecoleId+mois], mois, ecoleId',
  reglages: 'cle',
})

/** Amorçage : les 6 écoles + les réglages par défaut, une seule fois. */
db.on('populate', async (tx) => {
  await tx.table('ecoles').bulkAdd(ECOLES_PAR_DEFAUT)
  await tx.table('reglages').bulkAdd(
    Object.entries(REGLAGES_DEFAUT).map(([cle, valeur]) => ({ cle, valeur }))
  )
})

/** Complète les réglages manquants après une mise à jour de l'app. */
export async function assurerReglages() {
  const existants = await db.reglages.toArray()
  const connus = new Set(existants.map((r) => r.cle))
  const manquants = Object.entries(REGLAGES_DEFAUT)
    .filter(([cle]) => !connus.has(cle))
    .map(([cle, valeur]) => ({ cle, valeur }))
  if (manquants.length) await db.reglages.bulkAdd(manquants)
}

export async function lireReglages() {
  const lignes = await db.reglages.toArray()
  return { ...REGLAGES_DEFAUT, ...Object.fromEntries(lignes.map((r) => [r.cle, r.valeur])) }
}

export async function ecrireReglage(cle, valeur) {
  await db.reglages.put({ cle, valeur })
}
