// Facturation mensuelle par école : statut, numéro de facture, retards et relances.
import { decalerJours, moisLabel, jourLabel, formatDuree } from './dates'
import { fcfa } from './money'

/** Numéro lisible et stable : CODE-AAAAMM (une facture par école et par mois). */
export const numeroFacture = (ecole, mois) => `${String(ecole?.code || 'ECOLE').toUpperCase()}-${mois.replace('-', '')}`

/** Seules les séances effectuées se facturent. */
export const seancesFacturables = (seances) => seances.filter((s) => s.statut === 'fait')

/**
 * Écart entre le montant d'une facture émise et les séances effectuées du mois
 * (séance ajoutée, annulée ou modifiée après coup). 0 si rien à signaler.
 */
export const ecartFacture = (paiement, montantFait) =>
  paiement && paiement.statut !== 'en_attente' && Math.abs((Number(paiement.montant) || 0) - montantFait) >= 1
    ? montantFait - (Number(paiement.montant) || 0)
    : 0

/** Date limite de paiement d'une facture émise. */
export const echeance = (dateFacture, delaiJours) => (dateFacture ? decalerJours(dateFacture, delaiJours) : null)

/**
 * État affiché d'un paiement mensuel.
 * @returns {{ etat: 'a_facturer'|'facturee'|'en_retard'|'payee', joursRetard: number, echeance: string|null }}
 */
export function etatFacture(paiement, delaiJours, aujourdhui) {
  if (paiement?.statut === 'paye') return { etat: 'payee', joursRetard: 0, echeance: null }
  if (paiement?.statut !== 'facture') return { etat: 'a_facturer', joursRetard: 0, echeance: null }
  const ech = echeance(paiement.dateFacture, delaiJours)
  const joursRetard = ech && aujourdhui > ech ? Math.round((Date.parse(aujourdhui) - Date.parse(ech)) / 86400000) : 0
  return { etat: joursRetard > 0 ? 'en_retard' : 'facturee', joursRetard, echeance: ech }
}

/** Factures émises et non réglées après échéance, de la plus ancienne à la plus récente. */
export const facturesEnRetard = (paiements, delaiJours, aujourdhui) =>
  paiements
    .map((p) => ({ ...p, ...etatFacture(p, delaiJours, aujourdhui) }))
    .filter((p) => p.etat === 'en_retard')
    .sort((a, b) => a.mois.localeCompare(b.mois))

const de = (mot) => (/^[aeiouyhâéè]/i.test(mot) ? `d'${mot}` : `de ${mot}`)

/** Message de relance courtois, prêt à envoyer par e-mail ou WhatsApp. */
export function texteRelance(paiement, ecole, { enseignant, heures }) {
  return [
    'Bonjour,',
    '',
    `Sauf erreur de ma part, la facture ${paiement.numeroFacture || numeroFacture(ecole, paiement.mois)} du ${jourLabel(paiement.dateFacture, 'dd/MM/yyyy')}, ` +
      `relative aux enseignements ${de(moisLabel(paiement.mois))}${heures ? ` (${formatDuree(heures)})` : ''} pour un montant de ${fcfa(paiement.montant)}, ` +
      `reste en attente de règlement.`,
    '',
    'Pourriez-vous me confirmer la date de paiement prévue ?',
    '',
    'Je vous remercie par avance.',
    'Cordialement,',
    enseignant || '',
  ].join('\n')
}
