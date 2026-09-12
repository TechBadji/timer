import { useMemo, useState } from 'react'
import { progression } from '../lib/stats'
import { formatDuree } from '../lib/dates'
import { fcfa } from '../lib/money'
import { changerStatutMatiere, supprimerMatiere } from '../data/repo'
import { Vide, Puce, Progression, useToast, Confirmation, Modale, Bandeau } from '../components/ui'
import { IconePlus, IconeLivre, IconeCrayon, IconePoubelle, IconeArchive, IconeCheck } from '../components/icons'
import MatiereForm from '../components/MatiereForm'

export default function MatieresPage({ referentiel, seances }) {
  const { ecoles, matieres, ecolesById, tauxParCle, reglages } = referentiel
  const toast = useToast()
  const [onglet, setOnglet] = useState('en_cours')
  const [filtreEcole, setFiltreEcole] = useState('')
  const [form, setForm] = useState(null) // { matiere? }
  const [confirmation, setConfirmation] = useState(null)
  const [detail, setDetail] = useState(null)

  const enrichies = useMemo(
    () =>
      matieres
        .map((m) => ({
          ...m,
          avancement: progression(m, seances, reglages.seuilAlerteQuota),
          ecole: ecolesById.get(m.ecoleId),
          taux: tauxParCle.get(`${m.ecoleId}|${m.niveau}`) ?? 0,
        }))
        .sort((a, b) => (a.ecole?.ordre ?? 99) - (b.ecole?.ordre ?? 99) || a.nom.localeCompare(b.nom)),
    [matieres, seances, ecolesById, tauxParCle, reglages.seuilAlerteQuota]
  )

  const visibles = enrichies.filter(
    (m) => m.statut === onglet && (!filtreEcole || m.ecoleId === Number(filtreEcole))
  )

  const totaux = useMemo(() => {
    const enCours = enrichies.filter((m) => m.statut === 'en_cours')
    return {
      quota: enCours.reduce((t, m) => t + m.avancement.quota, 0),
      faites: enCours.reduce((t, m) => t + m.avancement.faites, 0),
      restantes: enCours.reduce((t, m) => t + Math.max(0, m.avancement.restantes), 0),
      alertes: enCours.filter((m) => m.avancement.alerte && m.avancement.alerte.niveau !== 'info').length,
    }
  }, [enrichies])

  const nbTerminees = enrichies.filter((m) => m.statut === 'terminee').length

  return (
    <div className="px-4 pt-[calc(1rem+var(--safe-top))]">
      <h1 className="text-[22px] font-bold leading-tight text-ink-900">Matières</h1>
      <p className="mb-4 text-[12.5px] text-ink-500">
        {formatDuree(totaux.faites)} réalisées sur {formatDuree(totaux.quota)} · {formatDuree(totaux.restantes)} restantes
      </p>

      {totaux.alertes > 0 && onglet === 'en_cours' && (
        <div className="mb-3">
          <Bandeau ton="alerte">
            {totaux.alertes} matière{totaux.alertes > 1 ? 's' : ''} en dépassement ou proche du quota.
          </Bandeau>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <div className="segment flex-1">
          <button data-actif={onglet === 'en_cours'} onClick={() => setOnglet('en_cours')}>
            En cours
          </button>
          <button data-actif={onglet === 'terminee'} onClick={() => setOnglet('terminee')}>
            Terminées {nbTerminees ? `(${nbTerminees})` : ''}
          </button>
        </div>
      </div>

      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Filtre actif={!filtreEcole} onClick={() => setFiltreEcole('')} label="Toutes" />
        {ecoles.map((e) => (
          <Filtre
            key={e.id}
            actif={filtreEcole === String(e.id)}
            onClick={() => setFiltreEcole(String(e.id))}
            label={e.code}
            couleur={e.couleur}
          />
        ))}
      </div>

      {visibles.length === 0 ? (
        <Vide
          icone={<IconeLivre size={26} />}
          titre={onglet === 'en_cours' ? 'Aucune matière en cours' : 'Aucune matière terminée'}
          texte={
            onglet === 'en_cours'
              ? "Créez une matière avec son volume horaire : l'avancement se décomptera automatiquement à chaque séance effectuée."
              : 'Les matières que vous archivez apparaîtront ici avec leur bilan.'
          }
          action={
            onglet === 'en_cours' && (
              <button className="btn-primaire" onClick={() => setForm({})}>
                <IconePlus size={18} /> Nouvelle matière
              </button>
            )
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((m) => (
            <CarteMatiere
              key={m.id}
              m={m}
              onEditer={() => setForm({ matiere: m })}
              onDetail={() => setDetail(m)}
              onArchiver={() =>
                setConfirmation({
                  titre: m.statut === 'terminee' ? 'Réactiver la matière ?' : 'Marquer comme terminée ?',
                  texte:
                    m.statut === 'terminee'
                      ? `« ${m.nom} » repassera dans les matières en cours.`
                      : `« ${m.nom} » rejoindra l'historique. Ses séances et son bilan sont conservés.`,
                  confirmer: m.statut === 'terminee' ? 'Réactiver' : 'Terminer',
                  onConfirmer: async () => {
                    await changerStatutMatiere(m.id, m.statut === 'terminee' ? 'en_cours' : 'terminee')
                    toast(m.statut === 'terminee' ? 'Matière réactivée' : 'Matière archivée')
                  },
                })
              }
              onSupprimer={() =>
                setConfirmation({
                  titre: 'Supprimer la matière ?',
                  texte: `« ${m.nom} » et ses ${m.avancement.nbSeances} séance(s) seront définitivement supprimées.`,
                  confirmer: 'Supprimer',
                  danger: true,
                  onConfirmer: async () => {
                    await supprimerMatiere(m.id)
                    toast('Matière supprimée', 'info')
                  },
                })
              }
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setForm({})}
        className="fixed bottom-[calc(4.75rem+var(--safe-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition active:scale-95"
        aria-label="Nouvelle matière"
      >
        <IconePlus size={26} strokeWidth={2.2} />
      </button>

      <MatiereForm
        ouvert={!!form}
        onFermer={() => setForm(null)}
        matiere={form?.matiere}
        ecoles={ecoles}
        tauxParCle={tauxParCle}
      />
      <Confirmation etat={confirmation} onFermer={() => setConfirmation(null)} />
      <DetailMatiere matiere={detail} seances={seances} onFermer={() => setDetail(null)} />
    </div>
  )
}

const Filtre = ({ actif, onClick, label, couleur }) => (
  <button
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
      actif ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 shadow-sm'
    }`}
  >
    {couleur && <span className="h-2 w-2 rounded-full" style={{ background: actif ? '#fff' : couleur }} />}
    {label}
  </button>
)

function CarteMatiere({ m, onEditer, onDetail, onArchiver, onSupprimer }) {
  const a = m.avancement
  const couleur = m.ecole?.couleur || '#4f46e5'
  const tons = { erreur: 'text-rose-600', alerte: 'text-amber-600', info: 'text-brand-600' }

  return (
    <li className="carte overflow-hidden">
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="mt-1 w-1 self-stretch rounded-full" style={{ background: couleur }} />
        <button className="min-w-0 flex-1 text-left" onClick={onDetail}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Puce couleur={couleur}>{m.ecole?.code}</Puce>
            <Puce className="bg-ink-100 text-ink-500">{m.niveau}</Puce>
            {a.complete && (
              <Puce className="bg-emerald-100 text-emerald-700">
                <IconeCheck size={11} /> Quota atteint
              </Puce>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-[15.5px] font-bold leading-tight text-ink-900">{m.nom}</h3>
          <p className="mt-0.5 text-[12.5px] tabular text-ink-500">
            {formatDuree(a.faites)} / {formatDuree(a.quota)}
            {a.planifiees > 0 && <span className="text-ink-400"> · {formatDuree(a.planifiees)} planifiées</span>}
            {m.taux > 0 && <span className="text-ink-400"> · {fcfa(a.faites * m.taux)}</span>}
          </p>
        </button>
        <div className="flex flex-col gap-1">
          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={onEditer} aria-label="Modifier">
            <IconeCrayon size={17} />
          </button>
          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={onArchiver} aria-label="Archiver">
            <IconeArchive size={17} />
          </button>
          <button className="rounded-lg p-1.5 text-ink-300 hover:bg-rose-50 hover:text-rose-600" onClick={onSupprimer} aria-label="Supprimer">
            <IconePoubelle size={17} />
          </button>
        </div>
      </div>
      <div className="px-4 pb-4">
        <Progression valeur={a.pct} projete={a.pctProjete} couleur={couleur} />
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className={`text-[12px] font-semibold ${a.alerte ? tons[a.alerte.niveau] : 'text-ink-500'}`}>
            {a.alerte ? a.alerte.texte : `${Math.round(a.pct)} % réalisé`}
          </span>
          <span className="text-[12px] tabular text-ink-400">
            {a.restantes > 0 ? `${formatDuree(a.restantes)} restantes` : 'Terminé'}
          </span>
        </div>
      </div>
    </li>
  )
}

function DetailMatiere({ matiere, seances, onFermer }) {
  if (!matiere) return null
  const siennes = seances
    .filter((s) => s.matiereId === matiere.id && s.statut !== 'annule')
    .sort((a, b) => (b.date + b.debut).localeCompare(a.date + a.debut))
  const a = matiere.avancement

  return (
    <Modale ouvert onFermer={onFermer} titre={matiere.nom} sousTitre={`${matiere.ecole?.code} · ${matiere.niveau}`}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Réalisé', formatDuree(a.faites)],
          ['Planifié', formatDuree(a.planifiees)],
          ['Restant', formatDuree(Math.max(0, a.restantes))],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-ink-50 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{l}</p>
            <p className="text-[15px] font-bold tabular text-ink-900">{v}</p>
          </div>
        ))}
      </div>
      <Progression valeur={a.pct} projete={a.pctProjete} couleur={matiere.ecole?.couleur} hauteur={10} />
      <p className="mt-2 text-[12.5px] text-ink-500">
        {a.nbFaites} séance(s) effectuée(s) sur {a.nbSeances} · rémunération acquise {fcfa(a.faites * (matiere.taux || 0))}
      </p>

      <h4 className="mb-2 mt-5 text-[13px] font-bold text-ink-700">Séances</h4>
      {siennes.length === 0 ? (
        <p className="text-[13px] text-ink-400">Aucune séance planifiée pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {siennes.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.statut === 'fait' ? 'bg-emerald-500' : 'bg-ink-300'}`} />
              <span className="tabular text-ink-600">{s.date}</span>
              <span className="tabular text-ink-500">
                {s.debut}–{s.fin}
              </span>
              <span className="ml-auto text-[12px] text-ink-400">{s.mode === 'ligne' ? 'En ligne' : s.lieu || 'Présentiel'}</span>
            </li>
          ))}
        </ul>
      )}
    </Modale>
  )
}
