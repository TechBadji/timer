import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend, Cell } from 'recharts'
import { previsionnel, chargeHebdo } from '../lib/pilotage'
import { aujourdhui, formatDuree, jourLabel, moisCourant, moisLabelCourt } from '../lib/dates'
import { fcfa, fcfaCourt } from '../lib/money'
import { Statistique, Puce, Bandeau } from '../components/ui'

const COULEUR_ACQUIS = '#10b981'
const COULEUR_PLANIFIE = '#6366f1'
const COULEUR_ALERTE = '#e11d48'

export default function PilotagePage({ referentiel, seances }) {
  const { matieres, ecolesById, tauxParCle, reglages } = referentiel
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
    </div>
  )
}
