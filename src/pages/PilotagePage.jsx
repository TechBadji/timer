import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend, Cell } from 'recharts'
import { previsionnel, chargeHebdo } from '../lib/pilotage'
import { bilanAnnuel } from '../lib/bilan'
import { usePaiements } from '../data/queries'
import { aujourdhui, formatDuree, jourLabel, moisCourant, moisLabelCourt } from '../lib/dates'
import { fcfa, fcfaCourt } from '../lib/money'
import { Statistique, Puce, Bandeau, useToast } from '../components/ui'
import { IconeChevronGauche, IconeChevronDroite, IconePartage } from '../components/icons'

const COULEUR_ACQUIS = '#10b981'
const COULEUR_PLANIFIE = '#6366f1'
const COULEUR_ALERTE = '#e11d48'

export default function PilotagePage({ referentiel, seances }) {
  const { matieres, ecolesById, matieresById, tauxParCle, reglages } = referentiel
  const maxHebdo = Number(reglages.chargeMaxHebdo) || 25
  const maxSoirs = Number(reglages.soireesConsecutivesMax) || 3

  const prev = useMemo(() => previsionnel(seances, { matieres, tauxParCle, depuis: moisCourant(), nbMois: 6 }), [seances, matieres, tauxParCle])
  const semaines = useMemo(
    () => chargeHebdo(seances, { depuis: aujourdhui(), nbSemaines: 8, heureSoir: reglages.heureDebutSoir, maxHebdo, maxSoirs }),
    [seances, reglages.heureDebutSoir, maxHebdo, maxSoirs]
  )
  const donneesMois = prev.mois.map((m) => ({ ...m, label: moisLabelCourt(m.mois) }))
  const donneesSemaines = semaines.map((w) => ({ ...w, label: jourLabel(w.debut, 'd MMM'), heures: Number(w.heures.toFixed(1)) }))
  const surcharges = semaines.filter((w) => w.alertes.length)
  const moyenne = semaines.reduce((t, w) => t + w.heures, 0) / (semaines.length || 1)

  return (
    <div className="space-y-4 px-4 pt-[calc(1rem+var(--safe-top))]">
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-ink-900">Pilotage</h1>
        <p className="text-[12.5px] text-ink-500">Revenus des 6 prochains mois et charge des 8 prochaines semaines</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Statistique label="Acquis" valeur={fcfaCourt(prev.totalAcquis)} detail="séances effectuées" accent="text-emerald-700" />
        <Statistique label="Planifié" valeur={fcfaCourt(prev.totalPlanifie)} detail="sur 6 mois" />
        <Statistique label="À programmer" valeur={fcfaCourt(prev.totalAProgrammer)} detail="heures de quota restantes" />
        <Statistique label="Charge moyenne" valeur={formatDuree(moyenne)} detail={`par semaine · seuil ${maxHebdo} h`} />
      </div>

      <section className="carte p-4">
        <h2 className="mb-3 text-[14px] font-bold text-ink-800">Revenus par mois</h2>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={donneesMois} margin={{ left: -6, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fcfaCourt} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              formatter={(v, n) => [fcfa(v), n]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11.5, color: '#64748b' }} />
            <Bar dataKey="acquis" name="Acquis" stackId="r" fill={COULEUR_ACQUIS} stroke="#fff" strokeWidth={2} barSize={34} />
            <Bar dataKey="planifie" name="Planifié" stackId="r" fill={COULEUR_PLANIFIE} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} barSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {prev.aProgrammer.length > 0 && (
        <section className="carte overflow-hidden">
          <h2 className="px-4 pb-1 pt-4 text-[14px] font-bold text-ink-800">Reste à programmer</h2>
          <p className="px-4 text-[12px] text-ink-500">Heures du volume horaire ni effectuées ni planifiées, au taux de la grille.</p>
          <ul className="mt-1 divide-y divide-ink-100">
            {prev.aProgrammer.map(({ matiere, heures, montant }) => {
              const e = ecolesById.get(matiere.ecoleId)
              return (
                <li key={matiere.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Puce couleur={e?.couleur}>{e?.code}</Puce>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-800">{matiere.nom}</span>
                  <span className="shrink-0 text-[12.5px] tabular text-ink-500">{formatDuree(heures)}</span>
                  <span className="w-24 shrink-0 text-right text-[12.5px] font-semibold tabular text-ink-700">{fcfa(montant)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {surcharges.length > 0 && (
        <Bandeau ton="alerte" titre={`${surcharges.length} semaine${surcharges.length > 1 ? 's' : ''} chargée${surcharges.length > 1 ? 's' : ''}`}>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {surcharges.map((w) => (
              <li key={w.debut}>
                Semaine du {jourLabel(w.debut, 'd MMMM')} : {w.alertes.join(', ')}
              </li>
            ))}
          </ul>
        </Bandeau>
      )}

      <section className="carte p-4">
        <h2 className="mb-3 text-[14px] font-bold text-ink-800">Heures par semaine</h2>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={donneesSemaines} margin={{ left: -14, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              formatter={(v) => [formatDuree(v), 'Heures']}
              labelFormatter={(l) => `Semaine du ${l}`}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <ReferenceLine y={maxHebdo} stroke={COULEUR_ALERTE} strokeDasharray="4 4" label={{ value: `${maxHebdo} h`, position: 'insideTopRight', fontSize: 10.5, fill: '#64748b' }} />
            <Bar dataKey="heures" radius={[4, 4, 0, 0]} barSize={26}>
              {donneesSemaines.map((w) => (
                <Cell key={w.debut} fill={w.alertes.length ? COULEUR_ALERTE : COULEUR_PLANIFIE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="carte overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2 text-left font-semibold">Semaine</th>
              <th className="px-2 py-2 text-right font-semibold">Heures</th>
              <th className="px-2 py-2 text-right font-semibold">Séances</th>
              <th className="px-2 py-2 text-right font-semibold">Soirées</th>
              <th className="px-3 py-2 text-right font-semibold">Plus longue journée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 tabular">
            {semaines.map((w) => (
              <tr key={w.debut} className={w.alertes.length ? 'bg-rose-50/60' : ''}>
                <td className="px-3 py-2 font-medium text-ink-800">
                  {w.alertes.length > 0 && <span aria-label="Surcharge">⚠ </span>}
                  {jourLabel(w.debut, 'd MMM')} – {jourLabel(w.fin, 'd MMM')}
                </td>
                <td className="px-2 py-2 text-right text-ink-700">{formatDuree(w.heures)}</td>
                <td className="px-2 py-2 text-right text-ink-500">{w.nbSeances}</td>
                <td className="px-2 py-2 text-right text-ink-500">
                  {w.nbSoirs}
                  {w.soireesConsecutives > 1 && <span className="text-ink-400"> ({w.soireesConsecutives} d'affilée)</span>}
                </td>
                <td className="px-3 py-2 text-right text-ink-500">{formatDuree(w.journeeMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BilanAnnuel seances={seances} referentiel={{ matieresById, ecolesById, reglages }} />
    </div>
  )
}

function BilanAnnuel({ seances, referentiel }) {
  const { matieresById, ecolesById, reglages } = referentiel
  const toast = useToast()
  const paiements = usePaiements()
  const [type, setType] = useState('civile')
  const auj = aujourdhui()
  // Année universitaire courante : celle qui a commencé en octobre dernier.
  const anneeCourante = type === 'universitaire' && Number(auj.slice(5, 7)) < 10 ? Number(auj.slice(0, 4)) - 1 : Number(auj.slice(0, 4))
  const [decalage, setDecalage] = useState(0)
  const annee = anneeCourante + decalage
  const bilan = useMemo(
    () => bilanAnnuel(seances, paiements, { matieresById, ecolesById, annee, type, delaiJours: Number(reglages.delaiPaiementJours) || 30, aujourdhui: auj }),
    [seances, paiements, matieresById, ecolesById, annee, type, reglages.delaiPaiementJours, auj]
  )
  const t = bilan.totaux

  async function exporter() {
    if (!bilan.ecoles.length) return toast('Aucune activité sur cette période', 'erreur')
    const { pdfBilanAnnuel, partagerOuTelecharger } = await import('../lib/pdf')
    const doc = pdfBilanAnnuel(bilan, { type, enseignant: reglages.enseignant })
    const res = await partagerOuTelecharger(doc, `bilan-${bilan.label}.pdf`, `Bilan ${bilan.label}`)
    toast(res === 'partage' ? 'Bilan partagé' : 'PDF téléchargé')
  }

  return (
    <section className="carte overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h2 className="mr-auto text-[14px] font-bold text-ink-800">Bilan annuel</h2>
        <div className="flex rounded-full bg-ink-100 p-0.5 text-[11.5px] font-semibold">
          {[
            ['civile', 'Civile'],
            ['universitaire', 'Universitaire'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => {
                setType(v)
                setDecalage(0)
              }}
              className={`rounded-full px-2.5 py-1 ${type === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button className="btn-secondaire px-2 py-1.5" onClick={() => setDecalage(decalage - 1)} aria-label="Année précédente">
          <IconeChevronGauche size={16} />
        </button>
        <span className="min-w-[4.5rem] text-center text-[13px] font-bold tabular text-ink-800">{bilan.label}</span>
        <button className="btn-secondaire px-2 py-1.5" onClick={() => setDecalage(decalage + 1)} aria-label="Année suivante" disabled={decalage >= 0}>
          <IconeChevronDroite size={16} />
        </button>
        <button className="btn-secondaire px-2 py-1.5" onClick={exporter} title="Exporter en PDF">
          <IconePartage size={16} />
        </button>
      </div>

      {bilan.ecoles.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-400">Aucune séance effectuée sur cette période.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-4 pt-3 lg:grid-cols-4">
            {[
              ['Rémunération', fcfaCourt(t.montant), `${formatDuree(t.heures)} · ${t.nbSeances} séances`],
              ['Taux moyen', fcfa(t.tauxMoyen), 'par heure effectuée'],
              ['Encaissé', fcfaCourt(t.paye), `sur ${fcfaCourt(t.facture)} facturés`],
              ['Reste à encaisser', fcfaCourt(t.resteAEncaisser), t.enRetard ? `${t.enRetard} facture(s) en retard` : 'aucun retard'],
            ].map(([l, v, d]) => (
              <div key={l} className="rounded-xl bg-ink-50 px-3 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{l}</p>
                <p className="text-[15px] font-bold tabular text-ink-900">{v}</p>
                <p className="text-[11px] text-ink-500">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-3 py-2 text-left font-semibold">École</th>
                  <th className="px-2 py-2 text-right font-semibold">Heures</th>
                  <th className="px-2 py-2 text-right font-semibold">Taux moyen</th>
                  <th className="px-2 py-2 text-right font-semibold">Rémunération</th>
                  <th className="px-2 py-2 text-right font-semibold">Reste dû</th>
                  <th className="px-3 py-2 text-right font-semibold">Délai paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular">
                {bilan.ecoles.map((e) => (
                  <tr key={e.ecoleId}>
                    <td className="px-3 py-2">
                      <Puce couleur={e.couleur}>{e.code}</Puce>
                      <span className="ml-1.5 text-[11px] text-ink-400">
                        {e.nbMatieres} mat. · {e.nbSeances} séances{e.nbAnnulees ? ` · ${e.nbAnnulees} annulée(s)` : ''}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-ink-700">{formatDuree(e.heures)}</td>
                    <td className="px-2 py-2 text-right text-ink-700">{fcfa(e.tauxMoyen)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-ink-800">{fcfa(e.montant)}</td>
                    <td className={`px-2 py-2 text-right ${e.enRetard ? 'font-semibold text-rose-600' : 'text-ink-500'}`}>
                      {e.resteAEncaisser ? fcfa(e.resteAEncaisser) : '—'}
                      {e.enRetard > 0 && <span className="block text-[10.5px]">⚠ {e.enRetard} en retard</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-500">{e.delaiMoyen === null ? '—' : `${e.delaiMoyen} j`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-[11.5px] text-ink-400">
            Rémunération : séances effectuées sur la période. Délai de paiement : moyenne entre émission de la facture et règlement.
          </p>
        </>
      )}
    </section>
  )
}
