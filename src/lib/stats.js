// Agrégations : progression des matières et récapitulatif mensuel.
import { dureeHeures, moisDe } from './dates'
import { creneauDe } from './creneau'

export const heuresDe = (s) => dureeHeures(s.debut, s.fin)
export const montantDe = (s) => heuresDe(s) * (s.tauxHoraire || 0)

/**
 * Avancement d'une matière sur son quota d'heures.
 * @param {object} matiere
 * @param {Array} seances toutes les séances (filtrées ici sur la matière)
 * @param {number} seuilAlerte % à partir duquel on prévient
 */
export function progression(matiere, seances, seuilAlerte = 90) {
  const siennes = seances.filter((s) => s.matiereId === matiere.id && s.statut !== 'annule')
  const faites = siennes.filter((s) => s.statut === 'fait').reduce((t, s) => t + heuresDe(s), 0)
  const planifiees = siennes.filter((s) => s.statut === 'planifie').reduce((t, s) => t + heuresDe(s), 0)
  const quota = Number(matiere.volumeHoraire) || 0
  const restantes = quota - faites
  const pct = quota ? (faites / quota) * 100 : 0
  const pctProjete = quota ? ((faites + planifiees) / quota) * 100 : 0

  let alerte = null
  if (quota && faites > quota) alerte = { niveau: 'erreur', texte: `Quota dépassé de ${(faites - quota).toFixed(1)} h` }
  else if (quota && faites + planifiees > quota)
    alerte = { niveau: 'alerte', texte: `Le planifié dépasse le quota de ${(faites + planifiees - quota).toFixed(1)} h` }
  else if (quota && pct >= seuilAlerte) alerte = { niveau: 'info', texte: `Quota atteint à ${Math.round(pct)} %` }

  return {
    quota,
    faites,
    planifiees,
    restantes,
    pct: Math.min(999, pct),
    pctProjete: Math.min(999, pctProjete),
    nbSeances: siennes.length,
    nbFaites: siennes.filter((s) => s.statut === 'fait').length,
    alerte,
    complete: quota > 0 && faites >= quota,
  }
}

const cumul = (map, cle, base, s) => {
  if (!map.has(cle)) map.set(cle, { ...base, heures: 0, heuresFaites: 0, heuresPlanifiees: 0, montant: 0, montantFait: 0, nb: 0, nbFaites: 0 })
  const e = map.get(cle)
  const h = heuresDe(s)
  const m = montantDe(s)
  e.heures += h
  e.montant += m
  e.nb += 1
  if (s.statut === 'fait') {
    e.heuresFaites += h
    e.montantFait += m
    e.nbFaites += 1
  } else {
    e.heuresPlanifiees += h
  }
  return e
}

/**
 * Récapitulatif complet d'un mois : totaux et répartitions.
 * @param {string} mois 'YYYY-MM'
 */
export function construireRecap(mois, seances, { matieresById, ecolesById, heureSoir }) {
  const duMois = seances.filter((s) => moisDe(s.date) === mois && s.statut !== 'annule')

  const parEcole = new Map()
  const parNiveau = new Map()
  const parMode = new Map()
  const parCreneau = new Map()
  const parMatiere = new Map()

  let heures = 0
  let heuresFaites = 0
  let heuresPlanifiees = 0
  let montant = 0
  let montantFait = 0

  for (const s of duMois) {
    const matiere = matieresById.get(s.matiereId)
    if (!matiere) continue
    const ecole = ecolesById.get(matiere.ecoleId)
    const h = heuresDe(s)
    const m = montantDe(s)
    heures += h
    montant += m
    if (s.statut === 'fait') {
      heuresFaites += h
      montantFait += m
    } else heuresPlanifiees += h

    cumul(parEcole, matiere.ecoleId, { ecoleId: matiere.ecoleId, code: ecole?.code || '—', nom: ecole?.nom || '—', couleur: ecole?.couleur || '#64748b' }, s)
    cumul(parNiveau, matiere.niveau, { niveau: matiere.niveau }, s)
    cumul(parMode, s.mode, { mode: s.mode }, s)
    const creneau = creneauDe(s.debut, heureSoir)
    cumul(parCreneau, creneau, { creneau }, s)
    cumul(
      parMatiere,
      matiere.id,
      { matiereId: matiere.id, nom: matiere.nom, niveau: matiere.niveau, classes: matiere.classes || [], ecoleId: matiere.ecoleId, code: ecole?.code || '—', couleur: ecole?.couleur || '#64748b' },
      s
    )
  }

  const numeros = numeroterSeances(seances, matieresById)
  const trier = (map) => [...map.values()].sort((a, b) => b.heures - a.heures)

  return {
    mois,
    nbSeances: duMois.length,
    heures,
    heuresFaites,
    heuresPlanifiees,
    montant,
    montantFait,
    montantPrevisionnel: montant - montantFait,
    parEcole: trier(parEcole),
    parNiveau: trier(parNiveau),
    parMode: trier(parMode),
    parCreneau: trier(parCreneau),
    parMatiere: trier(parMatiere),
    seances: duMois.map((s) => ({ ...s, numero: numeros.get(s.id) })).sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut)),
  }
}

/** Variation relative entre deux valeurs, en % (null si base nulle). */
export const variation = (courant, precedent) =>
  !precedent ? (courant ? 100 : null) : ((courant - precedent) / precedent) * 100

/** Liste décroissante des mois contenant au moins une séance. */
export function moisDisponibles(seances) {
  const set = new Set(seances.map((s) => moisDe(s.date)))
  return [...set].sort().reverse()
}

/**
 * Numérote les séances de chaque matière dans l'ordre chronologique (annulées exclues)
 * et estime le nombre total de séances nécessaires pour couvrir le volume horaire :
 * séances existantes + heures encore non programmées / durée moyenne d'une séance.
 * @returns {Map<id, {rang, total, cumul, quota}>}
 */
export function numeroterSeances(seances, matieresById) {
  const parMatiere = new Map()
  for (const s of seances) {
    if (s.statut === 'annule') continue
    if (!parMatiere.has(s.matiereId)) parMatiere.set(s.matiereId, [])
    parMatiere.get(s.matiereId).push(s)
  }
  const res = new Map()
  for (const [matiereId, liste] of parMatiere) {
    liste.sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut))
    const quota = Number(matieresById.get(matiereId)?.volumeHoraire) || 0
    const programme = liste.reduce((t, s) => t + heuresDe(s), 0)
    const moyenne = programme / liste.length
    const manquantes = quota > programme && moyenne > 0 ? Math.ceil((quota - programme) / moyenne - 1e-9) : 0
    const total = liste.length + manquantes
    let cumul = 0
    liste.forEach((s, i) => {
      cumul += heuresDe(s)
      res.set(s.id, { rang: i + 1, total, cumul, quota })
    })
  }
  return res
}

/** « 1ère séance », « 2ème séance »… */
export const libelleRang = (rang) => `${rang}${rang === 1 ? 'ère' : 'ème'} séance`
