// Détection des collisions d'agenda : chevauchement horaire, ou trajet
// impossible entre deux cours en présentiel dans deux écoles différentes.
import { enMinutes, formatDuree } from './dates'

const TYPES = {
  chevauchement: { label: 'Chevauchement', gravite: 'erreur' },
  trajet: { label: 'Trajet trop court', gravite: 'alerte' },
}

/**
 * @param {object} a séance A (doit contenir date/debut/fin/mode/matiereId)
 * @param {object} b séance B
 * @param {object} ctx { matieresById, ecolesById, trajetMinutes }
 * @returns {?{type:string, gravite:string, message:string}}
 */
export function comparer(a, b, ctx) {
  if (a.date !== b.date) return null
  if (a.statut === 'annule' || b.statut === 'annule') return null

  const aD = enMinutes(a.debut)
  const aF = enMinutes(a.fin)
  const bD = enMinutes(b.debut)
  const bF = enMinutes(b.fin)

  if (aD < bF && bD < aF) {
    return {
      type: 'chevauchement',
      gravite: TYPES.chevauchement.gravite,
      message: `Chevauche « ${nomCours(b, ctx)} » (${b.debut}–${b.fin})`,
    }
  }

  if (a.mode !== 'presentiel' || b.mode !== 'presentiel') return null

  const ecoleA = ecoleDe(a, ctx)
  const ecoleB = ecoleDe(b, ctx)
  if (!ecoleA || !ecoleB || ecoleA === ecoleB) return null

  const ecart = bD >= aF ? bD - aF : aD - bF
  const requis = ctx.trajetMinutes ?? 45
  if (ecart < requis) {
    return {
      type: 'trajet',
      gravite: TYPES.trajet.gravite,
      message: `${formatDuree(ecart / 60)} seulement avant « ${nomCours(b, ctx)} » (${codeEcole(b, ctx)}) — ${requis} min de trajet nécessaires`,
    }
  }
  return null
}

const matiereDe = (s, ctx) => ctx.matieresById?.get(s.matiereId)
const ecoleDe = (s, ctx) => matiereDe(s, ctx)?.ecoleId
const nomCours = (s, ctx) => matiereDe(s, ctx)?.nom || 'Cours'
const codeEcole = (s, ctx) => ctx.ecolesById?.get(ecoleDe(s, ctx))?.code || '?'

/**
 * Conflits d'une séance candidate (nouvelle ou en cours d'édition) face aux autres.
 * @returns {Array} liste de conflits
 */
export function conflitsDe(candidate, autres, ctx) {
  if (!candidate?.date || !candidate?.debut || !candidate?.fin) return []
  if (enMinutes(candidate.fin) <= enMinutes(candidate.debut)) return []
  const conflits = []
  for (const s of autres) {
    if (s.id && candidate.id && s.id === candidate.id) continue
    const c = comparer(candidate, s, ctx)
    if (c) conflits.push({ ...c, avec: s })
  }
  return conflits
}

/**
 * Conflits de tout un lot de séances.
 * @returns {Map<number, Array>} identifiant de séance → conflits
 */
export function detecterConflits(seances, ctx) {
  const parJour = new Map()
  for (const s of seances) {
    if (s.statut === 'annule') continue
    if (!parJour.has(s.date)) parJour.set(s.date, [])
    parJour.get(s.date).push(s)
  }
  const resultat = new Map()
  for (const lot of parJour.values()) {
    lot.sort((a, b) => enMinutes(a.debut) - enMinutes(b.debut))
    for (let i = 0; i < lot.length; i++) {
      for (let j = i + 1; j < lot.length; j++) {
        const c = comparer(lot[i], lot[j], ctx)
        if (!c) continue
        pousser(resultat, lot[i].id, { ...c, avec: lot[j] })
        pousser(resultat, lot[j].id, { ...(comparer(lot[j], lot[i], ctx) || c), avec: lot[i] })
      }
    }
  }
  return resultat
}

function pousser(map, cle, valeur) {
  if (!map.has(cle)) map.set(cle, [])
  map.get(cle).push(valeur)
}

export const gravitePire = (conflits = []) =>
  conflits.some((c) => c.gravite === 'erreur') ? 'erreur' : conflits.length ? 'alerte' : null
