import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import { useGrandEcran } from '../lib/media'
import { detecterConflits, gravitePire, listerConflits } from '../lib/conflicts'
import { bornesSemaine, formatDuree, format, toISO, jourLabel, aujourdhui } from '../lib/dates'
import { heuresDe } from '../lib/stats'
import { libelleClasses } from '../lib/classes'
import { deplacerSeance, dupliquerSemaine, marquerFait } from '../data/repo'
import { Modale, Saisie, Champ, Vide, Puce, useToast, Bandeau } from '../components/ui'
import {
  IconePlus, IconeMicro, IconeChevronGauche, IconeChevronDroite, IconeCopie, IconePartage, IconeCalendrier, IconeCheck,
} from '../components/icons'
import SeanceForm from '../components/SeanceForm'
import Conflits from '../components/Conflits'
import { reconnaissanceDisponible } from '../lib/voix'

const VUES = [
  { valeur: 'timeGridDay', label: 'Jour' },
  { valeur: 'timeGridWeek', label: 'Semaine' },
  { valeur: 'dayGridMonth', label: 'Mois' },
  { valeur: 'listWeek', label: 'Liste' },
]

export default function CalendrierPage({ params, referentiel, seances }) {
  const { ecoles, ecolesById, matieresById, reglages, matieres, ignores } = referentiel
  const toast = useToast()
  const grandEcran = useGrandEcran()
  const calRef = useRef(null)
  const [vue, setVue] = useState(() => localStorage.getItem('timer.vue') || 'timeGridWeek')
  const [titre, setTitre] = useState('')
  const [plage, setPlage] = useState({ debut: aujourdhui(), fin: aujourdhui() })
  const [form, setForm] = useState(null) // { seance } | { defauts }
  const [dupliquer, setDupliquer] = useState(false)
  const [nbCopies, setNbCopies] = useState(3)
  const [copieId, setCopieId] = useState(null) // séance tout juste dupliquée, à glisser vers son créneau

  // Arbitrage des conflits : la liste, et le retour à la liste après avoir déplacé un cours.
  const [voirConflits, setVoirConflits] = useState(false)
  const [retourConflits, setRetourConflits] = useState(false)

  const ctxConflits = useMemo(
    () => ({ matieresById, ecolesById, trajetMinutes: reglages.trajetMinutes, ignores }),
    [matieresById, ecolesById, reglages.trajetMinutes, ignores]
  )
  const conflits = useMemo(() => detecterConflits(seances, ctxConflits), [seances, ctxConflits])
  const paires = useMemo(() => listerConflits(seances, ctxConflits), [seances, ctxConflits])

  // Ouverture sur une date précise (retour depuis une notification).
  useEffect(() => {
    const cible = params.get('date')
    if (cible && calRef.current) calRef.current.getApi().gotoDate(cible)
  }, [params])

  useEffect(() => {
    localStorage.setItem('timer.vue', vue)
    calRef.current?.getApi().changeView(vue)
  }, [vue])

  const evenements = useMemo(
    () =>
      seances.map((s) => {
        const m = matieresById.get(s.matiereId)
        const e = ecolesById.get(m?.ecoleId)
        return {
          id: String(s.id),
          title: m?.nom || 'Cours',
          start: `${s.date}T${s.debut}:00`,
          end: `${s.date}T${s.fin}:00`,
          editable: s.statut !== 'annule',
          extendedProps: {
            seance: s,
            matiere: m,
            ecole: e,
            couleur: e?.couleur || '#64748b',
            conflit: gravitePire(conflits.get(s.id)),
            copie: s.id === copieId,
          },
        }
      }),
    [seances, matieresById, ecolesById, conflits, copieId]
  )

  const surDates = useCallback((info) => {
    setTitre(info.view.title)
    setPlage({ debut: toISO(info.view.currentStart), fin: toISO(new Date(info.view.currentEnd.getTime() - 86400000)) })
  }, [])

  const surDeplacement = async (info) => {
    const { start, end } = info.event
    await deplacerSeance(Number(info.event.id), {
      date: toISO(start),
      debut: format(start, 'HH:mm'),
      fin: format(end || start, 'HH:mm'),
    })
    if (Number(info.event.id) === copieId) setCopieId(null)
    toast('Séance déplacée', 'info')
  }

  const seancesDeLaPlage = useMemo(
    () => seances.filter((s) => s.date >= plage.debut && s.date <= plage.fin && s.statut !== 'annule'),
    [seances, plage]
  )
  const heuresPlage = seancesDeLaPlage.reduce((t, s) => t + heuresDe(s), 0)
  const nbConflits = paires.filter((p) => p.a.date >= plage.debut && p.a.date <= plage.fin).length
  const nbConflitsAVenir = paires.filter((p) => p.a.date >= aujourdhui()).length

  const nouveauCours = (dicter = false) =>
    setForm({ dicter, defauts: { date: plage.debut <= aujourdhui() && aujourdhui() <= plage.fin ? aujourdhui() : plage.debut } })
  const vocal = reconnaissanceDisponible()

  async function exporter() {
    if (!seancesDeLaPlage.length) return toast('Aucune séance à exporter sur cette période', 'erreur')
    // Chargé à la demande : jsPDF pèse lourd et ne sert qu'à l'export.
    const { pdfEmploiDuTemps, partagerOuTelecharger } = await import('../lib/pdf')
    const doc = pdfEmploiDuTemps(seancesDeLaPlage, {
      matieresById,
      ecolesById,
      titre: 'Emploi du temps',
      periode: `${jourLabel(plage.debut, 'd MMMM yyyy')} → ${jourLabel(plage.fin, 'd MMMM yyyy')}`,
      enseignant: reglages.enseignant,
    })
    const res = await partagerOuTelecharger(doc, `emploi-du-temps-${plage.debut}.pdf`, 'Emploi du temps')
    toast(res === 'partage' ? 'Emploi du temps partagé' : 'PDF téléchargé')
  }

  async function lancerDuplication() {
    const { debut } = bornesSemaine(plage.debut)
    const n = await dupliquerSemaine(debut, Number(nbCopies))
    setDupliquer(false)
    toast(n ? `${n} séances dupliquées sur ${nbCopies} semaine(s)` : 'Aucune séance à dupliquer', n ? 'succes' : 'erreur')
  }

  return (
    <div
      className={`px-4 pt-[calc(1rem+var(--safe-top))] lg:px-6 ${
        grandEcran ? 'flex h-[calc(100dvh-5rem)] flex-col overflow-hidden' : ''
      }`}
    >
      {/* En-tête */}
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold capitalize leading-tight text-ink-900 lg:text-[26px]">
            {titre || 'Calendrier'}
          </h1>
          <p className="text-[12.5px] text-ink-500">
            {seancesDeLaPlage.length} séance{seancesDeLaPlage.length > 1 ? 's' : ''} · {formatDuree(heuresPlage)}
            {(nbConflits > 0 || nbConflitsAVenir > 0) && (
              <button className="ml-1.5 font-semibold text-rose-600 underline underline-offset-2" onClick={() => setVoirConflits(true)}>
                {nbConflits > 0
                  ? `${nbConflits} conflit${nbConflits > 1 ? 's' : ''} à arbitrer`
                  : `${nbConflitsAVenir} conflit${nbConflitsAVenir > 1 ? 's' : ''} à venir`}
              </button>
            )}
          </p>
        </div>
        <button className="btn-secondaire px-2.5 py-2" onClick={() => setDupliquer(true)} title="Dupliquer la semaine">
          <IconeCopie />
        </button>
        <button className="btn-secondaire px-2.5 py-2" onClick={exporter} title="Exporter en PDF">
          <IconePartage />
        </button>
        {/* Sur ordinateur, la création passe par un bouton d'en-tête plutôt que par
            le bouton flottant, qui recouvrirait la carte « prochain cours ». */}
        {vocal && (
          <button className="btn-secondaire hidden px-3.5 py-2 lg:inline-flex" onClick={() => nouveauCours(true)}>
            <IconeMicro size={18} /> Dicter la séance
          </button>
        )}
        <button className="btn-primaire hidden px-3.5 py-2 lg:inline-flex" onClick={() => nouveauCours()}>
          <IconePlus size={18} /> Ajouter un cours
        </button>
      </div>

      <div className="mb-3 flex shrink-0 items-center gap-2">
        <div className="flex rounded-xl border border-ink-200 bg-white">
          <button className="px-2.5 py-2 text-ink-500 hover:text-ink-900" onClick={() => calRef.current?.getApi().prev()} aria-label="Période précédente">
            <IconeChevronGauche />
          </button>
          <button className="border-x border-ink-200 px-3 py-2 text-[13px] font-semibold text-ink-700" onClick={() => calRef.current?.getApi().today()}>
            Auj.
          </button>
          <button className="px-2.5 py-2 text-ink-500 hover:text-ink-900" onClick={() => calRef.current?.getApi().next()} aria-label="Période suivante">
            <IconeChevronDroite />
          </button>
        </div>
        <div className="segment flex-1 lg:max-w-md">
          {VUES.map((v) => (
            <button key={v.valeur} data-actif={vue === v.valeur} onClick={() => setVue(v.valeur)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {copieId && (
        <div className="mb-3 flex shrink-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <Bandeau ton="info">
              Copie créée sur le même créneau (encadrée). {grandEcran ? 'Glissez-la' : 'Maintenez le doigt dessus puis glissez-la'} vers
              le bon emplacement.
            </Bandeau>
          </div>
          <button className="btn-secondaire px-3 py-2 text-[13px]" onClick={() => setCopieId(null)}>
            OK
          </button>
        </div>
      )}

      {matieres.length === 0 ? (
        <Vide
          icone={<IconeCalendrier size={26} />}
          titre="Commencez par créer vos matières"
          texte="Une matière porte l'école, le niveau et le volume horaire à réaliser. Les séances s'y rattachent ensuite."
          action={
            <a href="#/matieres" className="btn-primaire">
              Créer une matière
            </a>
          }
        />
      ) : (
        <div className={`carte overflow-hidden p-1.5 ${grandEcran ? 'min-h-0 flex-1' : ''}`}>
          <FullCalendar
            ref={calRef}
            plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
            initialView={vue}
            locale={frLocale}
            firstDay={1}
            headerToolbar={false}
            height={grandEcran ? '100%' : 'auto'}
            expandRows
            allDaySlot={false}
            nowIndicator
            slotMinTime={`${reglages.heureDebutJour}:00`}
            slotMaxTime={`${reglages.heureFinJour}:00`}
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            dayMaxEvents={grandEcran ? false : 3}
            dayHeaderFormat={grandEcran ? { weekday: 'long', day: 'numeric' } : { weekday: 'short', day: 'numeric' }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            events={evenements}
            datesSet={surDates}
            selectable
            selectMirror
            longPressDelay={300}
            select={(info) =>
              setForm({
                defauts: info.allDay
                  ? { date: toISO(info.start) } // vue mois : aucune heure sélectionnée
                  : { date: toISO(info.start), debut: format(info.start, 'HH:mm'), fin: format(info.end, 'HH:mm') },
              })
            }
            dateClick={(info) => {
              if (info.view.type === 'dayGridMonth') calRef.current?.getApi().changeView('timeGridDay', info.dateStr)
            }}
            eventClick={(info) => setForm({ seance: info.event.extendedProps.seance })}
            editable
            eventDrop={surDeplacement}
            eventResize={surDeplacement}
            eventContent={(arg) => <Evenement arg={arg} />}
            noEventsContent="Aucune séance sur cette période"
          />
        </div>
      )}

      {/* Légende des écoles */}
      <div className="mt-2.5 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-1 pb-1.5">
        {ecoles.map((e) => (
          <span key={e.id} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: e.couleur }} />
            {e.code}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-dashed border-ink-400" />
          En ligne
        </span>
      </div>

      {/* Prochaine séance */}
      <ProchaineSeance seances={seances} referentiel={referentiel} onOuvrir={(s) => setForm({ seance: s })} />


      {/* Boutons flottants */}
      {vocal && (
        <button
          onClick={() => nouveauCours(true)}
          className="fixed bottom-[calc(9rem+var(--safe-bottom))] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-700 shadow-pop ring-1 ring-ink-200 transition active:scale-95 lg:hidden"
          aria-label="Dicter la séance"
        >
          <IconeMicro size={22} />
        </button>
      )}
      <button
        onClick={() => nouveauCours()}
        className="fixed bottom-[calc(4.75rem+var(--safe-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition active:scale-95 lg:hidden"
        aria-label="Ajouter un cours"
      >
        <IconePlus size={26} strokeWidth={2.2} />
      </button>

      <SeanceForm
        ouvert={!!form}
        onFermer={() => {
          setForm(null)
          if (retourConflits) {
            setRetourConflits(false)
            setVoirConflits(true)
          }
        }}
        seance={form?.seance}
        defauts={form?.defauts}
        dicterAuto={!!form?.dicter}
        referentiel={referentiel}
        seances={seances}
        onDupliquee={setCopieId}
      />

      <Conflits
        ouvert={voirConflits}
        onFermer={() => setVoirConflits(false)}
        paires={paires}
        plage={plage}
        referentiel={referentiel}
        onDeplacer={(s) => {
          setVoirConflits(false)
          setRetourConflits(true)
          setForm({ seance: s })
        }}
      />

      <Modale
        ouvert={dupliquer}
        onFermer={() => setDupliquer(false)}
        titre="Dupliquer la semaine"
        sousTitre={`Semaine du ${jourLabel(bornesSemaine(plage.debut).debut, 'd MMMM')}`}
        largeur="max-w-sm"
        pied={
          <div className="flex gap-2">
            <button className="btn-secondaire flex-1" onClick={() => setDupliquer(false)}>
              Annuler
            </button>
            <button className="btn-primaire flex-1" onClick={lancerDuplication}>
              Dupliquer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <Champ label="Nombre de semaines suivantes" aide="Les séances annulées ne sont pas recopiées.">
            <Saisie type="number" min="1" max="30" value={nbCopies} onChange={(e) => setNbCopies(e.target.value)} />
          </Champ>
          <Bandeau ton="info">
            Toutes les séances de cette semaine seront recopiées à l'identique (horaires, salles, modes) sur les{' '}
            {nbCopies} semaine(s) suivante(s), au statut « planifiée ».
          </Bandeau>
        </div>
      </Modale>
    </div>
  )
}

/* Rendu personnalisé d'un événement du calendrier. */
function Evenement({ arg }) {
  const { couleur, ecole, matiere, seance, conflit, copie } = arg.event.extendedProps
  // Aperçu d'un créneau en cours de sélection (selectMirror) : aucune séance derrière.
  if (!seance) return <p className="truncate px-1.5 py-1 text-[10.5px] font-bold leading-tight lg:text-[11.5px]">{arg.timeText}</p>
  const enLigne = seance.mode === 'ligne'
  const annule = seance.statut === 'annule'
  const mois = arg.view.type === 'dayGridMonth'
  const liste = arg.view.type.startsWith('list')

  if (liste) {
    return (
      <span className={`inline-flex items-center gap-2 ${annule ? 'opacity-50 line-through' : ''}`}>
        <span className="h-2 w-2 rounded-full" style={{ background: couleur }} />
        <span className="font-semibold text-ink-800">{matiere?.nom}</span>
        <span className="text-ink-500">
          {[ecole?.code, libelleClasses(matiere), enLigne ? 'en ligne' : seance.lieu || 'présentiel'].filter(Boolean).join(' · ')}
        </span>
        {seance.notes && <span className="italic text-ink-600">— {seance.notes}</span>}
        {copie && <span className="font-semibold text-brand-700">copie à déplacer</span>}
        {conflit && <span className="font-semibold text-rose-600">conflit</span>}
      </span>
    )
  }

  if (mois) {
    return (
      <div title={seance.notes || undefined} className={`flex w-full items-center gap-1 overflow-hidden px-1 py-px ${annule ? 'opacity-40 line-through' : ''} ${copie ? 'animate-pulse rounded ring-2 ring-ink-900' : ''}`}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: couleur }} />
        <span className="truncate text-[10.5px] font-medium text-ink-700 lg:text-[12px]">
          {arg.timeText} {matiere?.nom}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`h-full overflow-hidden rounded-md px-1.5 py-1 text-white ${annule ? 'opacity-40' : ''} ${copie ? 'animate-pulse' : ''}`}
      style={{
        background: enLigne ? `${couleur}22` : couleur,
        color: enLigne ? couleur : '#fff',
        border: enLigne ? `1.5px dashed ${couleur}` : 'none',
        boxShadow: copie ? 'inset 0 0 0 3px #0f172a' : conflit === 'erreur' ? 'inset 0 0 0 2px #e11d48' : conflit ? 'inset 0 0 0 2px #f59e0b' : 'none',
      }}
    >
      <p className="truncate text-[10.5px] font-bold leading-tight opacity-90 lg:text-[11.5px]">
        {copie ? 'Copie · à déplacer' : arg.timeText}
      </p>
      <p className={`truncate text-[11.5px] font-semibold leading-tight lg:text-[13px] ${annule ? 'line-through' : ''}`}>
        {matiere?.nom}
      </p>
      <p className="truncate text-[10px] leading-tight opacity-85 lg:text-[11px]">
        {ecole?.code} · {enLigne ? 'visio' : seance.lieu || 'présentiel'}
      </p>
      {matiere?.classes?.length > 0 && (
        <p className="truncate text-[10px] leading-tight opacity-85 lg:text-[11px]">{libelleClasses(matiere)}</p>
      )}
      {seance.notes && <p className="line-clamp-3 text-[10px] italic leading-tight opacity-90 lg:text-[11px]">{seance.notes}</p>}
    </div>
  )
}

/* Bloc « prochain cours » sous le calendrier. */
function ProchaineSeance({ seances, referentiel, onOuvrir }) {
  const { matieresById, ecolesById } = referentiel
  const toast = useToast()
  const maintenant = new Date()
  const prochaine = useMemo(
    () =>
      seances
        .filter((s) => s.statut === 'planifie' && new Date(`${s.date}T${s.fin}:00`) >= maintenant)
        .sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut))[0],
    [seances]
  )
  if (!prochaine) return null
  const m = matieresById.get(prochaine.matiereId)
  const e = ecolesById.get(m?.ecoleId)

  return (
    <div className="carte mt-1 flex shrink-0 items-center gap-3 p-3.5 lg:mb-1">
      <div className="w-1 self-stretch rounded-full" style={{ background: e?.couleur }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Prochain cours</p>
        <button className="block max-w-full truncate text-left text-[15px] font-bold text-ink-900" onClick={() => onOuvrir(prochaine)}>
          {m?.nom}
        </button>
        <p className="truncate text-[12.5px] text-ink-500">
          {m?.classes?.length > 0 && `${libelleClasses(m)} · `}
          {jourLabel(prochaine.date, 'EEE d MMM')} · {prochaine.debut}–{prochaine.fin} ·{' '}
          {prochaine.mode === 'ligne' ? 'En ligne' : prochaine.lieu || 'Présentiel'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Puce couleur={e?.couleur}>{e?.code}</Puce>
        <button
          className="btn-secondaire px-2 py-1 text-[12px]"
          onClick={async () => {
            await marquerFait(prochaine.id)
            toast('Séance marquée effectuée')
          }}
        >
          <IconeCheck size={14} /> Fait
        </button>
      </div>
    </div>
  )
}
