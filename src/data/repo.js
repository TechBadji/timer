// Écritures métier : tout passe par ici pour garder la base cohérente.
import { db } from './db'
import { dureeHeures, decalerSemaines, estPasse } from '../lib/dates'

const nettoyer = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/* ---------------------------------- Écoles --------------------------------- */

export const majEcole = (id, champs) => db.ecoles.update(id, nettoyer(champs))

/* --------------------------------- Matières -------------------------------- */

export async function creerMatiere(m) {
  return db.matieres.add({
    nom: m.nom.trim(),
    ecoleId: Number(m.ecoleId),
    niveau: m.niveau,
    volumeHoraire: Number(m.volumeHoraire) || 0,
    statut: 'en_cours',
    modeParDefaut: m.modeParDefaut || 'presentiel',
    lieuParDefaut: m.lieuParDefaut || '',
    lienParDefaut: m.lienParDefaut || '',
    note: m.note || '',
    creeLe: new Date().toISOString(),
  })
}

export const majMatiere = (id, champs) => db.matieres.update(id, nettoyer(champs))

export const changerStatutMatiere = (id, statut) =>
  db.matieres.update(id, { statut, termineeLe: statut === 'terminee' ? new Date().toISOString() : null })

/** Supprime une matière et toutes ses séances. */
export async function supprimerMatiere(id) {
  await db.transaction('rw', db.matieres, db.seances, async () => {
    await db.seances.where('matiereId').equals(id).delete()
    await db.matieres.delete(id)
  })
}

/* ---------------------------------- Tarifs --------------------------------- */

export async function definirTarif(ecoleId, niveau, taux) {
  const existant = await db.tarifs.where({ ecoleId: Number(ecoleId), niveau }).first()
  const valeur = Number(taux) || 0
  if (existant) return db.tarifs.update(existant.id, { taux: valeur })
  return db.tarifs.add({ ecoleId: Number(ecoleId), niveau, taux: valeur })
}

export async function tauxPour(ecoleId, niveau) {
  const t = await db.tarifs.where({ ecoleId: Number(ecoleId), niveau }).first()
  return t?.taux ?? 0
}

/* ---------------------------------- Séances -------------------------------- */

function normaliserSeance(s, taux) {
  return {
    matiereId: Number(s.matiereId),
    date: s.date,
    debut: s.debut,
    fin: s.fin,
    mode: s.mode || 'presentiel',
    lieu: s.mode === 'ligne' ? '' : s.lieu || '',
    lien: s.mode === 'ligne' ? s.lien || '' : '',
    statut: s.statut || 'planifie',
    notes: s.notes || '',
    // Taux figé à la création : modifier la grille plus tard ne réécrit pas le passé.
    tauxHoraire: Number(s.tauxHoraire ?? taux) || 0,
    serieId: s.serieId || null,
  }
}

/**
 * Crée une séance et, si demandé, ses occurrences hebdomadaires.
 * @returns {Promise<number[]>} les identifiants créés
 */
export async function creerSeance(saisie, { repetitions = 0, intervalleSemaines = 1 } = {}) {
  const matiere = await db.matieres.get(Number(saisie.matiereId))
  if (!matiere) throw new Error('Matière introuvable')
  const taux = await tauxPour(matiere.ecoleId, matiere.niveau)

  const serieId = repetitions > 0 ? `s${Date.now()}` : null
  const aCreer = []
  for (let i = 0; i <= repetitions; i++) {
    aCreer.push(
      normaliserSeance(
        { ...saisie, date: i === 0 ? saisie.date : decalerSemaines(saisie.date, i * intervalleSemaines), serieId },
        taux
      )
    )
  }
  return db.seances.bulkAdd(aCreer, { allKeys: true })
}

export const majSeance = (id, champs) => db.seances.update(id, nettoyer(champs))

export const supprimerSeance = (id) => db.seances.delete(id)

/** Supprime toutes les séances d'une série récurrente à partir d'une date. */
export async function supprimerSerie(serieId, aPartirDe = null) {
  const lot = await db.seances.where('serieId').equals(serieId).toArray()
  const ids = lot.filter((s) => !aPartirDe || s.date >= aPartirDe).map((s) => s.id)
  await db.seances.bulkDelete(ids)
  return ids.length
}

export const marquerFait = (id) => db.seances.update(id, { statut: 'fait' })

/** Déplacement depuis le calendrier (drag & drop / redimensionnement). */
export const deplacerSeance = (id, { date, debut, fin }) => db.seances.update(id, nettoyer({ date, debut, fin }))

/**
 * Duplique toutes les séances d'une semaine sur les N semaines suivantes.
 * @returns {Promise<number>} nombre de séances créées
 */
export async function dupliquerSemaine(debutSemaineISO, nbSemaines) {
  const fin = decalerSemaines(debutSemaineISO, 1)
  const source = await db.seances.where('date').between(debutSemaineISO, fin, true, false).toArray()
  const actives = source.filter((s) => s.statut !== 'annule')
  if (!actives.length) return 0

  const serieId = `d${Date.now()}`
  const copies = []
  for (let i = 1; i <= nbSemaines; i++) {
    for (const s of actives) {
      copies.push({
        matiereId: s.matiereId,
        date: decalerSemaines(s.date, i),
        debut: s.debut,
        fin: s.fin,
        mode: s.mode,
        lieu: s.lieu,
        lien: s.lien,
        statut: 'planifie',
        notes: s.notes,
        tauxHoraire: s.tauxHoraire,
        serieId,
      })
    }
  }
  await db.seances.bulkAdd(copies)
  return copies.length
}

/** Passe en "effectuée" les séances planifiées déjà terminées (réglage autoFait). */
export async function synchroniserSeancesPassees() {
  const planifiees = await db.seances.where('statut').equals('planifie').toArray()
  const aFaire = planifiees.filter((s) => estPasse(s.date, s.fin)).map((s) => s.id)
  if (aFaire.length) await db.seances.bulkUpdate(aFaire.map((id) => ({ key: id, changes: { statut: 'fait' } })))
  return aFaire.length
}

/* --------------------------------- Paiements -------------------------------- */

export async function basculerPaiement(ecoleId, mois, statut, montant) {
  const existant = await db.paiements.where({ ecoleId: Number(ecoleId), mois }).first()
  const donnees = {
    ecoleId: Number(ecoleId),
    mois,
    statut,
    montant: Number(montant) || 0,
    datePaiement: statut === 'paye' ? new Date().toISOString().slice(0, 10) : null,
  }
  if (existant) return db.paiements.update(existant.id, donnees)
  return db.paiements.add(donnees)
}

/* ---------------------------------- Divers ---------------------------------- */

export const heuresSeance = (s) => dureeHeures(s.debut, s.fin)
export const montantSeance = (s) => heuresSeance(s) * (s.tauxHoraire || 0)
