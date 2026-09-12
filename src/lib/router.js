// Micro-routeur par hash : suffisant pour 4 écrans, et compatible PWA hors-ligne.
import { useCallback, useEffect, useState } from 'react'

const lire = () => {
  const brut = window.location.hash.replace(/^#\/?/, '')
  const [chemin, requete] = brut.split('?')
  return { chemin: chemin || 'calendrier', params: new URLSearchParams(requete || '') }
}

export function useRoute() {
  const [route, setRoute] = useState(lire)

  useEffect(() => {
    const surChangement = () => setRoute(lire())
    window.addEventListener('hashchange', surChangement)
    if (!window.location.hash) window.location.hash = '#/calendrier'
    return () => window.removeEventListener('hashchange', surChangement)
  }, [])

  const naviguer = useCallback((chemin, params) => {
    const q = params ? `?${new URLSearchParams(params)}` : ''
    window.location.hash = `#/${chemin}${q}`
  }, [])

  return { ...route, naviguer }
}
