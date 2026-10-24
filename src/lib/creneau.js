// Cours du jour / cours du soir : classement d'une séance et taux majoré.
import { enMinutes } from './dates'

/** 'soir' si la séance commence à partir de l'heure de bascule, sinon 'jour'. */
export const creneauDe = (debut, heureSoir = '18:00') => (enMinutes(debut) >= enMinutes(heureSoir) ? 'soir' : 'jour')

/** Taux de la grille, majoré de `majorationPct` % pour un cours du soir. */
export const tauxCreneau = (taux, majorationPct, creneau) =>
  creneau === 'soir' ? Math.round((Number(taux) || 0) * (1 + (Number(majorationPct) || 0) / 100)) : Number(taux) || 0
