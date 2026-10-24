import { useState } from 'react'
import { creerSupport, supprimerSupport } from '../data/repo'
import { TYPES_SUPPORT, grouperSupports, normaliserUrl, urlValide } from '../lib/supports'
import { libelleRang } from '../lib/stats'
import { Saisie, Liste, useToast } from './ui'
import { IconePlus, IconePoubelle } from './icons'

/** Lien vers un support, ouvert dans un nouvel onglet. Seuls http(s) sont rendus cliquables. */
export const LienSupport = ({ support, children }) => (
  <a
    href={urlValide(support.url) ? normaliserUrl(support.url) : undefined}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex min-w-0 items-center gap-1.5 font-medium text-brand-700 underline-offset-2 hover:underline"
  >
    <span aria-hidden>{TYPES_SUPPORT[support.type]?.icone || '🔗'}</span>
    <span className="truncate">{support.titre}</span>
    {children}
  </a>
)

/** Bibliothèque d'une matière : liste groupée par séance et ajout d'un lien. */
export default function SupportsMatiere({ matiere, supports, nbSeances }) {
  const toast = useToast()
  const [ajout, setAjout] = useState(null) // { titre, url, rang }
  const groupes = grouperSupports(supports, matiere.id)
  const rangsPossibles = Math.max(nbSeances, ...groupes.map((g) => g.rang || 0), 1)

  async function enregistrer() {
    if (!urlValide(ajout.url)) return toast('Adresse invalide (http ou https)', 'erreur')
    await creerSupport({ matiereId: matiere.id, ...ajout })
    toast('Support ajouté')
    setAjout(null)
  }

  return (
    <div>
      <div className="mb-2 mt-5 flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-ink-700">Supports</h4>
        {!ajout && (
          <button className="btn-secondaire px-2.5 py-1.5 text-[12px]" onClick={() => setAjout({ titre: '', url: '', rang: '' })}>
            <IconePlus size={14} /> Ajouter un lien
          </button>
        )}
      </div>

      {ajout && (
        <div className="mb-3 space-y-2 rounded-xl bg-ink-50 p-3">
          <Saisie
            autoFocus
            value={ajout.url}
            onChange={(e) => setAjout({ ...ajout, url: e.target.value })}
            placeholder="Lien : Google Drive, Slides, GitHub, YouTube…"
            inputMode="url"
          />
          <div className="flex gap-2">
            <Saisie className="flex-1" value={ajout.titre} onChange={(e) => setAjout({ ...ajout, titre: e.target.value })} placeholder="Titre (facultatif)" />
            <Liste className="w-40" value={ajout.rang} onChange={(e) => setAjout({ ...ajout, rang: e.target.value })}>
              <option value="">Toute la matière</option>
              {Array.from({ length: rangsPossibles }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {libelleRang(i + 1)}
                </option>
              ))}
            </Liste>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondaire px-3 py-1.5 text-[12.5px]" onClick={() => setAjout(null)}>
              Annuler
            </button>
            <button className="btn-primaire px-3 py-1.5 text-[12.5px]" onClick={enregistrer} disabled={!ajout.url.trim()}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {groupes.length === 0 ? (
        !ajout && <p className="text-[13px] text-ink-400">Aucun support : ajoutez vos slides, énoncés de TP ou dépôts de code.</p>
      ) : (
        <div className="space-y-2.5">
          {groupes.map(({ rang, supports: liste }) => (
            <div key={rang ?? 'tous'}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{rang ? libelleRang(rang) : 'Toute la matière'}</p>
              <ul className="space-y-1">
                {liste.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[13px]">
                    <LienSupport support={s} />
                    <button
                      className="ml-auto shrink-0 rounded-md p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-600"
                      onClick={async () => {
                        await supprimerSupport(s.id)
                        toast('Support retiré')
                      }}
                      aria-label={`Retirer ${s.titre}`}
                    >
                      <IconePoubelle size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
