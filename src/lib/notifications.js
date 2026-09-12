// Rappels locaux avant chaque cours. 100 % hors-ligne : de simples minuteurs
// dans l'onglet + l'API Notification (via le Service Worker si disponible).
import { dateHeure } from './dates'

// '/' en développement, '/timer/' une fois déployé sur GitHub Pages.
const BASE = import.meta.env.BASE_URL

let minuteurs = []
const FENETRE_MS = 24 * 60 * 60 * 1000 // on ne programme que les prochaines 24 h
const MAX_MINUTEURS = 50

export const notificationsSupportees = () => typeof window !== 'undefined' && 'Notification' in window

export const permissionNotifications = () => (notificationsSupportees() ? Notification.permission : 'unsupported')

export async function demanderPermission() {
  if (!notificationsSupportees()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

async function afficher(titre, options) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.showNotification) return reg.showNotification(titre, options)
  } catch {
    /* le Service Worker n'est pas encore prêt : on retombe sur l'API directe */
  }
  new Notification(titre, options)
}

function annulerTout() {
  minuteurs.forEach(clearTimeout)
  minuteurs = []
}

/**
 * (Re)programme les rappels des prochaines 24 heures.
 * @returns {number} nombre de rappels programmés
 */
export function planifierRappels(seances, { matieresById, ecolesById, reglages }) {
  annulerTout()
  if (permissionNotifications() !== 'granted') return 0

  const delai = (Number(reglages?.rappelMinutes) || 30) * 60 * 1000
  const maintenant = Date.now()

  const candidates = seances
    .filter((s) => s.statut === 'planifie')
    .map((s) => ({ s, debutMs: dateHeure(s.date, s.debut).getTime() }))
    .filter(({ debutMs }) => debutMs - delai > maintenant && debutMs - maintenant < FENETRE_MS)
    .sort((a, b) => a.debutMs - b.debutMs)
    .slice(0, MAX_MINUTEURS)

  for (const { s, debutMs } of candidates) {
    const matiere = matieresById.get(s.matiereId)
    const ecole = ecolesById.get(matiere?.ecoleId)
    const lieu = s.mode === 'ligne' ? 'En ligne' : s.lieu || 'Présentiel'
    const id = setTimeout(() => {
      afficher(`${matiere?.nom || 'Cours'} — ${ecole?.code || ''}`, {
        body: `${s.debut} → ${s.fin} · ${lieu}`,
        tag: `seance-${s.id}`,
        icon: `${BASE}icon-192.png`,
        badge: `${BASE}icon-192.png`,
        data: { url: `${BASE}#/calendrier?date=${s.date}` },
        requireInteraction: false,
      })
    }, debutMs - delai - maintenant)
    minuteurs.push(id)
  }
  return candidates.length
}

export async function notificationTest() {
  const p = await demanderPermission()
  if (p !== 'granted') return false
  await afficher('Timer — rappel de test', {
    body: 'Les rappels de cours sont bien activés sur cet appareil.',
    icon: `${BASE}icon-192.png`,
    tag: 'test',
  })
  return true
}
