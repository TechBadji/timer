// Export iCalendar (.ics) des séances, importable dans Google Agenda ou Calendrier (iOS/macOS).
import { libelleClasses } from './classes'
import { estEvaluation, typeSeance } from './evaluations'

/** Échappement RFC 5545 des valeurs texte. */
const echapper = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Repli des lignes à 75 octets (continuation par une espace). */
function plier(ligne) {
  const octets = new TextEncoder().encode(ligne)
  if (octets.length <= 75) return ligne
  const morceaux = []
  let courant = ''
  let taille = 0
  for (const car of ligne) {
    const n = new TextEncoder().encode(car).length
    if (taille + n > (morceaux.length ? 74 : 75)) {
      morceaux.push(courant)
      courant = ''
      taille = 0
    }
    courant += car
    taille += n
  }
  morceaux.push(courant)
  return morceaux.join('\r\n ')
}

// Heure « flottante » (sans fuseau) : interprétée dans le fuseau de l'appareil, Dakar en pratique.
const dateHeureIcs = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`
const horodatage = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

/**
 * Construit le calendrier. Les UID sont stables : réimporter le fichier met à jour
 * les événements existants au lieu de les dupliquer, et une séance annulée est retirée.
 */
export function construireIcs(seances, { matieresById, ecolesById, rappelMinutes = 30, nomCalendrier = 'Timer — cours' }) {
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Timer//Emploi du temps//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${echapper(nomCalendrier)}`]
  const stamp = horodatage()
  for (const s of seances) {
    const m = matieresById.get(s.matiereId)
    const e = ecolesById.get(m?.ecoleId)
    const prefixe = estEvaluation(s) ? `[${typeSeance(s.typeSeance).label}] ` : ''
    const description = [
      [e?.nom, m?.niveau, libelleClasses(m)].filter(Boolean).join(' · '),
      s.contenuPrevu && `Prévu : ${s.contenuPrevu}`,
      s.mode === 'ligne' && s.lien && `Lien : ${s.lien}`,
      s.notes,
    ].filter(Boolean)
    lignes.push(
      'BEGIN:VEVENT',
      `UID:seance-${s.id}@timer`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dateHeureIcs(s.date, s.debut)}`,
      `DTEND:${dateHeureIcs(s.date, s.fin)}`,
      `SUMMARY:${echapper(`${prefixe}${m?.nom || 'Cours'} — ${e?.code || ''}`.trim())}`,
      `LOCATION:${echapper(s.mode === 'ligne' ? s.lien || 'En ligne' : s.lieu || e?.nom || '')}`,
      `DESCRIPTION:${echapper(description.join('\n'))}`,
      `STATUS:${s.statut === 'annule' ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${echapper(m?.nom || 'Cours')}`,
      `TRIGGER:-PT${Number(rappelMinutes) || 30}M`,
      'END:VALARM',
      'END:VEVENT'
    )
  }
  lignes.push('END:VCALENDAR')
  return lignes.map(plier).join('\r\n') + '\r\n'
}
