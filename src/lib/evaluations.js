// Évaluations : contrôles, examens et soutenances, et échéance de remise des notes.
import { decalerJours } from './dates'

export const TYPES_SEANCE = [
  { valeur: 'cours', label: 'Cours', court: '' },
  { valeur: 'controle', label: 'Contrôle', court: 'CC' },
  { valeur: 'examen', label: 'Examen', court: 'Exam' },
  { valeur: 'soutenance', label: 'Soutenance', court: 'Sout.' },
]
export const typeSeance = (valeur) => TYPES_SEANCE.find((t) => t.valeur === valeur) || TYPES_SEANCE[0]
export const estEvaluation = (s) => !!s?.typeSeance && s.typeSeance !== 'cours'

/**
 * Évaluations passées dont les notes ne sont pas encore remises, par échéance croissante.
 * @returns {Array<{seance, echeance, joursRestants}>} joursRestants < 0 : en retard
 */
export function notesARemettre(seances, delaiJours, aujourdhui) {
  return seances
    .filter((s) => estEvaluation(s) && !s.notesRemises && s.statut !== 'annule' && s.date <= aujourdhui)
    .map((s) => {
      const echeance = decalerJours(s.date, delaiJours)
      return { seance: s, echeance, joursRestants: Math.round((Date.parse(echeance) - Date.parse(aujourdhui)) / 86400000) }
    })
    .sort((a, b) => a.echeance.localeCompare(b.echeance))
}
