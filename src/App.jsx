import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoute } from './lib/router'
import { assurerReglages } from './data/supabase'
import { synchroniserSeancesPassees } from './data/repo'
import { useReferentiel, useSeances } from './data/queries'
import { planifierRappels, permissionNotifications } from './lib/notifications'
import { sessionActuelle, onChangementSession, fermerSession } from './lib/auth'
import { FournisseurToast } from './components/ui'
import LoginPage from './pages/LoginPage'
// Chaque écran est un chunk séparé : FullCalendar et Recharts ne sont
// téléchargés que lorsqu'on ouvre l'écran correspondant.
const CalendrierPage = lazy(() => import('./pages/CalendrierPage'))
const MatieresPage = lazy(() => import('./pages/MatieresPage'))
const RecapPage = lazy(() => import('./pages/RecapPage'))
const ReglagesPage = lazy(() => import('./pages/ReglagesPage'))
import { IconeCalendrier, IconeLivre, IconeGraphique, IconeReglages, IconeSortie } from './components/icons'

const ONGLETS = [
  { chemin: 'calendrier', label: 'Calendrier', Icone: IconeCalendrier },
  { chemin: 'matieres', label: 'Matières', Icone: IconeLivre },
  { chemin: 'recap', label: 'Récap', Icone: IconeGraphique },
  { chemin: 'reglages', label: 'Réglages', Icone: IconeReglages },
]

export default function App() {
  const { chemin, params, naviguer } = useRoute()
  const [pret, setPret] = useState(false)
  const [connecte, setConnecte] = useState(false)
  const auth = pret ? (connecte ? 'ok' : 'connexion') : 'chargement'
  const referentiel = useReferentiel()
  const seances = useSeances()

  // Session Supabase : présente dès le chargement si déjà connecté sur cet
  // appareil, puis tenue à jour à chaque connexion/déconnexion.
  useEffect(() => {
    let vivant = true
    sessionActuelle().then((session) => {
      if (!vivant) return
      setConnecte(!!session)
      setPret(true)
    })
    const desabonner = onChangementSession((session) => vivant && setConnecte(!!session))
    return () => {
      vivant = false
      desabonner()
    }
  }, [])

  // Réglages manquants (nouveaux réglages ajoutés depuis la dernière connexion).
  useEffect(() => {
    if (pret && auth === 'ok') assurerReglages()
  }, [pret, auth])

  useEffect(() => {
    if (pret && auth === 'ok' && referentiel.reglages?.autoFait) synchroniserSeancesPassees()
  }, [pret, auth, referentiel.reglages?.autoFait, seances.length])

  // Reprogrammation des rappels à chaque évolution de l'agenda.
  useEffect(() => {
    if (!pret || auth !== 'ok' || permissionNotifications() !== 'granted') return
    planifierRappels(seances, referentiel)
  }, [pret, auth, seances, referentiel.matieresById, referentiel.ecolesById, referentiel.reglages])

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

  if (!pret) return <Attente />
  if (auth !== 'ok') return <LoginPage onConnecte={() => setConnecte(true)} />

  return (
    <FournisseurToast>
      <div className="flex min-h-full flex-col">
        <main className={`mx-auto w-full flex-1 pb-[calc(5rem+var(--safe-bottom))] ${largeur}`}>
          <ProchainCours seances={seances} referentiel={referentiel} />
          <Suspense fallback={<Attente />}>
            <Page params={params} naviguer={naviguer} referentiel={referentiel} seances={seances} />
          </Suspense>
        </main>

        <button
          onClick={() => {
            fermerSession()
            setConnecte(false)
          }}
          className="fixed right-3 top-[calc(0.75rem+var(--safe-top))] z-40 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 shadow-card hover:bg-ink-50"
          aria-label="Se déconnecter"
        >
          <IconeSortie size={16} />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>

        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(0.75rem+var(--safe-bottom))]">
          <div className="flex w-full max-w-md gap-1 rounded-full bg-ink-900 p-1.5 shadow-pop">
            {ONGLETS.map(({ chemin: c, label, Icone }) => {
              const actif = chemin === c
              return (
                <button
                  key={c}
                  onClick={() => naviguer(c)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-semibold transition ${
                    actif ? 'bg-white text-ink-900' : 'text-ink-300 hover:text-white'
                  }`}
                  aria-current={actif ? 'page' : undefined}
                >
                  <Icone size={18} strokeWidth={actif ? 2.2 : 1.8} />
                  <span className={actif ? '' : 'hidden sm:inline'}>{label}</span>
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

function ProchainCours({ seances, referentiel }) {
  const [maintenant, setMaintenant] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  const debutMs = (x) => new Date(`${x.date}T${x.debut}:00`).getTime()
  const prochaine = seances
    .filter((x) => x.statut === 'planifie' && debutMs(x) > maintenant)
    .sort((a, b) => debutMs(a) - debutMs(b))[0]
  if (!prochaine) return null
  const matiere = referentiel.matieresById.get(prochaine.matiereId)
  const ecole = matiere && referentiel.ecolesById.get(matiere.ecoleId)
  const minutes = Math.round((debutMs(prochaine) - maintenant) / 60000)
  const delai =
    minutes < 60 ? `dans ${minutes} min` : minutes < 1440 ? `dans ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `dans ${Math.floor(minutes / 1440)} j`
  return (
    <div className="mx-4 mt-[calc(0.75rem+var(--safe-top))] flex items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white">
      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: ecole?.couleur || '#e2456f' }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{matiere?.nom || 'Séance'}</p>
        <p className="truncate text-[12px] text-ink-300">
          {ecole?.code} · {prochaine.debut}–{prochaine.fin}
          {prochaine.lieu ? ` · ${prochaine.lieu}` : ''}
        </p>
      </div>
      <span className="font-display text-[15px] font-bold tabular">{delai}</span>
    </div>
  )
}
