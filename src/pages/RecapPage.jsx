import { useMemo, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { construireRecap, moisDisponibles, variation } from '../lib/stats'
import { aujourdhui, formatDuree, moisCourant, moisLabel, moisLabelCourt, moisPrecedent, moisSuivant } from '../lib/dates'
import { fcfa, fcfaCourt } from '../lib/money'
import { basculerPaiement } from '../data/repo'
import { usePaiements } from '../data/queries'
import { etatFacture, facturesEnRetard, numeroFacture, texteRelance } from '../lib/facturation'
import { Statistique, Vide, Puce, useToast, Modale, Bandeau } from '../components/ui'
import { IconeGraphique, IconeChevronGauche, IconeChevronDroite, IconePartage, IconeArchive } from '../components/icons'

export default function RecapPage({ referentiel, seances }) {
  const { ecolesById, matieresById, reglages } = referentiel
  const toast = useToast()
  const paiements = usePaiements()
  const [mois, setMois] = useState(moisCourant())
  const [historique, setHistorique] = useState(false)

  const heureSoir = reglages.heureDebutSoir
  const recap = useMemo(() => construireRecap(mois, seances, { matieresById, ecolesById, heureSoir }), [mois, seances, matieresById, ecolesById, heureSoir])
  const recapPrec = useMemo(
    () => construireRecap(moisPrecedent(mois), seances, { matieresById, ecolesById }),
    [mois, seances, matieresById, ecolesById]
  )

  const paiementsParEcole = useMemo(
    () => new Map(paiements.filter((p) => p.mois === mois).map((p) => [p.ecoleId, p])),
    [paiements, mois]
  )

  const delai = Number(reglages.delaiPaiementJours) || 30
  const retards = useMemo(() => facturesEnRetard(paiements, delai, aujourdhui()), [paiements, delai])

  async function facturer(e) {
    const ecole = ecolesById.get(e.ecoleId)
    const numero = numeroFacture(ecole, mois)
    const dateFacture = paiementsParEcole.get(e.ecoleId)?.dateFacture || aujourdhui()
    await basculerPaiement(e.ecoleId, mois, 'facture', e.montant, { numeroFacture: numero, dateFacture })
    const { pdfFacture, partagerOuTelecharger } = await import('../lib/pdf')
    const { echeance } = etatFacture({ statut: 'facture', dateFacture }, delai, aujourdhui())
    const doc = pdfFacture(recap, ecole, { numero, dateFacture, echeance, enseignant: reglages.enseignant })
    const res = await partagerOuTelecharger(doc, `facture-${numero}.pdf`, `Facture ${numero}`)
    toast(res === 'partage' ? `Facture ${numero} partagée` : `Facture ${numero} téléchargée`)
  }

  async function relancer(p) {
    const ecole = ecolesById.get(p.ecoleId)
    const heures = construireRecap(p.mois, seances, { matieresById, ecolesById }).parEcole.find((e) => e.ecoleId === p.ecoleId)?.heures
    const texte = texteRelance(p, ecole, { enseignant: reglages.enseignant, heures })
    try {
      if (navigator.share) await navigator.share({ title: `Relance facture ${p.numeroFacture}`, text: texte })
      else {
        await navigator.clipboard.writeText(texte)
        toast('Message de relance copié')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Impossible de partager la relance', 'erreur')
    }
  }

  const deltaHeures = variation(recap.heures, recapPrec.heures)
  const deltaMontant = variation(recap.montant, recapPrec.montant)

  const donneesEcoles = recap.parEcole.map((e) => ({ nom: e.code, heures: Number(e.heures.toFixed(2)), montant: e.montant, couleur: e.couleur }))
  const donneesComparaison = [
    { mois: moisLabelCourt(recapPrec.mois), heures: Number(recapPrec.heures.toFixed(1)), montant: recapPrec.montant },
    { mois: moisLabelCourt(recap.mois), heures: Number(recap.heures.toFixed(1)), montant: recap.montant },
  ]

  async function exporter() {
    if (!recap.nbSeances) return toast('Aucune séance sur ce mois', 'erreur')
    const { pdfRecapMensuel, partagerOuTelecharger } = await import('../lib/pdf')
    const doc = pdfRecapMensuel(recap, {
      ecolesById,
      enseignant: reglages.enseignant,
      precedent: recapPrec.nbSeances ? recapPrec : null,
      paiementsParEcole,
    })
    const res = await partagerOuTelecharger(doc, `recap-${mois}.pdf`, `Récapitulatif ${moisLabel(mois)}`)
    toast(res === 'partage' ? 'Récapitulatif partagé' : 'PDF téléchargé')
  }

  return (
    <div className="px-4 pt-[calc(1rem+var(--safe-top))]">
      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold capitalize leading-tight text-ink-900">{moisLabel(mois)}</h1>
          <p className="text-[12.5px] text-ink-500">
            {recap.nbSeances} séance{recap.nbSeances > 1 ? 's' : ''} · {formatDuree(recap.heures)}
          </p>
        </div>
        <button className="btn-secondaire px-2.5 py-2" onClick={() => setHistorique(true)} title="Historique">
          <IconeArchive />
        </button>
        <button className="btn-secondaire px-2.5 py-2" onClick={exporter} title="Exporter en PDF">
          <IconePartage />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button className="btn-secondaire px-2.5 py-2" onClick={() => setMois(moisPrecedent(mois))} aria-label="Mois précédent">
          <IconeChevronGauche />
        </button>
        <button className="btn-secondaire flex-1 py-2 text-[13px] capitalize" onClick={() => setMois(moisCourant())}>
          Mois courant
        </button>
        <button className="btn-secondaire px-2.5 py-2" onClick={() => setMois(moisSuivant(mois))} aria-label="Mois suivant">
          <IconeChevronDroite />
        </button>
      </div>

      {retards.length > 0 && (
        <div className="mb-4">
          <Bandeau ton="erreur" titre={`${retards.length} facture${retards.length > 1 ? 's' : ''} en retard`}>
            <ul className="mt-1 space-y-1.5">
              {retards.map((p) => (
                <li key={`${p.ecoleId}-${p.mois}`} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1">
                    <b>{ecolesById.get(p.ecoleId)?.code}</b> · {moisLabel(p.mois)} · {fcfa(p.montant)} · {p.joursRetard} j de retard
                  </span>
                  <button className="shrink-0 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white" onClick={() => relancer(p)}>
                    Relancer
                  </button>
                </li>
              ))}
            </ul>
          </Bandeau>
        </div>
      )}

      {recap.nbSeances === 0 ? (
        <Vide
          icone={<IconeGraphique size={26} />}
          titre="Aucune séance ce mois-ci"
          texte="Le récapitulatif se construit automatiquement à partir des séances du calendrier."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Statistique
              label="Heures totales"
              valeur={formatDuree(recap.heures)}
              detail={`dont ${formatDuree(recap.heuresFaites)} effectuées`}
            />
            <Statistique
              label="Montant prévisionnel"
              valeur={fcfa(recap.montant)}
              detail={`${fcfa(recap.montantFait)} acquis`}
              accent="text-brand-700"
            />
            <Statistique
              label="vs mois précédent"
              valeur={deltaHeures === null ? '—' : `${deltaHeures >= 0 ? '+' : ''}${deltaHeures.toFixed(0)} %`}
              detail={`${formatDuree(recapPrec.heures)} en ${moisLabelCourt(recapPrec.mois)}`}
              accent={deltaHeures === null ? 'text-ink-400' : deltaHeures >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            />
            <Statistique
              label="Écart montant"
              valeur={deltaMontant === null ? '—' : `${deltaMontant >= 0 ? '+' : ''}${deltaMontant.toFixed(0)} %`}
              detail={fcfa(recap.montant - recapPrec.montant)}
              accent={deltaMontant === null ? 'text-ink-400' : deltaMontant >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            />
          </div>

          <section className="carte p-4">
            <h2 className="mb-3 text-[14px] font-bold text-ink-800">Heures par école</h2>
            <ResponsiveContainer width="100%" height={Math.max(140, donneesEcoles.length * 40)}>
              <BarChart data={donneesEcoles} layout="vertical" margin={{ left: 4, right: 46, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nom" width={72} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(v, n, p) => [`${formatDuree(v)} · ${fcfa(p.payload.montant)}`, 'Volume']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="heures" radius={[0, 6, 6, 0]} barSize={18}>
                  {donneesEcoles.map((d) => (
                    <Cell key={d.nom} fill={d.couleur} />
                  ))}
                  <LabelList dataKey="heures" position="right" formatter={(v) => formatDuree(v)} style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="carte p-4">
              <h2 className="mb-1 text-[14px] font-bold text-ink-800">Répartition du montant</h2>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={donneesEcoles} dataKey="montant" nameKey="nom" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none">
                    {donneesEcoles.map((d) => (
                      <Cell key={d.nom} fill={d.couleur} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fcfa(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {donneesEcoles.map((d) => (
                  <span key={d.nom} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-500">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.couleur }} />
                    {d.nom} · {fcfaCourt(d.montant)}
                  </span>
                ))}
              </div>
            </section>

            <section className="carte p-4">
              <h2 className="mb-3 text-[14px] font-bold text-ink-800">Comparaison mensuelle</h2>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={donneesComparaison} margin={{ left: -14, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    formatter={(v, n) => (n === 'heures' ? [formatDuree(v), 'Heures'] : [fcfa(v), 'Montant'])}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="heures" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className="carte overflow-hidden">
            <h2 className="px-4 pb-1 pt-4 text-[14px] font-bold text-ink-800">Facturation par école</h2>
            <ul className="divide-y divide-ink-100">
              {recap.parEcole.map((e) => {
                const p = paiementsParEcole.get(e.ecoleId)
                const f = etatFacture(p, delai, aujourdhui())
                const puces = {
                  a_facturer: ['À facturer', 'bg-ink-100 text-ink-600'],
                  facturee: ['Facturée', 'bg-amber-100 text-amber-700'],
                  en_retard: [`Retard ${f.joursRetard} j`, 'bg-rose-100 text-rose-700'],
                  payee: ['Payée', 'bg-emerald-100 text-emerald-700'],
                }
                const [libelle, classes] = puces[f.etat]
                const changer = async (statut, message) => {
                  await basculerPaiement(e.ecoleId, mois, statut, e.montant, { numeroFacture: p?.numeroFacture, dateFacture: p?.dateFacture })
                  toast(message, statut === 'paye' ? 'succes' : 'info')
                }
                return (
                  <li key={e.ecoleId} className="flex items-center gap-3 px-4 py-3">
                    <span className="h-8 w-1 rounded-full" style={{ background: e.couleur }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink-900">
                        {e.code} <span className={`ml-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${classes}`}>{libelle}</span>
                      </p>
                      <p className="text-[12px] tabular text-ink-500">
                        {formatDuree(e.heures)} · {e.nb} séance{e.nb > 1 ? 's' : ''} · {fcfa(e.montant)}
                        {p?.numeroFacture && f.etat !== 'a_facturer' && ` · ${p.numeroFacture}`}
                        {f.echeance && f.etat === 'facturee' && ` · échéance ${f.echeance.split('-').reverse().join('/')}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {f.etat === 'a_facturer' && (
                        <button className="rounded-full bg-ink-900 px-3 py-1.5 text-[11.5px] font-bold text-white" onClick={() => facturer(e)}>
                          Facturer
                        </button>
                      )}
                      {(f.etat === 'facturee' || f.etat === 'en_retard') && (
                        <>
                          <button className="rounded-full bg-ink-100 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-700" onClick={() => facturer(e)} title="Régénérer le PDF">
                            PDF
                          </button>
                          {f.etat === 'en_retard' && (
                            <button className="rounded-full bg-rose-100 px-2.5 py-1.5 text-[11.5px] font-bold text-rose-700" onClick={() => relancer({ ...p, ecoleId: e.ecoleId })}>
                              Relancer
                            </button>
                          )}
                          <button className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11.5px] font-bold text-white" onClick={() => changer('paye', `${e.code} marqué payé`)}>
                            Payé
                          </button>
                        </>
                      )}
                      {f.etat === 'payee' && (
                        <button className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11.5px] font-bold text-emerald-700" onClick={() => changer('facture', `${e.code} repassé en facturé`)}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            <Repartition
              titre="Jour / soir"
              lignes={recap.parCreneau.map((c) => [c.creneau === 'soir' ? `Cours du soir (≥ ${heureSoir})` : 'Cours du jour', c.heures, c.montant])}
              total={recap.heures}
            />
            <Repartition titre="Par niveau" lignes={recap.parNiveau.map((n) => [n.niveau, n.heures, n.montant])} total={recap.heures} />
            <Repartition
              titre="Par mode"
              lignes={recap.parMode.map((m) => [m.mode === 'ligne' ? 'En ligne' : 'Présentiel', m.heures, m.montant])}
              total={recap.heures}
            />
          </div>

          <section className="carte overflow-hidden">
            <h2 className="px-4 pb-1 pt-4 text-[14px] font-bold text-ink-800">Par matière</h2>
            <ul className="divide-y divide-ink-100">
              {recap.parMatiere.map((m) => (
                <li key={m.matiereId} className="flex items-center gap-3 px-4 py-2.5">
                  <Puce couleur={m.couleur}>{m.code}</Puce>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-800">
                    {m.nom}
                    {m.classes?.length > 0 && <span className="font-normal text-ink-400"> · {m.classes.join(', ')}</span>}
                  </span>
                  <span className="shrink-0 text-[12.5px] tabular text-ink-500">{formatDuree(m.heures)}</span>
                  <span className="w-24 shrink-0 text-right text-[12.5px] font-semibold tabular text-ink-700">{fcfa(m.montant)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <Historique
        ouvert={historique}
        onFermer={() => setHistorique(false)}
        seances={seances}
        contexte={{ matieresById, ecolesById }}
        paiements={paiements}
        onChoisir={(m) => {
          setMois(m)
          setHistorique(false)
        }}
      />
    </div>
  )
}

const Repartition = ({ titre, lignes, total }) => (
  <section className="carte p-4">
    <h2 className="mb-2.5 text-[14px] font-bold text-ink-800">{titre}</h2>
    <ul className="space-y-2.5">
      {lignes.map(([label, heures, montant]) => (
        <li key={label}>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="font-medium text-ink-700">{label}</span>
            <span className="tabular text-ink-500">
              {formatDuree(heures)} · {fcfa(montant)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${total ? (heures / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  </section>
)

function Historique({ ouvert, onFermer, seances, contexte, paiements, onChoisir }) {
  const mois = useMemo(() => moisDisponibles(seances), [seances])
  const lignes = useMemo(
    () =>
      mois.map((m) => {
        const r = construireRecap(m, seances, contexte)
        const duMois = paiements.filter((p) => p.mois === m)
        const enAttente = r.parEcole.filter((e) => duMois.find((p) => p.ecoleId === e.ecoleId)?.statut !== 'paye').length
        return { mois: m, ...r, enAttente }
      }),
    [mois, seances, contexte, paiements]
  )

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Historique des récapitulatifs" sousTitre={`${lignes.length} mois enregistré(s)`}>
      {lignes.length === 0 ? (
        <p className="text-[13px] text-ink-400">Aucun mois enregistré pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {lignes.map((l) => (
            <li key={l.mois}>
              <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => onChoisir(l.mois)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold capitalize text-ink-900">{moisLabel(l.mois)}</p>
                  <p className="text-[12px] tabular text-ink-500">
                    {formatDuree(l.heures)} · {l.nbSeances} séances
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13.5px] font-bold tabular text-ink-800">{fcfa(l.montant)}</p>
                  {l.enAttente > 0 && <p className="text-[11px] font-semibold text-amber-600">{l.enAttente} école(s) en attente</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modale>
  )
}
