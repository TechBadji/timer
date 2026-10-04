// Écritures métier : tout passe par ici pour garder la base cohérente.
// user_id est posé automatiquement par la valeur par défaut RLS (auth.uid())
// côté Postgres ? non : Postgres ne connaît pas de "default auth.uid()" portable
// ici, donc on le fournit explicitement à chaque insertion.
import { supabase, versLigne, versObjets, leverSiErreur } from './supabase'
import { dureeHeures, decalerSemaines, estPasse } from '../lib/dates'
import { analyserClasses } from '../lib/classes'

const nettoyer = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

async function utilisateurId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  return user.id
}

/* ---------------------------------- Écoles --------------------------------- */

export async function majEcole(id, champs) {
  leverSiErreur(await supabase.from('ecoles').update(versLigne(nettoyer(champs))).eq('id', id))
}

/* --------------------------------- Matières -------------------------------- */

export async function creerMatiere(m) {
  const user_id = await utilisateurId()
  const classes = analyserClasses(m.classes)
  const ligne = versLigne({
    nom: m.nom.trim(),
    ecoleId: Number(m.ecoleId),
    niveau: m.niveau,
    // Envoyé seulement s'il y en a : une base sans la colonne `classes`
    // (supabase/migration-classes.sql non exécuté) accepte encore les matières sans classe.
    classes: classes.length ? classes : undefined,
    volumeHoraire: Number(m.volumeHoraire) || 0,
    statut: 'en_cours',
    modeParDefaut: m.modeParDefaut || 'presentiel',
    lieuParDefaut: m.lieuParDefaut || '',
    lienParDefaut: m.lienParDefaut || '',
    note: m.note || '',
    creeLe: new Date().toISOString(),
  })
  const data = leverSiErreur(await supabase.from('matieres').insert({ ...ligne, user_id }).select('id').single())
  return data.id
}

export async function majMatiere(id, champs) {
  leverSiErreur(await supabase.from('matieres').update(versLigne(nettoyer(champs))).eq('id', id))
}

export async function changerStatutMatiere(id, statut) {
  leverSiErreur(
    await supabase
      .from('matieres')
      .update(versLigne({ statut, termineLe: statut === 'terminee' ? new Date().toISOString() : null }))
      .eq('id', id)
  )
}

/** Supprime une matière et toutes ses séances (ON DELETE CASCADE côté base). */
export async function supprimerMatiere(id) {
  leverSiErreur(await supabase.from('matieres').delete().eq('id', id))
}

/* ---------------------------------- Tarifs --------------------------------- */

export async function definirTarif(ecoleId, niveau, taux) {
  const user_id = await utilisateurId()
  const valeur = Number(taux) || 0
  leverSiErreur(
    await supabase
      .from('tarifs')
      .upsert({ user_id, ecole_id: Number(ecoleId), niveau, taux: valeur }, { onConflict: 'user_id,ecole_id,niveau' })
  )
}

export async function tauxPour(ecoleId, niveau) {
  const { data } = await supabase.from('tarifs').select('taux').eq('ecole_id', Number(ecoleId)).eq('niveau', niveau).maybeSingle()
  return data?.taux ?? 0
}

/* ---------------------------------- Séances -------------------------------- */

function normaliserSeance(s, taux) {
  return {
    matiereId: Number(s.matiereId),
    date: s.date,
    debut: s.debut,
    fin: s.fin,
    mode: s.mode || 'presentiel',
    lieu: s.mode === 'ligne' ? '' : s.lieu || '',
    lien: s.mode === 'ligne' ? s.lien || '' : '',
    statut: s.statut || 'planifie',
    notes: s.notes || '',
    // Taux figé à la création : modifier la grille plus tard ne réécrit pas le passé.
    tauxHoraire: Number(s.tauxHoraire ?? taux) || 0,
    serieId: s.serieId || null,
  }
}

/**
 * Crée une séance et, si demandé, ses occurrences hebdomadaires.
 * @returns {Promise<number[]>} les identifiants créés
 */
export async function creerSeance(saisie, { repetitions = 0, intervalleSemaines = 1 } = {}) {
  const { data: matiere } = await supabase.from('matieres').select('ecole_id, niveau').eq('id', Number(saisie.matiereId)).maybeSingle()
  if (!matiere) throw new Error('Matière introuvable')
  const taux = await tauxPour(matiere.ecole_id, matiere.niveau)
  const user_id = await utilisateurId()

  const serieId = repetitions > 0 ? `s${Date.now()}` : null
  const aCreer = []
  for (let i = 0; i <= repetitions; i++) {
    aCreer.push(
      versLigne({
        ...normaliserSeance(
          { ...saisie, date: i === 0 ? saisie.date : decalerSemaines(saisie.date, i * intervalleSemaines), serieId },
          taux
        ),
        user_id,
      })
    )
  }
  const data = leverSiErreur(await supabase.from('seances').insert(aCreer).select('id'))
  return data.map((r) => r.id)
}

/**
 * Copie une séance au même créneau : séance indépendante (hors série), au statut
 * « planifiée » et au taux actuel de la grille. L'appelant la déplace ensuite.
 * @returns {Promise<number>} identifiant de la copie
 */
export async function dupliquerSeance(s) {
  const { matiereId, date, debut, fin, mode, lieu, lien, notes } = s
  const [id] = await creerSeance({ matiereId, date, debut, fin, mode, lieu, lien, notes })
  return id
}

export async function majSeance(id, champs) {
  leverSiErreur(await supabase.from('seances').update(versLigne(nettoyer(champs))).eq('id', id))
}

export async function supprimerSeance(id) {
  leverSiErreur(await supabase.from('seances').delete().eq('id', id))
}

/** Supprime toutes les séances d'une série récurrente à partir d'une date. */
export async function supprimerSerie(serieId, aPartirDe = null) {
  let requete = supabase.from('seances').delete().eq('serie_id', serieId)
  if (aPartirDe) requete = requete.gte('date', aPartirDe)
  const data = leverSiErreur(await requete.select('id'))
  return data.length
}

export async function marquerFait(id) {
  leverSiErreur(await supabase.from('seances').update({ statut: 'fait' }).eq('id', id))
}

/** Déplacement depuis le calendrier (drag & drop / redimensionnement). */
export async function deplacerSeance(id, { date, debut, fin }) {
  leverSiErreur(await supabase.from('seances').update(versLigne(nettoyer({ date, debut, fin }))).eq('id', id))
}

/**
 * Duplique toutes les séances d'une semaine sur les N semaines suivantes.
 * @returns {Promise<number>} nombre de séances créées
 */
export async function dupliquerSemaine(debutSemaineISO, nbSemaines) {
  const fin = decalerSemaines(debutSemaineISO, 1)
  const source = versObjets(
    leverSiErreur(await supabase.from('seances').select('*').gte('date', debutSemaineISO).lt('date', fin))
  )
  const actives = source.filter((s) => s.statut !== 'annule')
  if (!actives.length) return 0

  const user_id = await utilisateurId()
  const serieId = `d${Date.now()}`
  const copies = []
  for (let i = 1; i <= nbSemaines; i++) {
    for (const s of actives) {
      copies.push(
        versLigne({
          matiereId: s.matiereId,
          date: decalerSemaines(s.date, i),
          debut: s.debut,
          fin: s.fin,
          mode: s.mode,
          lieu: s.lieu,
          lien: s.lien,
          statut: 'planifie',
          notes: s.notes,
          tauxHoraire: s.tauxHoraire,
          serieId,
          user_id,
        })
      )
    }
  }
  leverSiErreur(await supabase.from('seances').insert(copies))
  return copies.length
}

/** Passe en "effectuée" les séances planifiées déjà terminées (réglage autoFait). */
export async function synchroniserSeancesPassees() {
  const planifiees = versObjets(leverSiErreur(await supabase.from('seances').select('id, date, fin').eq('statut', 'planifie')))
  const aFaire = planifiees.filter((s) => estPasse(s.date, s.fin)).map((s) => s.id)
  if (aFaire.length) leverSiErreur(await supabase.from('seances').update({ statut: 'fait' }).in('id', aFaire))
  return aFaire.length
}

/* --------------------------------- Paiements -------------------------------- */

export async function basculerPaiement(ecoleId, mois, statut, montant) {
  const user_id = await utilisateurId()
  leverSiErreur(
    await supabase.from('paiements').upsert(
      {
        user_id,
        ecole_id: Number(ecoleId),
        mois,
        statut,
        montant: Number(montant) || 0,
        date_paiement: statut === 'paye' ? new Date().toISOString().slice(0, 10) : null,
      },
      { onConflict: 'user_id,ecole_id,mois' }
    )
  )
}

/* ---------------------------------- Divers ---------------------------------- */

export const heuresSeance = (s) => dureeHeures(s.debut, s.fin)
export const montantSeance = (s) => heuresSeance(s) * (s.tauxHoraire || 0)
