// Pilotage de l'activité : revenus prévisionnels et charge de travail hebdomadaire.
import { bornesSemaine, decalerJours, decalerSemaines, moisDe, moisSuivant } from './dates'
import { heuresDe, montantDe, progression } from './stats'
import { creneauDe } from './creneau'

/**
 * Revenus mois par mois : acquis (effectué) et planifié, plus le montant encore
 * à programmer pour couvrir le volume horaire des matières en cours.
 * @param {string} depuis mois 'YYYY-MM' de départ
 */
export function previsionnel(seances, { matieres, tauxParCle, depuis, nbMois = 6 }) {
  const mois = []
  for (let i = 0, m = depuis; i < nbMois; i++, m = moisSuivant(m)) mois.push({ mois: m, acquis: 0, planifie: 0, heures: 0 })
  const parMois = new Map(mois.map((m) => [m.mois, m]))
  for (const s of seances) {
    const e = parMois.get(moisDe(s.date))
    if (!e || s.statut === 'annule') continue
    if (s.statut === 'fait') e.acquis += montantDe(s)
    else e.planifie += montantDe(s)
    e.heures += heuresDe(s)
  }

  // Heures du quota ni effectuées ni planifiées, valorisées au taux de la grille.
  const aProgrammer = matieres
    .filter((m) => m.statut !== 'terminee')
    .map((m) => {
      const p = progression(m, seances)
      const heures = Math.max(0, p.quota - p.faites - p.planifiees)
      return { matiere: m, heures, montant: heures * (tauxParCle.get(`${m.ecoleId}|${m.niveau}`) ?? 0) }
    })
    .filter((x) => x.heures > 0)
    .sort((a, b) => b.montant - a.montant)

  return {
    mois,
    totalAcquis: mois.reduce((t, m) => t + m.acquis, 0),
    totalPlanifie: mois.reduce((t, m) => t + m.planifie, 0),
    aProgrammer,
    totalAProgrammer: aProgrammer.reduce((t, x) => t + x.montant, 0),
  }
}

/**
 * Charge semaine par semaine à partir de la semaine de `depuis`.
 * Alerte si les heures dépassent `maxHebdo` ou si plus de `maxSoirs` soirées s'enchaînent.
 */
export function chargeHebdo(seances, { depuis, nbSemaines = 8, heureSoir, maxHebdo = 25, maxSoirs = 3 }) {
  const actives = seances.filter((s) => s.statut !== 'annule')
  const semaines = []
  for (let i = 0; i < nbSemaines; i++) {
    const { debut, fin } = bornesSemaine(decalerSemaines(depuis, i))
    const lot = actives.filter((s) => s.date >= debut && s.date <= fin)
    const heures = lot.reduce((t, s) => t + heuresDe(s), 0)
    const soirs = new Set(lot.filter((s) => creneauDe(s.debut, heureSoir) === 'soir').map((s) => s.date))
    const parJour = new Map()
    for (const s of lot) parJour.set(s.date, (parJour.get(s.date) || 0) + heuresDe(s))

    let suite = 0
    let suiteMax = 0
    for (let j = 0; j < 7; j++) {
      suite = soirs.has(decalerJours(debut, j)) ? suite + 1 : 0
      suiteMax = Math.max(suiteMax, suite)
    }
    const alertes = []
    if (heures > maxHebdo) alertes.push(`${Math.round(heures)} h > ${maxHebdo} h`)
    if (suiteMax > maxSoirs) alertes.push(`${suiteMax} soirées d'affilée`)
    semaines.push({
      debut,
      fin,
      heures,
      nbSeances: lot.length,
      nbSoirs: soirs.size,
      soireesConsecutives: suiteMax,
      journeeMax: Math.max(0, ...parJour.values()),
      alertes,
    })
  }
  return semaines
}
