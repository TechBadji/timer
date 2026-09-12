import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
const R = '../src'
const { db, lireReglages, ecrireReglage, assurerReglages } = await import(`${R}/data/db.js`)
const repo = await import(`${R}/data/repo.js`)
const { progression, construireRecap } = await import(`${R}/lib/stats.js`)

await db.open()

/* Amorçage */
const ecoles = await db.ecoles.orderBy('ordre').toArray()
assert.equal(ecoles.length, 6)
assert.deepEqual(ecoles.map((e) => e.code), ['BEMTECH', 'AFITECH', 'ISM-ING', 'ISM-MAN', 'ISM-SOIR', 'DM'])
await assurerReglages()
const reglages = await lireReglages()
assert.equal(reglages.trajetMinutes, 45)
assert.equal(reglages.heureFinJour, '21:00')
console.log('✓ amorçage : 6 écoles + réglages')

/* Tarifs : un taux par couple école + niveau */
const ismIng = ecoles.find((e) => e.code === 'ISM-ING')
const bemtech = ecoles.find((e) => e.code === 'BEMTECH')
await repo.definirTarif(ismIng.id, 'Master', 15000)
await repo.definirTarif(ismIng.id, 'Licence', 12000)
await repo.definirTarif(bemtech.id, 'Licence', 9000)
await repo.definirTarif(ismIng.id, 'Master', 16000) // mise à jour, pas de doublon
assert.equal(await db.tarifs.count(), 3)
assert.equal(await repo.tauxPour(ismIng.id, 'Master'), 16000)
console.log('✓ grille tarifaire (unicité école+niveau)')

/* Matières */
const idReseaux = await repo.creerMatiere({ nom: 'Réseaux', ecoleId: ismIng.id, niveau: 'Master', volumeHoraire: 40, modeParDefaut: 'presentiel', lieuParDefaut: 'B2' })
const idPython = await repo.creerMatiere({ nom: 'Python', ecoleId: bemtech.id, niveau: 'Licence', volumeHoraire: 30, modeParDefaut: 'ligne' })
assert.equal((await db.matieres.get(idReseaux)).statut, 'en_cours')

/* Séance simple : le taux est figé à la création */
await repo.creerSeance({ matiereId: idReseaux, date: '2026-09-07', debut: '08:00', fin: '12:00', mode: 'presentiel', lieu: 'B2', statut: 'fait' })
let s1 = await db.seances.toArray()
assert.equal(s1[0].tauxHoraire, 16000)
assert.equal(repo.montantSeance(s1[0]), 4 * 16000)

/* Changer la grille ne réécrit pas le passé */
await repo.definirTarif(ismIng.id, 'Master', 20000)
s1 = await db.seances.get(s1[0].id)
assert.equal(s1.tauxHoraire, 16000, 'le taux historique reste figé')
console.log('✓ séance : taux figé à la création')

/* Récurrence : 1 + 11 occurrences hebdomadaires */
const ids = await repo.creerSeance(
  { matiereId: idPython, date: '2026-09-02', debut: '18:00', fin: '21:00', mode: 'ligne', lien: 'https://meet' },
  { repetitions: 11 }
)
assert.equal(ids.length, 12)
const serie = await db.seances.where('matiereId').equals(idPython).sortBy('date')
assert.equal(serie[0].date, '2026-09-02')
assert.equal(serie[11].date, '2026-11-18') // 11 semaines plus tard
assert.ok(serie.every((s) => s.serieId === serie[0].serieId))
assert.equal(serie[0].lieu, '', 'un cours en ligne ne porte pas de salle')
console.log('✓ récurrence hebdomadaire (12 séances)')

/* Suppression d'une série à partir d'une date */
const supprimees = await repo.supprimerSerie(serie[0].serieId, '2026-10-21')
assert.equal(supprimees, 5)
assert.equal(await db.seances.where('matiereId').equals(idPython).count(), 7)
console.log('✓ suppression de série à partir d’une date')

/* Duplication de semaine : la semaine du 7 sept. contient 2 séances
   (Réseaux le lundi 7, Python le mercredi 9), recopiées sur 3 semaines. */
const crees = await repo.dupliquerSemaine('2026-09-07', 3)
assert.equal(crees, 6, '2 séances dans la semaine × 3 semaines')
const copies = await db.seances
  .where('date')
  .anyOf(['2026-09-14', '2026-09-21', '2026-09-28'])
  .and((s) => s.matiereId === idReseaux)
  .toArray()
assert.equal(copies.length, 3)
assert.ok(copies.every((c) => c.statut === 'planifie' && c.lieu === 'B2' && c.tauxHoraire === 16000))
assert.ok(copies.every((c) => c.debut === '08:00' && c.fin === '12:00'), 'horaires recopiés à l’identique')
console.log('✓ duplication de semaine (toutes les séances de la semaine)')

/* Progression du quota */
const toutes = await db.seances.toArray()
const mReseaux = await db.matieres.get(idReseaux)
const p = progression(mReseaux, toutes)
assert.equal(p.faites, 4, '4 h effectuées')
assert.equal(p.planifiees, 12, '3 copies de 4 h planifiées')
assert.equal(p.restantes, 36)

/* Marquer effectuée décompte le quota */
await repo.marquerFait(copies[0].id)
const p2 = progression(mReseaux, await db.seances.toArray())
assert.equal(p2.faites, 8)
console.log('✓ décompte automatique du quota')

/* Paiements : bascule payé / en attente sans doublon */
await repo.basculerPaiement(ismIng.id, '2026-09', 'paye', 128000)
await repo.basculerPaiement(ismIng.id, '2026-09', 'en_attente', 128000)
await repo.basculerPaiement(ismIng.id, '2026-09', 'paye', 130000)
const paiements = await db.paiements.toArray()
assert.equal(paiements.length, 1)
assert.equal(paiements[0].statut, 'paye')
assert.equal(paiements[0].montant, 130000)
console.log('✓ statut de paiement par école et par mois')

/* Récap mensuel sur les données réelles */
const ctx = {
  matieresById: new Map((await db.matieres.toArray()).map((m) => [m.id, m])),
  ecolesById: new Map(ecoles.map((e) => [e.id, e])),
}
const recap = construireRecap('2026-09', await db.seances.toArray(), ctx)
assert.equal(recap.parEcole.length, 2)
assert.ok(recap.montant > 0)
console.log(`✓ récap septembre : ${recap.heures} h, ${recap.montant} FCFA, ${recap.nbSeances} séances`)

/* Suppression en cascade d'une matière */
await repo.supprimerMatiere(idPython)
assert.equal(await db.seances.where('matiereId').equals(idPython).count(), 0)
console.log('✓ suppression matière → séances supprimées')

/* Sauvegarde / restauration */
const { exporterJSON } = await import(`${R}/lib/backup.js`)
const sauvegarde = await exporterJSON()
assert.equal(sauvegarde.tables.ecoles.length, 6)
assert.ok(sauvegarde.tables.seances.length > 0)
console.log('✓ export de sauvegarde JSON')

/* ---- Transfert vers une autre installation : export puis restauration ---- */
{
  const { exporterJSON: exporter2, importerSauvegarde } = await import(`${R}/lib/backup.js`)

  const avant = {
    ecoles: await db.ecoles.toArray(),
    matieres: await db.matieres.toArray(),
    tarifs: await db.tarifs.toArray(),
    seances: await db.seances.toArray(),
    paiements: await db.paiements.toArray(),
    reglages: await db.reglages.toArray(),
  }
  const fichier = await exporter2()

  // On simule l'appareil de destination : base vidée de bout en bout.
  await Promise.all([db.ecoles, db.matieres, db.tarifs, db.seances, db.paiements, db.reglages].map((t) => t.clear()))
  assert.equal(await db.seances.count(), 0)

  // La restauration reçoit un Blob-like, comme l'input fichier du navigateur.
  const compte = await importerSauvegarde({ text: async () => JSON.stringify(fichier) })

  assert.equal(compte.seances, avant.seances.length)
  for (const [table, lignes] of Object.entries(avant)) {
    const apres = await db.table(table).toArray()
    assert.deepEqual(
      apres.sort((a, b) => String(a.id ?? a.cle).localeCompare(String(b.id ?? b.cle))),
      lignes.sort((a, b) => String(a.id ?? a.cle).localeCompare(String(b.id ?? b.cle))),
      `table ${table} restaurée à l'identique`
    )
  }

  // Un fichier étranger doit être refusé plutôt qu'écraser la base.
  await assert.rejects(() => importerSauvegarde({ text: async () => '{"app":"autre"}' }), /non reconnu/)
  assert.equal(await db.seances.count(), avant.seances.length, 'la base est intacte après un refus')

  console.log(`✓ transfert : ${compte.seances} séances, ${compte.matieres} matières, ${compte.tarifs} tarifs restaurés à l'identique`)
}
console.log('\nToute la couche de persistance fonctionne.')
process.exit(0)
