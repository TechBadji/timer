import { useState } from 'react'
import { majSeance } from '../data/repo'
import { ecrireReglage } from '../data/supabase'
import { clePaire } from '../lib/conflicts'
import { libelleClasses } from '../lib/classes'
import { aujourdhui, jourLabel } from '../lib/dates'
import { Modale, Segments, Puce, Vide, useToast } from './ui'
import { IconeCheck } from './icons'

/** Liste des conflits d'agenda, avec de quoi trancher chacun d'eux. */
export default function Conflits({ ouvert, onFermer, paires, plage, referentiel, onDeplacer }) {
  const { matieresById, ecolesById, reglages } = referentiel
  const toast = useToast()
  const [portee, setPortee] = useState('plage')
  const toleres = reglages.conflitsIgnores || []

  const visibles = paires.filter(({ a }) =>
    portee === 'plage' ? a.date >= plage.debut && a.date <= plage.fin : a.date >= aujourdhui()
  )

  async function garder(gagnante, perdante) {
    await majSeance(perdante.id, { statut: 'annule' })
    toast(`« ${matieresById.get(perdante.matiereId)?.nom || 'Cours'} » annulé (${perdante.debut}–${perdante.fin})`, 'info')
  }

  async function tolerer(p) {
    await ecrireReglage('conflitsIgnores', [...toleres, clePaire(p.a, p.b)])
    toast('Conflit toléré', 'info')
  }

  async function reafficher() {
    await ecrireReglage('conflitsIgnores', [])
    toast('Conflits tolérés réaffichés', 'info')
  }

  const Cours = ({ s, autre }) => {
    const m = matieresById.get(s.matiereId)
    const e = ecolesById.get(m?.ecoleId)
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 p-2.5">
        <div className="w-1 self-stretch rounded-full" style={{ background: e?.couleur || '#64748b' }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink-900">{m?.nom || 'Cours'}</p>
          <p className="truncate text-[12px] tabular text-ink-500">
            {[e?.code, libelleClasses(m), `${s.debut}–${s.fin}`, s.mode === 'ligne' ? 'en ligne' : s.lieu || 'présentiel']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button className="btn-secondaire px-2.5 py-1.5 text-[12.5px]" onClick={() => onDeplacer(s)}>
          Déplacer
        </button>
        <button className="btn-primaire px-2.5 py-1.5 text-[12.5px]" onClick={() => garder(s, autre)} title="Annule l'autre cours">
          Garder
        </button>
      </div>
    )
  }

  return (
    <Modale
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Conflits d'agenda"
      sousTitre="« Garder » annule l'autre cours · « Déplacer » ouvre sa fiche"
    >
      <Segments
        className="mb-4"
        valeur={portee}
        onChange={setPortee}
        options={[
          { valeur: 'plage', label: 'Période affichée' },
          { valeur: 'avenir', label: 'Tous à venir' },
        ]}
      />

      {visibles.length === 0 ? (
        <Vide icone={<IconeCheck size={26} />} titre="Aucun conflit" texte="Rien à arbitrer sur cette période." />
      ) : (
        <ul className="space-y-3">
          {visibles.map((p) => (
            <li key={clePaire(p.a, p.b)} className="rounded-2xl border border-ink-200 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Puce className={p.gravite === 'erreur' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}>{p.label}</Puce>
                <span className="text-[12.5px] font-semibold capitalize text-ink-700">{jourLabel(p.a.date, 'EEE d MMM')}</span>
                <span className="text-[12px] text-ink-500">{p.detail}</span>
              </div>
              <div className="space-y-1.5">
                <Cours s={p.a} autre={p.b} />
                <Cours s={p.b} autre={p.a} />
              </div>
              {p.type === 'trajet' && (
                <button className="mt-2 text-[12.5px] font-semibold text-brand-700 hover:underline" onClick={() => tolerer(p)}>
                  Garder les deux (tolérer ce trajet)
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {toleres.length > 0 && (
        <button className="mt-4 text-[12.5px] font-semibold text-ink-500 hover:underline" onClick={reafficher}>
          Réafficher les conflits tolérés
        </button>
      )}
    </Modale>
  )
}
