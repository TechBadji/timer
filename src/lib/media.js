import { useEffect, useState } from 'react'

/** Suit une media query CSS depuis React (mise à jour au redimensionnement). */
export function useMediaQuery(requete) {
  const [correspond, setCorrespond] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(requete).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(requete)
    const surChangement = (e) => setCorrespond(e.matches)
    setCorrespond(mq.matches)
    mq.addEventListener('change', surChangement)
    return () => mq.removeEventListener('change', surChangement)
  }, [requete])
  return correspond
}

/** Vrai à partir de la largeur « ordinateur » (breakpoint lg de Tailwind). */
export const useGrandEcran = () => useMediaQuery('(min-width: 1024px)')
