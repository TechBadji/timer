import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'

// Node n'expose localStorage qu'avec --localstorage-file ; on le simule en
// mémoire pour ce test, comme le fait un navigateur.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  const magasin = new Map()
  globalThis.localStorage = {
    getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
    setItem: (k, v) => magasin.set(k, String(v)),
    removeItem: (k) => magasin.delete(k),
  }
}

const R = '../src'
const { db } = await import(`${R}/data/db.js`)
const auth = await import(`${R}/lib/auth.js`)
const backup = await import(`${R}/lib/backup.js`)
const repo = await import(`${R}/data/repo.js`)

await db.open()

/* Aucun compte au départ */
assert.equal(await auth.compteExiste(), false)
assert.equal(auth.sessionValide(), false)
console.log('✓ aucun compte au premier lancement')

/* Création de compte + hachage salé (jamais le mot de passe en clair) */
await auth.creerCompte('elias', 'motdepasse123')
assert.equal(await auth.compteExiste(), true)
const compte = await db.comptes.toCollection().first()
assert.notEqual(compte.hachage, 'motdepasse123')
assert.equal(compte.hachage.length, 64) // SHA-256 en hexadécimal
console.log('✓ création de compte : mot de passe haché, jamais stocké en clair')

/* Vérification des identifiants */
assert.equal(await auth.verifierIdentifiants('elias', 'motdepasse123'), true)
assert.equal(await auth.verifierIdentifiants('elias', 'mauvais'), false)
assert.equal(await auth.verifierIdentifiants('inconnu', 'motdepasse123'), false)
console.log('✓ vérification des identifiants (bon / mauvais mot de passe / identifiant inconnu)')

/* Session */
auth.ouvrirSession('elias')
assert.equal(auth.sessionValide(), true)
assert.equal(auth.identifiantSession(), 'elias')
auth.fermerSession()
assert.equal(auth.sessionValide(), false)
console.log('✓ session : ouverture, lecture, fermeture')

/* Changement de mot de passe */
await auth.changerMotDePasse('motdepasse123', 'nouveauMdp!')
assert.equal(await auth.verifierIdentifiants('elias', 'motdepasse123'), false)
assert.equal(await auth.verifierIdentifiants('elias', 'nouveauMdp!'), true)
await assert.rejects(() => auth.changerMotDePasse('faux', 'autre'), /incorrect/)
console.log('✓ changement de mot de passe (ancien invalidé, mauvais mot de passe actuel refusé)')

/* Un second créerCompte remplace le compte existant (un seul compte local) */
await auth.creerCompte('prof', 'secret42')
assert.equal(await db.comptes.count(), 1)
assert.equal(await auth.verifierIdentifiants('prof', 'secret42'), true)
console.log('✓ un seul compte local à la fois')

/* Sauvegardes automatiques rotatives, indépendantes du compte */
const ecoles = await db.ecoles.orderBy('ordre').toArray()
await repo.creerMatiere({ nom: 'Algo', ecoleId: ecoles[0].id, niveau: 'Licence', volumeHoraire: 20, modeParDefaut: 'presentiel' })

await backup.sauvegarderAuto()
await backup.sauvegarderAuto()
let liste = await backup.listerSauvegardesAuto()
assert.equal(liste.length, 2)
console.log('✓ instantanés automatiques créés')

for (let i = 0; i < 10; i++) await backup.sauvegarderAuto()
liste = await backup.listerSauvegardesAuto()
assert.ok(liste.length <= 7, `rotation attendue (<=7), obtenu ${liste.length}`)
console.log('✓ rotation des instantanés (7 maximum)')

/* sauvegarderAutoSiNecessaire ne recrée pas d'instantané si le dernier est récent */
const avant = (await backup.listerSauvegardesAuto()).length
await backup.sauvegarderAutoSiNecessaire()
const apres = (await backup.listerSauvegardesAuto()).length
assert.equal(apres, avant)
console.log('✓ pas de doublon d’instantané si le dernier date de moins de 24h')

/* Restauration d’un instantané : le compte n’est pas affecté */
await db.matieres.clear()
const derniere = (await backup.listerSauvegardesAuto())[0]
const n = await backup.restaurerSauvegardeAuto(derniere.id)
assert.ok(n.matieres >= 1)
assert.equal(await db.matieres.count(), n.matieres)
assert.equal(await auth.verifierIdentifiants('prof', 'secret42'), true)
console.log('✓ restauration d’un instantané : données restaurées, compte local conservé')

console.log('\nAuthentification locale et sauvegardes automatiques : tout fonctionne.')
