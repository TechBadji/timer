import assert from 'node:assert/strict'
const { analyserSeance } = await import('../src/lib/voix.js')

const ecoles = [
  { id: 1, code: 'BEMTECH', nom: 'BEMTECH' },
  { id: 3, code: 'ISM-ING', nom: 'ISM Ingénierie' },
]
const matieres = [
  { id: 10, nom: 'Réseaux', ecoleId: 3, niveau: 'Master' },
  { id: 11, nom: 'Réseaux', ecoleId: 1, niveau: 'Licence' },
  { id: 12, nom: 'Python', ecoleId: 1, niveau: 'Licence' },
]
const ref = new Date(2026, 8, 26) // samedi 26 septembre 2026
const a = (t) => analyserSeance(t, { matieres, ecoles, reference: ref }).champs

let c = a('Réseaux ISM Ingénierie lundi de 8h à 12h salle B2')
assert.deepEqual(c, { matiereId: 10, date: '2026-09-28', debut: '08:00', fin: '12:00', mode: 'presentiel', lieu: 'Salle B2' })
console.log('✓ matière + école + jour + créneau + salle')

c = a('python demain à 14h30 pendant 2 heures en ligne')
assert.equal(c.matiereId, 12); assert.equal(c.date, '2026-09-27'); assert.equal(c.debut, '14:30'); assert.equal(c.fin, '16:30'); assert.equal(c.mode, 'ligne')
console.log('✓ demain, durée, en ligne')

c = a('réseaux bemtech le 3 octobre de 9 heures et demie à 11h note chapitre 4 en salle C1')
assert.equal(c.matiereId, 11); assert.equal(c.date, '2026-10-03'); assert.equal(c.debut, '09:30'); assert.equal(c.fin, '11:00')
assert.equal(c.notes, 'chapitre 4 en salle C1'); assert.equal(c.lieu, undefined)
console.log('✓ date littérale, « et demie », note libre non analysée')

c = a('bonjour')
assert.deepEqual(c, {})
console.log('✓ phrase sans information → rien de pré-rempli')
console.log('\nAnalyse vocale : tout fonctionne.')
