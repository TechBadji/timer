import { useEffect, useRef, useState } from 'react'
import { NIVEAUX } from '../data/constants'
import { ecrireReglage } from '../data/db'
import { definirTarif, majEcole } from '../data/repo'
import { telechargerSauvegarde, importerSauvegarde, viderSeances } from '../lib/backup'
import { demanderPermission, notificationTest, permissionNotifications, notificationsSupportees } from '../lib/notifications'
import { fcfa } from '../lib/money'
import { Champ, Saisie, Liste, useToast, Confirmation, Bandeau } from '../components/ui'
import { IconeCloche, IconeTelecharger, IconeCheck } from '../components/icons'

export default function ReglagesPage({ referentiel, seances }) {
  const { ecoles, matieres, reglages, tauxParCle } = referentiel
  const toast = useToast()
  const [confirmation, setConfirmation] = useState(null)
  const [permission, setPermission] = useState(permissionNotifications())
  const [invite, setInvite] = useState(null) // événement beforeinstallprompt
  const fichierRef = useRef(null)

  useEffect(() => {
    const surInvite = (e) => {
      e.preventDefault()
      setInvite(e)
    }
    window.addEventListener('beforeinstallprompt', surInvite)
    return () => window.removeEventListener('beforeinstallprompt', surInvite)
  }, [])

  const majReglage = async (cle, valeur) => {
    await ecrireReglage(cle, valeur)
  }

  return (
    <div className="px-4 pt-[calc(1rem+var(--safe-top))]">
      <h1 className="text-[22px] font-bold leading-tight text-ink-900">Réglages</h1>
      <p className="mb-4 text-[12.5px] text-ink-500">
        {ecoles.length} écoles · {matieres.length} matières · {seances.length} séances — tout est stocké sur cet appareil
      </p>

      <div className="space-y-4 pb-4">
        {/* Grille tarifaire */}
        <Section titre="Grille tarifaire" sousTitre="Taux horaire en FCFA par école et par niveau">
          <div className="overflow-hidden rounded-xl border border-ink-200">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-ink-50">
                  <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">École</th>
                  {NIVEAUX.map((n) => (
                    <th key={n} className="px-2 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ecoles.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-2 font-semibold text-ink-800">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.couleur }} />
                        {e.code}
                      </span>
                    </td>
                    {NIVEAUX.map((n) => (
                      <td key={n} className="px-2 py-1.5">
                        <CelluleTarif
                          valeur={tauxParCle.get(`${e.id}|${n}`) ?? ''}
                          onValider={async (v) => {
                            await definirTarif(e.id, n, v)
                            toast(`${e.code} · ${n} : ${fcfa(v)}/h`)
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-ink-400">
            Le taux est figé sur chaque séance au moment de sa création : modifier la grille ne réécrit jamais les mois déjà
            calculés.
          </p>
        </Section>

        {/* Écoles */}
        <Section titre="Écoles" sousTitre="Nom affiché et code couleur du calendrier">
          <ul className="space-y-2">
            {ecoles.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={e.couleur}
                  onChange={(ev) => majEcole(e.id, { couleur: ev.target.value })}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-ink-200 bg-white p-0.5"
                  aria-label={`Couleur ${e.code}`}
                />
                <span className="w-24 shrink-0 text-[13px] font-bold text-ink-800">{e.code}</span>
                <SaisieSynchro
                  valeur={e.nom}
                  onCommit={(v) => majEcole(e.id, { nom: v })}
                  className="flex-1 py-1.5 text-[13px]"
                />
              </li>
            ))}
          </ul>
        </Section>

        {/* Journée & conflits */}
        <Section titre="Journée de travail" sousTitre="Bornes du calendrier et détection des conflits">
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Début de journée">
              <SaisieSynchro type="time" step="1800" valeur={reglages.heureDebutJour} onCommit={(v) => majReglage('heureDebutJour', v)} immediat />
            </Champ>
            <Champ label="Fin de journée">
              <SaisieSynchro type="time" step="1800" valeur={reglages.heureFinJour} onCommit={(v) => majReglage('heureFinJour', v)} immediat />
            </Champ>
            <Champ label="Temps de trajet (min)" aide="Entre deux écoles en présentiel">
              <SaisieSynchro type="number" min="0" step="5" valeur={reglages.trajetMinutes} onCommit={(v) => majReglage('trajetMinutes', Number(v))} />
            </Champ>
            <Champ label="Alerte quota (%)" aide="Seuil de progression">
              <SaisieSynchro type="number" min="50" max="100" step="5" valeur={reglages.seuilAlerteQuota} onCommit={(v) => majReglage('seuilAlerteQuota', Number(v))} />
            </Champ>
          </div>
          <Bascule
            actif={!!reglages.autoFait}
            onChange={(v) => majReglage('autoFait', v)}
            titre="Marquer automatiquement les séances passées"
            texte="Une séance planifiée dont l'horaire est écoulé passe en « effectuée » et décompte le quota."
          />
        </Section>

        {/* Rappels */}
        <Section titre="Rappels de cours" sousTitre="Notifications locales, sans serveur">
          <Champ label="Délai du rappel (minutes avant le début)">
            <Liste value={reglages.rappelMinutes} onChange={(e) => majReglage('rappelMinutes', Number(e.target.value))}>
              {[10, 15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} minutes avant
                </option>
              ))}
            </Liste>
          </Champ>
          {!notificationsSupportees() ? (
            <div className="mt-3">
              <Bandeau ton="alerte">Ce navigateur ne gère pas les notifications locales.</Bandeau>
            </div>
          ) : permission === 'granted' ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="puce bg-emerald-100 text-emerald-700">
                <IconeCheck size={12} /> Rappels activés
              </span>
              <button className="btn-secondaire ml-auto px-3 py-1.5 text-[12.5px]" onClick={() => notificationTest()}>
                Tester
              </button>
            </div>
          ) : (
            <button
              className="btn-primaire mt-3 w-full"
              onClick={async () => {
                const p = await demanderPermission()
                setPermission(p)
                toast(p === 'granted' ? 'Rappels activés' : 'Autorisation refusée', p === 'granted' ? 'succes' : 'erreur')
              }}
            >
              <IconeCloche size={18} /> Activer les rappels
            </button>
          )}
          <p className="mt-2 text-[12px] text-ink-400">
            Les rappels des 24 prochaines heures sont programmés tant que l'application reste ouverte en arrière-plan.
          </p>
        </Section>

        {/* Identité */}
        <Section titre="Identité" sousTitre="Nom imprimé sur les exports PDF">
          <Champ label="Enseignant">
            <SaisieSynchro valeur={reglages.enseignant} onCommit={(v) => majReglage('enseignant', v)} placeholder="Prénom Nom" />
          </Champ>
        </Section>

        {/* Installation */}
        {invite && (
          <Section titre="Installer Timer" sousTitre="Ajouter l'application à l'écran d'accueil">
            <button
              className="btn-primaire w-full"
              onClick={async () => {
                invite.prompt()
                const { outcome } = await invite.userChoice
                if (outcome === 'accepted') setInvite(null)
              }}
            >
              <IconeTelecharger size={18} /> Installer sur cet appareil
            </button>
          </Section>
        )}

        {/* Données */}
        <Section titre="Données" sousTitre="Sauvegarde locale — aucune donnée ne quitte l'appareil">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn-secondaire flex-1"
              onClick={async () => {
                await telechargerSauvegarde()
                toast('Sauvegarde téléchargée')
              }}
            >
              Exporter (JSON)
            </button>
            <button className="btn-secondaire flex-1" onClick={() => fichierRef.current?.click()}>
              Restaurer
            </button>
            <input
              ref={fichierRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setConfirmation({
                  titre: 'Restaurer cette sauvegarde ?',
                  texte: 'Toutes les données actuelles de cet appareil seront remplacées par le contenu du fichier.',
                  confirmer: 'Restaurer',
                  danger: true,
                  onConfirmer: async () => {
                    try {
                      const n = await importerSauvegarde(f)
                      toast(`Restauré : ${n.seances} séances, ${n.matieres} matières`)
                    } catch (err) {
                      toast(err.message || 'Fichier illisible', 'erreur')
                    }
                  },
                })
              }}
            />
          </div>
          <button
            className="btn-danger mt-2 w-full"
            onClick={() =>
              setConfirmation({
                titre: 'Effacer toutes les séances ?',
                texte: 'Les matières, tarifs et écoles sont conservés. Les séances et l’avancement des quotas seront perdus.',
                confirmer: 'Tout effacer',
                danger: true,
                onConfirmer: async () => {
                  await viderSeances()
                  toast('Séances effacées', 'info')
                },
              })
            }
          >
            Effacer toutes les séances
          </button>
        </Section>

        <p className="px-1 pb-2 text-center text-[11.5px] leading-relaxed text-ink-400">
          Timer · application hors-ligne · fuseau de Dakar (GMT)
          <br />
          Données stockées dans IndexedDB, sur cet appareil uniquement.
        </p>
      </div>

      <Confirmation etat={confirmation} onFermer={() => setConfirmation(null)} />
    </div>
  )
}

const Section = ({ titre, sousTitre, children }) => (
  <section className="carte p-4">
    <h2 className="text-[15px] font-bold text-ink-900">{titre}</h2>
    {sousTitre && <p className="mb-3 mt-0.5 text-[12.5px] text-ink-500">{sousTitre}</p>}
    {children}
  </section>
)

/**
 * Champ dont la valeur vient d'IndexedDB (donc résolue après le premier rendu).
 * On garde une copie locale pour ne pas gêner la saisie, resynchronisée dès que
 * la valeur externe change.
 */
function SaisieSynchro({ valeur, onCommit, immediat = false, ...props }) {
  const [v, setV] = useState(valeur ?? '')
  useEffect(() => setV(valeur ?? ''), [valeur])
  return (
    <Saisie
      {...props}
      value={v}
      onChange={(e) => {
        setV(e.target.value)
        if (immediat) onCommit(e.target.value)
      }}
      onBlur={() => !immediat && String(v) !== String(valeur ?? '') && onCommit(v)}
    />
  )
}

function CelluleTarif({ valeur, onValider }) {
  const [v, setV] = useState(String(valeur ?? ''))
  useEffect(() => setV(String(valeur ?? '')), [valeur])
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      step="500"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => Number(v || 0) !== Number(valeur || 0) && onValider(Number(v || 0))}
      placeholder="—"
      className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-right text-[13px] tabular outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
    />
  )
}

function Bascule({ actif, onChange, titre, texte }) {
  return (
    <button className="mt-3 flex w-full items-start gap-3 text-left" onClick={() => onChange(!actif)}>
      <span
        className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${actif ? 'bg-brand-600' : 'bg-ink-300'}`}
      >
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-4' : ''}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink-800">{titre}</span>
        <span className="block text-[12px] leading-relaxed text-ink-500">{texte}</span>
      </span>
    </button>
  )
}
