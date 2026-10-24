// Bilan annuel par école : volume, rémunération, facturation et délais de paiement.
import { heuresDe, montantDe } from './stats'
import { etatFacture } from './facturation'

/**
 * Bornes d'une période annuelle.
 * @param {'civile'|'universitaire'} type universitaire = octobre `annee` → septembre `annee + 1`
 */
export const bornesAnnee = (annee, type) =>
  type === 'universitaire'
    ? { debut: `${annee}-10-01`, fin: `${annee + 1}-09-30`, label: `${annee}-${annee + 1}` }
    : { debut: `${annee}-01-01`, fin: `${annee}-12-31`, label: String(annee) }

const joursEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

export function bilanAnnuel(seances, paiements, { matieresById, ecolesById, annee, type = 'civile', delaiJours = 30, aujourdhui }) {
  const { debut, fin, label } = bornesAnnee(annee, type)
  const moisDebut = debut.slice(0, 7)
  const moisFin = fin.slice(0, 7)
  const parEcole = new Map()
  const ligne = (ecoleId) => {
    if (!parEcole.has(ecoleId)) {
      const e = ecolesById.get(ecoleId)
      parEcole.set(ecoleId, {
        ecoleId,
        code: e?.code || '—',
        nom: e?.nom || '—',
        couleur: e?.couleur || '#64748b',
        heures: 0,
        montant: 0,
        nbSeances: 0,
        nbAnnulees: 0,
        matieres: new Set(),
        facture: 0,
        paye: 0,
        enRetard: 0,
        delais: [],
      })
    }
    return parEcole.get(ecoleId)
  }

  for (const s of seances) {
    if (s.date < debut || s.date > fin) continue
    const m = matieresById.get(s.matiereId)
    if (!m) continue
    const l = ligne(m.ecoleId)
    if (s.statut === 'annule') {
      l.nbAnnulees += 1
      continue
    }
    if (s.statut !== 'fait') continue
    l.heures += heuresDe(s)
    l.montant += montantDe(s)
    l.nbSeances += 1
    l.matieres.add(m.id)
  }

  for (const p of paiements) {
    if (p.mois < moisDebut || p.mois > moisFin || p.statut === 'en_attente') continue
    const l = ligne(p.ecoleId)
    l.facture += Number(p.montant) || 0
    if (p.statut === 'paye') {
      l.paye += Number(p.montant) || 0
      if (p.dateFacture && p.datePaiement) l.delais.push(joursEntre(p.dateFacture, p.datePaiement))
    } else if (etatFacture(p, delaiJours, aujourdhui).etat === 'en_retard') l.enRetard += 1
  }

  const ecoles = [...parEcole.values()]
    .map(({ matieres, delais, ...l }) => ({
      ...l,
      nbMatieres: matieres.size,
      tauxMoyen: l.heures ? l.montant / l.heures : 0,
      resteAEncaisser: l.facture - l.paye,
      delaiMoyen: delais.length ? Math.round(delais.reduce((t, d) => t + d, 0) / delais.length) : null,
    }))
    .filter((l) => l.nbSeances || l.facture)
    .sort((a, b) => b.montant - a.montant)

  const somme = (k) => ecoles.reduce((t, l) => t + l[k], 0)
  const heures = somme('heures')
  return {
    label,
    debut,
    fin,
    ecoles,
    totaux: {
      heures,
      montant: somme('montant'),
      nbSeances: somme('nbSeances'),
      facture: somme('facture'),
      paye: somme('paye'),
      resteAEncaisser: somme('resteAEncaisser'),
      enRetard: somme('enRetard'),
      tauxMoyen: heures ? somme('montant') / heures : 0,
    },
  }
}
