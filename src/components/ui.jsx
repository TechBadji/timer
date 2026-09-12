import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { IconeCheck, IconeFermer, IconeAlerte } from './icons'

/* --------------------------------- Modale --------------------------------- */
/** Feuille glissante en bas sur mobile, dialogue centré sur grand écran. */
export function Modale({ ouvert, onFermer, titre, sousTitre, children, pied, largeur = 'max-w-lg' }) {
  useEffect(() => {
    if (!ouvert) return
    const surEchap = (e) => e.key === 'Escape' && onFermer()
    document.addEventListener('keydown', surEchap)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', surEchap)
      document.body.style.overflow = overflow
    }
  }, [ouvert, onFermer])

  if (!ouvert) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titre}>
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]" onClick={onFermer} />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full ${largeur} animate-slide-up flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl`}
      >
        <header className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold text-ink-900">{titre}</h2>
            {sousTitre && <p className="mt-0.5 truncate text-[13px] text-ink-500">{sousTitre}</p>}
          </div>
          <button onClick={onFermer} className="-mr-1 rounded-lg p-2 text-ink-400 hover:bg-ink-100" aria-label="Fermer">
            <IconeFermer />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pied && <footer className="border-t border-ink-100 px-5 py-3.5 pb-[calc(0.875rem+var(--safe-bottom))]">{pied}</footer>}
      </div>
    </div>
  )
}

/* ------------------------------- Formulaires ------------------------------- */
export const Champ = ({ label, aide, erreur, children, className = '' }) => (
  <label className={`block ${className}`}>
    {label && <span className="etiquette">{label}</span>}
    {children}
    {erreur ? (
      <span className="mt-1 block text-[12px] font-medium text-rose-600">{erreur}</span>
    ) : (
      aide && <span className="mt-1 block text-[12px] text-ink-400">{aide}</span>
    )}
  </label>
)

export const Saisie = (props) => <input {...props} className={`champ ${props.className || ''}`} />
export const Zone = (props) => <textarea {...props} className={`champ ${props.className || ''}`} />
export const Liste = (props) => <select {...props} className={`champ champ-liste ${props.className || ''}`} />

/** Sélecteur segmenté (2 à 4 options). */
export const Segments = ({ valeur, onChange, options, className = '' }) => (
  <div className={`segment ${className}`}>
    {options.map((o) => (
      <button key={o.valeur} type="button" data-actif={valeur === o.valeur} onClick={() => onChange(o.valeur)}>
        {o.label}
      </button>
    ))}
  </div>
)

/* --------------------------------- Affichage -------------------------------- */
export const Puce = ({ couleur, children, className = '' }) => (
  <span className={`puce ${className}`} style={couleur ? { backgroundColor: `${couleur}1a`, color: couleur } : undefined}>
    {children}
  </span>
)

export const Pastille = ({ couleur, taille = 8 }) => (
  <span className="inline-block shrink-0 rounded-full" style={{ background: couleur, width: taille, height: taille }} />
)

export function Progression({ valeur, projete = 0, couleur = '#4f46e5', hauteur = 8 }) {
  const p = Math.max(0, Math.min(100, valeur))
  const pp = Math.max(0, Math.min(100, projete))
  const depasse = valeur > 100
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-ink-100" style={{ height: hauteur }}>
      {pp > p && <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: `${pp}%`, background: couleur }} />}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
        style={{ width: `${p}%`, background: depasse ? '#e11d48' : couleur }}
      />
    </div>
  )
}

export const Vide = ({ icone, titre, texte, action }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center">
    {icone && <div className="mb-3 rounded-2xl bg-ink-100 p-3 text-ink-400">{icone}</div>}
    <p className="text-[15px] font-semibold text-ink-700">{titre}</p>
    {texte && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-500">{texte}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export const Statistique = ({ label, valeur, detail, accent = 'text-ink-900' }) => (
  <div className="carte px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
    <p className={`mt-1 text-[19px] font-bold tabular leading-tight ${accent}`}>{valeur}</p>
    {detail && <p className="mt-0.5 text-[12px] text-ink-500">{detail}</p>}
  </div>
)

export const Bandeau = ({ ton = 'alerte', titre, children }) => {
  const tons = {
    erreur: 'border-rose-200 bg-rose-50 text-rose-800',
    alerte: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    succes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] ${tons[ton]}`}>
      <IconeAlerte size={18} className="mt-px shrink-0" />
      <div className="min-w-0">
        {titre && <p className="font-semibold">{titre}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

/* --------------------------------- Toasts ---------------------------------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function FournisseurToast({ children }) {
  const [messages, setMessages] = useState([])
  const toast = useCallback((texte, ton = 'succes') => {
    const id = Math.random().toString(36).slice(2)
    setMessages((m) => [...m, { id, texte, ton }])
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 3200)
  }, [])
  const valeur = useMemo(() => toast, [toast])
  return (
    <ToastCtx.Provider value={valeur}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+var(--safe-bottom))] z-[60] flex flex-col items-center gap-2 px-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`animate-slide-up flex max-w-sm items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-pop ${
              m.ton === 'erreur' ? 'bg-rose-600' : m.ton === 'info' ? 'bg-ink-800' : 'bg-emerald-600'
            }`}
          >
            {m.ton === 'succes' && <IconeCheck size={16} />}
            {m.texte}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ------------------------------- Confirmation ------------------------------- */
export function Confirmation({ etat, onFermer }) {
  if (!etat) return null
  return (
    <Modale
      ouvert
      onFermer={onFermer}
      titre={etat.titre}
      largeur="max-w-sm"
      pied={
        <div className="flex gap-2">
          <button className="btn-secondaire flex-1" onClick={onFermer}>
            Annuler
          </button>
          <button
            className={`${etat.danger ? 'btn bg-rose-600 text-white hover:bg-rose-700' : 'btn-primaire'} flex-1`}
            onClick={() => {
              etat.onConfirmer()
              onFermer()
            }}
          >
            {etat.confirmer || 'Confirmer'}
          </button>
        </div>
      }
    >
      <p className="text-[14px] leading-relaxed text-ink-600">{etat.texte}</p>
    </Modale>
  )
}
