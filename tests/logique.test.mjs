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

// Arbitrage : une entrée par paire, et un trajet toléré disparaît tant que les créneaux ne bougent pas.
const { listerConflits, clePaire } = await import('../src/lib/conflicts.js')
const paires = listerConflits([a, chevauche, trajetCourt], ctx)
assert.deepEqual(paires.map((p) => [p.a.id, p.b.id, p.type]), [[1, 2, 'chevauchement'], [1, 3, 'trajet'], [2, 3, 'chevauchement']])
const tolere = { ...ctx, ignores: new Set([clePaire(trajetCourt, a)]) }
assert.equal(listerConflits([a, trajetCourt], tolere).length, 0)
assert.equal(listerConflits([a, { ...trajetCourt, debut: '11:10' }], tolere).length, 1, 'séance déplacée : conflit réévalué')
assert.equal(listerConflits([a, { ...chevauche, statut: 'annule' }], ctx).length, 0, 'un cours annulé ne gêne plus')
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

const { analyserClasses, libelleClasses } = await import('../src/lib/classes.js')
assert.deepEqual(analyserClasses(' L3 IA, L3  GLRS ; l3 ia,, IAGE\nETSE '), ['L3 IA', 'L3 GLRS', 'IAGE', 'ETSE'])
assert.deepEqual(analyserClasses(['L3 IA', 'L3 GLRS']), ['L3 IA', 'L3 GLRS'])
assert.deepEqual(analyserClasses(undefined), [])
assert.equal(libelleClasses({ classes: ['L3 IA', 'L3 GLRS'] }), 'L3 IA, L3 GLRS')
assert.equal(libelleClasses({}), '')
console.log('✓ classes d\'une matière')

console.log('\nTous les tests de logique passent.')

/* ---- numérotation des séances ---- */
{
  const { numeroterSeances, libelleRang } = await import('../src/lib/stats.js')
  const mats = new Map([['m', { id: 'm', volumeHoraire: 12 }]])
  const ss = [
    { id: 2, matiereId: 'm', date: '2026-01-09', debut: '08:00', fin: '11:00', statut: 'planifie' },
    { id: 1, matiereId: 'm', date: '2026-01-02', debut: '08:00', fin: '11:00', statut: 'fait' },
    { id: 3, matiereId: 'm', date: '2026-01-05', debut: '08:00', fin: '11:00', statut: 'annule' },
  ]
  const n = numeroterSeances(ss, mats)
  assert.deepEqual(n.get(1), { rang: 1, total: 4, cumul: 3, quota: 12 })
  assert.equal(n.get(2).rang, 2)
  assert.equal(n.has(3), false)
  assert.equal(libelleRang(1), '1ère séance')
  assert.equal(libelleRang(3), '3ème séance')
  console.log('✓ numérotation des séances')
}

/* ---- facturation ---- */
{
  const { numeroFacture, etatFacture, facturesEnRetard, texteRelance } = await import('../src/lib/facturation.js')
  assert.equal(numeroFacture({ code: 'ism-ing' }, '2026-09'), 'ISM-ING-202609')
  assert.equal(etatFacture(undefined, 30, '2026-10-24').etat, 'a_facturer')
  assert.equal(etatFacture({ statut: 'paye' }, 30, '2026-10-24').etat, 'payee')
  const f = { statut: 'facture', mois: '2026-08', dateFacture: '2026-09-01', montant: 150000, ecoleId: 1 }
  assert.deepEqual(etatFacture(f, 30, '2026-10-01'), { etat: 'facturee', joursRetard: 0, echeance: '2026-10-01' })
  assert.deepEqual(etatFacture(f, 30, '2026-10-24'), { etat: 'en_retard', joursRetard: 23, echeance: '2026-10-01' })
  assert.equal(facturesEnRetard([f, { ...f, statut: 'paye' }], 30, '2026-10-24').length, 1)
  assert.match(texteRelance(f, { code: 'BEMTECH' }, { enseignant: 'X', heures: 12 }), /BEMTECH-202608.*d.août 2026 \(12h\)/)
  console.log('✓ facturation')
}

/* ---- jour / soir ---- */
{
  const { creneauDe, tauxCreneau } = await import('../src/lib/creneau.js')
  assert.equal(creneauDe('17:59', '18:00'), 'jour')
  assert.equal(creneauDe('18:00', '18:00'), 'soir')
  assert.equal(tauxCreneau(10000, 20, 'soir'), 12000)
  assert.equal(tauxCreneau(10000, 20, 'jour'), 10000)
  assert.equal(tauxCreneau(10000, 0, 'soir'), 10000)
  const mats = new Map([['m', { id: 'm', ecoleId: 'e', niveau: 'L3' }]])
  const r = construireRecap('2026-10', [
    { id: 1, matiereId: 'm', date: '2026-10-01', debut: '08:00', fin: '10:00', statut: 'fait', mode: 'presentiel', tauxHoraire: 1 },
    { id: 2, matiereId: 'm', date: '2026-10-02', debut: '18:30', fin: '21:30', statut: 'fait', mode: 'presentiel', tauxHoraire: 1 },
  ], { matieresById: mats, ecolesById: new Map(), heureSoir: '18:00' })
  assert.deepEqual(r.parCreneau.map((c) => [c.creneau, c.heures]), [['soir', 3], ['jour', 2]])
  console.log('✓ jour / soir')
}

/* ---- trajets par paire d'écoles ---- */
{
  const { cleTrajet } = await import('../src/lib/conflicts.js')
  assert.equal(cleTrajet(2, 1), '1|2')
  const a = s(1, 10, '2026-09-07', '08:00', '11:00')
  const b = s(2, 11, '2026-09-07', '11:30', '13:00') // 30 min d'écart, défaut 45 → conflit
  assert.equal(conflitsDe(a, [b], ctx)[0].type, 'trajet')
  assert.equal(conflitsDe(a, [b], { ...ctx, trajets: { '1|2': 20 } }).length, 0, 'trajet propre plus court que le défaut')
  const c = conflitsDe(a, [b], { ...ctx, trajetMinutes: 10, trajets: { '1|2': 40 } })[0]
  assert.equal(c.requis, 40)
  assert.match(c.message, /40 min/)
  console.log('✓ trajets par paire d\'écoles')
}

/* ---- évaluations ---- */
{
  const { notesARemettre, estEvaluation } = await import('../src/lib/evaluations.js')
  const ev = (id, date, extra = {}) => ({ id, date, typeSeance: 'examen', statut: 'fait', notesRemises: false, ...extra })
  assert.equal(estEvaluation({ typeSeance: 'cours' }), false)
  const l = notesARemettre(
    [ev(1, '2026-10-01'), ev(2, '2026-10-20'), ev(3, '2026-10-30'), ev(4, '2026-10-01', { notesRemises: true }), { id: 5, date: '2026-10-01', typeSeance: 'cours' }],
    14,
    '2026-10-24'
  )
  assert.deepEqual(l.map((x) => [x.seance.id, x.joursRestants]), [[1, -9], [2, 10]])
  console.log('✓ évaluations')
}

/* ---- export iCal ---- */
{
  const { construireIcs } = await import('../src/lib/ical.js')
  const ics = construireIcs(
    [
      { ...s(1, 10, '2026-09-07', '08:00', '11:00'), lieu: 'Salle B2, campus', typeSeance: 'examen' },
      { ...s(2, 11, '2026-09-08', '18:30', '20:30', 'presentiel', 'annule'), notes: 'x'.repeat(200) },
    ],
    ctx
  )
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /UID:seance-1@timer/)
  assert.match(ics, /DTSTART:20260907T080000\r\nDTEND:20260907T110000/)
  assert.match(ics, /SUMMARY:\[Examen\] Réseaux — /)
  assert.match(ics, /LOCATION:Salle B2\\, campus/)
  assert.match(ics, /UID:seance-2@timer[\s\S]*STATUS:CANCELLED/)
  assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'lignes repliées à 75 octets')
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2)
  console.log('✓ export iCal')
}

/* ---- pilotage ---- */
{
  const { previsionnel, chargeHebdo } = await import('../src/lib/pilotage.js')
  const lot = [
    s(1, 10, '2026-09-07', '08:00', '10:00', 'presentiel', 'fait', 10000),
    s(2, 10, '2026-10-05', '08:00', '11:00', 'presentiel', 'planifie', 10000),
    s(3, 11, '2026-10-06', '08:00', '09:00', 'presentiel', 'annule', 10000),
  ]
  const p = previsionnel(lot, { matieres, tauxParCle: new Map([['1|Master', 10000]]), depuis: '2026-09', nbMois: 2 })
  assert.deepEqual(p.mois.map((m) => [m.mois, m.acquis, m.planifie]), [['2026-09', 20000, 0], ['2026-10', 0, 30000]])
  const reseaux = p.aProgrammer.find((x) => x.matiere.id === 10)
  assert.equal(reseaux.heures, 35) // 40 h − 2 faites − 3 planifiées
  assert.equal(reseaux.montant, 350000)

  // Lundi 07/09 → jeudi 10/09 : quatre soirées d'affilée, 4 × 3 h + 14 h de jour.
  const soirs = [7, 8, 9, 10].map((j) => s(100 + j, 10, `2026-09-${String(j).padStart(2, '0')}`, '18:30', '21:30', 'presentiel', 'planifie'))
  const jour = s(200, 11, '2026-09-11', '08:00', '22:00', 'presentiel', 'planifie')
  const [w] = chargeHebdo([...soirs, jour], { depuis: '2026-09-09', nbSemaines: 1, heureSoir: '18:00', maxHebdo: 25, maxSoirs: 3 })
  assert.equal(w.debut, '2026-09-07')
  assert.equal(w.heures, 26)
  assert.equal(w.soireesConsecutives, 4)
  assert.equal(w.journeeMax, 14)
  assert.equal(w.alertes.length, 2)
  console.log('✓ pilotage')
}

/* ---- bilan annuel ---- */
{
  const { bilanAnnuel, bornesAnnee } = await import('../src/lib/bilan.js')
  assert.deepEqual(bornesAnnee(2025, 'universitaire'), { debut: '2025-10-01', fin: '2026-09-30', label: '2025-2026' })
  const lot = [
    s(1, 10, '2026-03-02', '08:00', '12:00', 'presentiel', 'fait', 10000),
    s(2, 10, '2026-03-09', '08:00', '10:00', 'presentiel', 'fait', 13000),
    s(3, 10, '2026-03-16', '08:00', '10:00', 'presentiel', 'annule', 10000),
    s(4, 11, '2025-12-01', '08:00', '10:00', 'presentiel', 'fait', 10000), // hors année civile 2026
  ]
  const pays = [
    { ecoleId: 1, mois: '2026-03', statut: 'paye', montant: 66000, dateFacture: '2026-04-01', datePaiement: '2026-04-21' },
    { ecoleId: 1, mois: '2026-04', statut: 'facture', montant: 20000, dateFacture: '2026-05-01' },
  ]
  const b = bilanAnnuel(lot, pays, { ...ctx, annee: 2026, type: 'civile', delaiJours: 30, aujourdhui: '2026-10-24' })
  assert.equal(b.ecoles.length, 1)
  const [e] = b.ecoles
  assert.equal(e.heures, 6)
  assert.equal(e.montant, 66000)
  assert.equal(e.tauxMoyen, 11000)
  assert.equal(e.nbAnnulees, 1)
  assert.equal(e.facture, 86000)
  assert.equal(e.resteAEncaisser, 20000)
  assert.equal(e.enRetard, 1)
  assert.equal(e.delaiMoyen, 20)
  const u = bilanAnnuel(lot, pays, { ...ctx, annee: 2025, type: 'universitaire', aujourdhui: '2026-10-24' })
  assert.equal(u.totaux.nbSeances, 3)
  console.log('✓ bilan annuel')
}
