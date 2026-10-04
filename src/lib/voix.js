// Saisie vocale d'une séance : reconnaissance native du navigateur (Web Speech API)
// puis analyse de la phrase dictée ("Réseaux ISM Ingénierie lundi de 8h à 12h salle B2").
import { addDays } from 'date-fns'
import { toISO, enMinutes, enHeure } from './dates'

const SANS_ACCENT = { à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', î: 'i', ï: 'i', ô: 'o', ö: 'o', ù: 'u', û: 'u', ü: 'u', ç: 'c', œ: 'o', '’': "'" }
// Remplacement caractère par caractère : les indices restent alignés avec le texte d'origine.
const norm = (t) => t.toLowerCase().replace(/[àâäéèêëîïôöùûüçœ’]/g, (c) => SANS_ACCENT[c])

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']

export const reconnaissanceDisponible = () =>
  typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

/** Lance une écoute unique ; résout avec le texte dicté. */
export function ecouter() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  return new Promise((resolve, reject) => {
    const r = new SR()
    r.lang = 'fr-FR'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => resolve(e.results[0][0].transcript)
    r.onerror = (e) => reject(new Error(e.error === 'not-allowed' ? 'Accès au micro refusé' : e.error === 'no-speech' ? 'Aucune voix détectée' : 'Reconnaissance vocale indisponible'))
    r.onnomatch = () => reject(new Error('Phrase non comprise'))
    r.start()
  })
}

function extraireDate(n, ref) {
  if (/apres[- ]?demain/.test(n)) return toISO(addDays(ref, 2))
  if (/\bdemain\b/.test(n)) return toISO(addDays(ref, 1))
  if (/aujourd'?hui|\bce jour\b/.test(n)) return toISO(ref)
  const jour = JOURS.findIndex((j) => new RegExp(`\\b${j}\\b`).test(n))
  if (jour >= 0) {
    const delta = (jour - ref.getDay() + 7) % 7
    return toISO(addDays(ref, delta))
  }
  const num = n.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/)
  if (num) {
    const an = num[3] ? (num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3])) : ref.getFullYear()
    return toISO(new Date(an, Number(num[2]) - 1, Number(num[1])))
  }
  const lit = n.match(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MOIS.join('|')})\\b`))
  if (lit) {
    const d = new Date(ref.getFullYear(), MOIS.indexOf(lit[2]), Number(lit[1]))
    if (d < addDays(ref, -1)) d.setFullYear(d.getFullYear() + 1)
    return toISO(d)
  }
  return null
}

const RE_HEURE = /\b(\d{1,2})\s*(?:heures?|h|:)\s*(\d{2}|et demie?|et quart|moins le quart)?/g
function extraireHeures(n) {
  const heures = []
  for (const m of n.matchAll(RE_HEURE)) {
    let h = Number(m[1])
    let min = 0
    if (m[2]) {
      if (/^\d/.test(m[2])) min = Number(m[2])
      else if (m[2].startsWith('et demi')) min = 30
      else if (m[2] === 'et quart') min = 15
      else if (m[2] === 'moins le quart') {
        h -= 1
        min = 45
      }
    }
    if (h < 24 && min < 60) heures.push(enHeure(h * 60 + min))
  }
  return heures
}

const contientMot = (n, mot) => new RegExp(`(^|[^a-z0-9])${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(n)

function extraireMatiere(n, matieres, ecoles) {
  const ecoleDe = new Map(ecoles.map((e) => [e.id, e]))
  let meilleur = null
  for (const m of matieres) {
    const nom = norm(m.nom)
    if (!n.includes(nom)) continue
    const e = ecoleDe.get(m.ecoleId)
    let score = nom.length
    if (e && (n.includes(norm(e.code)) || n.includes(norm(e.nom)))) score += 100
    if (m.niveau && n.includes(norm(m.niveau))) score += 50
    // Départage deux matières homonymes d'une même école par la classe dictée (« … GLRS … »).
    for (const c of m.classes || []) if (contientMot(n, norm(c))) score += 40
    if (!meilleur || score > meilleur.score) meilleur = { m, score }
  }
  return meilleur?.m || null
}

/**
 * Transforme la phrase dictée en champs de séance.
 * Retourne { champs, comprises } — `comprises` liste ce qui a été reconnu (pour le retour à l'utilisateur).
 */
export function analyserSeance(phrase, { matieres, ecoles, reference = new Date() }) {
  // Tout ce qui suit « note » est du texte libre : on ne l'analyse pas.
  const note = phrase.match(/\bnotes?\b\s*:?\s*(.+)$/i)
  const texte = note ? phrase.slice(0, note.index) : phrase
  const n = norm(texte)
  const champs = {}
  const comprises = []

  const matiere = extraireMatiere(n, matieres, ecoles)
  if (matiere) {
    champs.matiereId = matiere.id
    comprises.push(matiere.nom)
  }

  const date = extraireDate(n, reference)
  if (date) {
    champs.date = date
    comprises.push(date)
  }

  const heures = extraireHeures(n)
  if (heures.length) {
    champs.debut = heures[0]
    const duree = n.match(/(?:pendant|durant|pour)\s+(\d{1,2})\s*(?:h|heures?)(?:\s*(\d{2}))?/)
    if (heures.length >= 2 && enMinutes(heures[1]) > enMinutes(heures[0])) champs.fin = heures[1]
    else if (duree) champs.fin = enHeure(enMinutes(heures[0]) + Number(duree[1]) * 60 + Number(duree[2] || 0))
    comprises.push(champs.fin ? `${champs.debut}–${champs.fin}` : champs.debut)
  }

  if (/\ben ligne\b|visio|distanciel|a distance/.test(n)) {
    champs.mode = 'ligne'
    comprises.push('en ligne')
  } else {
    const salle = texte.match(/salle\s+([\p{L}\d-]+)/iu)
    if (salle) {
      champs.mode = 'presentiel'
      champs.lieu = `Salle ${salle[1].toUpperCase()}`
      comprises.push(champs.lieu)
    }
  }

  if (note) {
    champs.notes = note[1].trim()
    comprises.push('note')
  }

  return { champs, comprises }
}
