import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoute } from './lib/router'
import { assurerReglages } from './data/db'
import { synchroniserSeancesPassees } from './data/repo'
import { useReferentiel, useSeances } from './data/queries'
import { planifierRappels, permissionNotifications } from './lib/notifications'
import { FournisseurToast } from './components/ui'
// Chaque écran est un chunk séparé : FullCalendar et Recharts ne sont
// téléchargés que lorsqu'on ouvre l'écran correspondant.
const CalendrierPage = lazy(() => import('./pages/CalendrierPage'))
const MatieresPage = lazy(() => import('./pages/MatieresPage'))
const RecapPage = lazy(() => import('./pages/RecapPage'))
const ReglagesPage = lazy(() => import('./pages/ReglagesPage'))
import { IconeCalendrier, IconeLivre, IconeGraphique, IconeReglages } from './components/icons'

const ONGLETS = [
  { chemin: 'calendrier', label: 'Calendrier', Icone: IconeCalendrier },
  { chemin: 'matieres', label: 'Matières', Icone: IconeLivre },
  { chemin: 'recap', label: 'Récap', Icone: IconeGraphique },
  { chemin: 'reglages', label: 'Réglages', Icone: IconeReglages },
]

export default function App() {
  const { chemin, params, naviguer } = useRoute()
  const [pret, setPret] = useState(false)
  const referentiel = useReferentiel()
  const seances = useSeances()

  // Amorçage : réglages manquants + séances passées basculées en "effectuée".
  useEffect(() => {
    let vivant = true
    ;(async () => {
      await assurerReglages()
      if (vivant) setPret(true)
    })()
    return () => {
      vivant = false
    }
  }, [])

  useEffect(() => {
    if (pret && referentiel.reglages?.autoFait) synchroniserSeancesPassees()
  }, [pret, referentiel.reglages?.autoFait, seances.length])

  // Reprogrammation des rappels à chaque évolution de l'agenda.
  useEffect(() => {
    if (!pret || permissionNotifications() !== 'granted') return
    planifierRappels(seances, referentiel)
  }, [pret, seances, referentiel.matieresById, referentiel.ecolesById, referentiel.reglages])

  // Un clic sur une notification ramène sur le jour concerné.
  useEffect(() => {
    const surMessage = (e) => {
      if (e.data?.type === 'NAVIGUER' && e.data.url) window.location.hash = e.data.url.split('#')[1] || '#/calendrier'
    }
    navigator.serviceWorker?.addEventListener('message', surMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', surMessage)
  }, [])

  const Page =
    { calendrier: CalendrierPage, matieres: MatieresPage, recap: RecapPage, reglages: ReglagesPage }[chemin] ||
    CalendrierPage

  // Le calendrier occupe toute la largeur disponible ; les autres écrans gardent
  // une colonne de lecture confortable.
  const largeur = chemin === 'calendrier' ? 'max-w-[1700px]' : 'max-w-3xl'

  return (
    <FournisseurToast>
      <div className="flex min-h-full flex-col">
        <main className={`mx-auto w-full flex-1 pb-[calc(5rem+var(--safe-bottom))] ${largeur}`}>
          {pret ? (
            <Suspense fallback={<Attente />}>
              <Page params={params} naviguer={naviguer} referentiel={referentiel} seances={seances} />
            </Suspense>
          ) : (
            <Attente />
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200/70 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl pb-[var(--safe-bottom)]">
            {ONGLETS.map(({ chemin: c, label, Icone }) => {
              const actif = chemin === c
              return (
                <button
                  key={c}
                  onClick={() => naviguer(c)}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                    actif ? 'text-brand-600' : 'text-ink-400'
                  }`}
                  aria-current={actif ? 'page' : undefined}
                >
                  <Icone size={22} strokeWidth={actif ? 2.1 : 1.7} />
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </FournisseurToast>
  )
}

const Attente = () => (
  <div className="flex h-[60vh] items-center justify-center text-[13px] text-ink-400">Chargement…</div>
)
