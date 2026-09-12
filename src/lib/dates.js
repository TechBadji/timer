// Toutes les dates sont manipulées en heure locale (Dakar, GMT+0) sous forme
// de chaînes 'YYYY-MM-DD' et 'HH:mm' : aucun décalage de fuseau possible.
import { format, parse, startOfWeek, endOfWeek, addDays, addWeeks, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'

export const OPTS = { locale: fr, weekStartsOn: 1 }

export const toISO = (d) => format(d, 'yyyy-MM-dd')
export const fromISO = (s) => parse(s, 'yyyy-MM-dd', new Date())
export const aujourdhui = () => toISO(new Date())

/** '08:30' → 510 minutes */
export const enMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 510 → '08:30' */
export const enHeure = (minutes) => {
  const m = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Durée d'un créneau, en heures décimales (1h30 → 1.5) */
export const dureeHeures = (debut, fin) => Math.max(0, (enMinutes(fin) - enMinutes(debut)) / 60)

/** 2.5 → '2h30' */
export const formatDuree = (heures) => {
  const total = Math.round(heures * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m}min`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export const moisDe = (isoDate) => String(isoDate).slice(0, 7)
export const moisCourant = () => moisDe(aujourdhui())

export const moisLabel = (mois) => {
  const d = parse(mois + '-01', 'yyyy-MM-dd', new Date())
  return format(d, 'MMMM yyyy', OPTS)
}
export const moisLabelCourt = (mois) => {
  const d = parse(mois + '-01', 'yyyy-MM-dd', new Date())
  return format(d, 'MMM yy', OPTS)
}

export const moisPrecedent = (mois) => {
  const [a, m] = mois.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}
export const moisSuivant = (mois) => {
  const [a, m] = mois.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}

export const bornesMois = (mois) => {
  const d = parse(mois + '-01', 'yyyy-MM-dd', new Date())
  return { debut: toISO(startOfMonth(d)), fin: toISO(endOfMonth(d)) }
}

export const bornesSemaine = (date) => {
  const d = typeof date === 'string' ? fromISO(date) : date
  return { debut: toISO(startOfWeek(d, OPTS)), fin: toISO(endOfWeek(d, OPTS)) }
}

export const jourLabel = (isoDate, motif = 'EEEE d MMMM') => format(fromISO(isoDate), motif, OPTS)
export const jourCourt = (isoDate) => format(fromISO(isoDate), 'EEE d MMM', OPTS)

export const decalerJours = (isoDate, n) => toISO(addDays(fromISO(isoDate), n))
export const decalerSemaines = (isoDate, n) => toISO(addWeeks(fromISO(isoDate), n))

export const estPasse = (isoDate, fin) => {
  const maintenant = new Date()
  const d = fromISO(isoDate)
  if (!isSameDay(d, maintenant)) return d < maintenant
  return enMinutes(fin) <= maintenant.getHours() * 60 + maintenant.getMinutes()
}

/** Date JS locale à partir de 'YYYY-MM-DD' + 'HH:mm' */
export const dateHeure = (isoDate, hhmm) => {
  const [a, m, j] = isoDate.split('-').map(Number)
  const [h, mn] = String(hhmm).split(':').map(Number)
  return new Date(a, m - 1, j, h || 0, mn || 0, 0, 0)
}

export { addDays, addWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format }
