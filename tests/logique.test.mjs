import assert from 'node:assert/strict'
import { dureeHeures, formatDuree, enHeure, enMinutes, moisPrecedent, bornesSemaine, decalerSemaines, moisDe } from '../src/lib/dates.js'
import { conflitsDe, detecterConflits } from '../src/lib/conflicts.js'
import { progression, construireRecap, variation } from '../src/lib/stats.js'

/* ---- dates ---- */
assert.equal(dureeHeures('08:00', '11:30'), 3.5)
assert.equal(formatDuree(3.5), '3h30')
assert.equal(formatDuree(2), '2h')
assert.equal(formatDuree(0.75), '45min')
assert.equal(enHeure(enMinutes('08:15') + 120), '10:15')
assert.equal(moisPrecedent('2026-01'), '2025-12')
assert.equal(decalerSemaines('2026-09-06', 2), '2026-09-20')
assert.equal(bornesSemaine('2026-09-06').debut, '2026-08-31') // dimanche → semaine commencée le lundi
console.log('✓ dates')

/* ---- référentiel de test ---- */
const ecoles = [
  { id: 1, code: 'ISM-ING', couleur: '#2563EB', ordre: 3 },
  { id: 2, code: 'BEMTECH', couleur: '#E11D48', ordre: 1 },
]
const matieres = [
  { id: 10, nom: 'Réseaux', ecoleId: 1, niveau: 'Master', volumeHoraire: 40, statut: 'en_cours' },
  { id: 11, nom: 'Python', ecoleId: 2, niveau: 'Licence', volumeHoraire: 30, statut: 'en_cours' },
]
const ctx = {
  matieresById: new Map(matieres.map((m) => [m.id, m])),
  ecolesById: new Map(ecoles.map((e) => [e.id, e])),
  trajetMinutes: 45,
}

const s = (id, matiereId, date, debut, fin, mode = 'presentiel', statut = 'fait', taux = 12000) =>
  ({ id, matiereId, date, debut, fin, mode, statut, tauxHoraire: taux })

/* ---- conflits ---- */
const a = s(1, 10, '2026-09-07', '08:00', '11:00')
const chevauche = s(2, 11, '2026-09-07', '10:00', '12:00')
const trajetCourt = s(3, 11, '2026-09-07', '11:15', '13:00')
const trajetOk = s(4, 11, '2026-09-07', '12:00', '14:00')
const enLigneJuste = s(5, 11, '2026-09-07', '11:05', '12:00', 'ligne')

assert.equal(conflitsDe(a, [chevauche], ctx)[0].type, 'chevauchement')
assert.equal(conflitsDe(a, [trajetCourt], ctx)[0].type, 'trajet')
assert.equal(conflitsDe(a, [trajetOk], ctx).length, 0, '45 min de battement = pas de conflit')
assert.equal(conflitsDe(a, [enLigneJuste], ctx).length, 0, 'un cours en ligne ne demande pas de trajet')
// même école en présentiel, enchaînement immédiat : autorisé
assert.equal(conflitsDe(a, [s(6, 10, '2026-09-07', '11:00', '13:00')], ctx).length, 0)

const carte = detecterConflits([a, chevauche, trajetCourt], ctx)
assert.equal(carte.get(1).length, 2) // chevauchement avec 2, trajet avec 3
assert.equal(carte.get(2).length, 2) // chevauchement avec 1 et avec 3
assert.equal(carte.get(3).length, 2) // trajet depuis 1, chevauchement avec 2
assert.equal(carte.get(1).map((c) => c.type).sort().join(','), 'chevauchement,trajet')
console.log('✓ conflits')

/* ---- progression ---- */
const seances = [
  s(1, 10, '2026-09-01', '08:00', '12:00'), // 4h faites
  s(2, 10, '2026-09-08', '08:00', '12:00'), // 4h faites
  s(3, 10, '2026-09-15', '08:00', '11:00', 'presentiel', 'planifie'), // 3h planifiées
  s(4, 10, '2026-09-22', '08:00', '11:00', 'presentiel', 'annule'), // ignorée
  s(5, 11, '2026-09-02', '18:00', '21:00', 'ligne', 'fait', 9000), // 3h Python
]
const p = progression(matieres[0], seances)
assert.equal(p.faites, 8)
assert.equal(p.planifiees, 3)
assert.equal(p.restantes, 32)
assert.equal(Math.round(p.pct), 20)
assert.equal(p.nbSeances, 3, 'la séance annulée est exclue')
assert.equal(p.alerte, null)

const petiteMatiere = { id: 10, nom: 'X', ecoleId: 1, niveau: 'Master', volumeHoraire: 6 }
assert.equal(progression(petiteMatiere, seances).alerte.niveau, 'erreur') // 8h > 6h
console.log('✓ progression')

/* ---- récap mensuel ---- */
const r = construireRecap('2026-09', seances, ctx)
assert.equal(r.nbSeances, 4, 'la séance annulée est exclue du récap')
assert.equal(r.heures, 8 + 3 + 3)
assert.equal(r.heuresFaites, 11)
assert.equal(r.heuresPlanifiees, 3)
assert.equal(r.montant, 11 * 12000 + 3 * 9000)
assert.equal(r.montantFait, 8 * 12000 + 3 * 9000)
assert.equal(r.parEcole.length, 2)
assert.equal(r.parEcole[0].code, 'ISM-ING')
assert.equal(r.parEcole[0].heures, 11)
assert.equal(r.parMode.find((m) => m.mode === 'ligne').heures, 3)
assert.equal(r.parNiveau.find((n) => n.niveau === 'Licence').heures, 3)
assert.equal(construireRecap('2026-10', seances, ctx).nbSeances, 0)
assert.equal(Math.round(variation(150, 100)), 50)
assert.equal(variation(10, 0), 100)
assert.equal(moisDe('2026-09-07'), '2026-09')
console.log('✓ récap mensuel')

console.log('\nTous les tests de logique passent.')
