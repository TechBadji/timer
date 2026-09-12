import { useEffect, useMemo, useState } from 'react'
import { MODES, STATUTS_SEANCE } from '../data/constants'
import { creerSeance, majSeance, supprimerSeance, supprimerSerie } from '../data/repo'
import { conflitsDe } from '../lib/conflicts'
import { dureeHeures, enHeure, enMinutes, formatDuree, jourLabel } from '../lib/dates'
import { fcfa } from '../lib/money'
import { progression } from '../lib/stats'
import { Modale, Champ, Saisie, Liste, Segments, Zone, Bandeau, Puce, useToast } from './ui'
import { IconePoubelle } from './icons'
import MatiereForm from './MatiereForm'

const DUREES = [1, 1.5, 2, 3, 4]

export default function SeanceForm({ ouvert, onFermer, seance, defauts, referentiel, seances, onSupprimee }) {
  const { ecoles, matieres, ecolesById, matieresById, tauxParCle, reglages } = referentiel
  const toast = useToast()
  const [f, setF] = useState({})
  const [erreurs, setErreurs] = useState({})
  const [repeter, setRepeter] = useState(false)
  const [nbSemaines, setNbSemaines] = useState(11)
  const [formMatiere, setFormMatiere] = useState(false)
  const [confirmerSuppr, setConfirmerSuppr] = useState(false)

  const matieresActives = useMemo(
    () => matieres.filter((m) => m.statut !== 'terminee' || m.id === seance?.matiereId),
    [matieres, seance]
  )

  useEffect(() => {
    if (!ouvert) return
    setErreurs({})
    setRepeter(false)
    setConfirmerSuppr(false)
    if (seance) {
      setF({ ...seance })
    } else {
      const m = matieresActives[0]
      setF({
        matiereId: m?.id ?? '',
        date: defauts?.date,
        debut: defauts?.debut || '08:00',
        fin: defauts?.fin || enHeure(enMinutes(defauts?.debut || '08:00') + 120),
        mode: m?.modeParDefaut || 'presentiel',
        lieu: m?.lieuParDefaut || '',
        lien: m?.lienParDefaut || '',
        statut: 'planifie',
        notes: '',
      })
    }
  }, [ouvert, seance, defauts])

  const matiere = matieresById.get(Number(f.matiereId))
  const ecole = ecolesById.get(matiere?.ecoleId)
  const taux = seance?.tauxHoraire ?? (matiere ? tauxParCle.get(`${matiere.ecoleId}|${matiere.niveau}`) ?? 0 : 0)
  const duree = f.debut && f.fin ? dureeHeures(f.debut, f.fin) : 0
  const montant = duree * taux

  const conflits = useMemo(() => {
    if (!f.date || !f.debut || !f.fin) return []
    return conflitsDe({ ...f, id: seance?.id, matiereId: Number(f.matiereId) }, seances, {
      matieresById,
      ecolesById,
      trajetMinutes: reglages.trajetMinutes,
    })
  }, [f, seance, seances, matieresById, ecolesById, reglages.trajetMinutes])

  const avancement = matiere ? progression(matiere, seances, reglages.seuilAlerteQuota) : null
  const depasseraitQuota =
    avancement && !seance && avancement.quota > 0 && avancement.faites + avancement.planifiees + duree > avancement.quota

  const maj = (champ) => (v) =>
    setF((p) => {
      const suivant = { ...p, [champ]: v }
      // Décaler la fin quand on avance le début, en conservant la durée.
      if (champ === 'debut' && p.debut && p.fin) {
        const d = enMinutes(p.fin) - enMinutes(p.debut)
        if (d > 0) suivant.fin = enHeure(enMinutes(v) + d)
      }
      if (champ === 'matiereId') {
        const m = matieresById.get(Number(v))
        if (m && !seance) {
          suivant.mode = m.modeParDefaut || 'presentiel'
          suivant.lieu = m.lieuParDefaut || ''
          suivant.lien = m.lienParDefaut || ''
        }
      }
      return suivant
    })

  const appliquerDuree = (h) => setF((p) => ({ ...p, fin: enHeure(enMinutes(p.debut) + h * 60) }))

  async function enregistrer() {
    const e = {}
    if (!f.matiereId) e.matiereId = 'Choisissez une matière'
    if (!f.date) e.date = 'Date requise'
    if (enMinutes(f.fin) <= enMinutes(f.debut)) e.fin = "L'heure de fin doit suivre l'heure de début"
    setErreurs(e)
    if (Object.keys(e).length) return

    if (seance) {
      await majSeance(seance.id, {
        matiereId: Number(f.matiereId),
        date: f.date,
        debut: f.debut,
        fin: f.fin,
        mode: f.mode,
        lieu: f.mode === 'ligne' ? '' : f.lieu,
        lien: f.mode === 'ligne' ? f.lien : '',
        statut: f.statut,
        notes: f.notes,
      })
      toast('Séance mise à jour')
    } else {
      const ids = await creerSeance(f, { repetitions: repeter ? Number(nbSemaines) : 0 })
      toast(repeter ? `${ids.length} séances créées` : 'Séance ajoutée')
    }
    onFermer()
  }

  async function supprimer(toutLaSerie) {
    if (toutLaSerie && seance.serieId) {
      const n = await supprimerSerie(seance.serieId, seance.date)
      toast(`${n} séances supprimées`, 'info')
    } else {
      await supprimerSeance(seance.id)
      toast('Séance supprimée', 'info')
    }
    onSupprimee?.()
    onFermer()
  }

  return (
    <>
      <Modale
        ouvert={ouvert}
        onFermer={onFermer}
        titre={seance ? 'Modifier le cours' : 'Nouveau cours'}
        sousTitre={f.date ? jourLabel(f.date) : undefined}
        pied={
          <div className="flex items-center gap-2">
            {seance && (
              <button className="btn-danger px-3" onClick={() => setConfirmerSuppr(true)} aria-label="Supprimer">
                <IconePoubelle />
              </button>
            )}
            <button className="btn-secondaire flex-1" onClick={onFermer}>
              Annuler
            </button>
            <button className="btn-primaire flex-[2]" onClick={enregistrer}>
              {seance ? 'Enregistrer' : 'Ajouter au calendrier'}
            </button>
          </div>
        }
      >
        {confirmerSuppr && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
            <p className="text-[13px] font-semibold text-rose-800">Supprimer cette séance ?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn bg-rose-600 px-3 py-2 text-[13px] text-white" onClick={() => supprimer(false)}>
                Cette séance
              </button>
              {seance?.serieId && (
                <button className="btn bg-rose-600 px-3 py-2 text-[13px] text-white" onClick={() => supprimer(true)}>
                  Celle-ci et les suivantes
                </button>
              )}
              <button className="btn-secondaire px-3 py-2 text-[13px]" onClick={() => setConfirmerSuppr(false)}>
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Champ label="Matière" erreur={erreurs.matiereId}>
            <div className="flex gap-2">
              <Liste className="flex-1" value={f.matiereId ?? ''} onChange={(e) => maj('matiereId')(e.target.value)}>
                <option value="">—</option>
                {ecoles.map((ec) => {
                  const lot = matieresActives.filter((m) => m.ecoleId === ec.id)
                  if (!lot.length) return null
                  return (
                    <optgroup key={ec.id} label={ec.code}>
                      {lot.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom} · {m.niveau}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </Liste>
              <button type="button" className="btn-secondaire px-3" onClick={() => setFormMatiere(true)} title="Nouvelle matière">
                +
              </button>
            </div>
          </Champ>

          {matiere && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5">
              <Puce couleur={ecole?.couleur}>{ecole?.code}</Puce>
              <Puce className="bg-ink-200/60 text-ink-600">{matiere.niveau}</Puce>
              <span className="ml-auto text-[12px] font-semibold tabular text-ink-600">
                {taux ? `${taux.toLocaleString('fr-FR')} FCFA/h` : 'Taux non défini'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Champ label="Date" erreur={erreurs.date} className="col-span-2">
              <Saisie type="date" value={f.date ?? ''} onChange={(e) => maj('date')(e.target.value)} />
            </Champ>
            <Champ label="Début">
              <Saisie type="time" step="900" value={f.debut ?? ''} onChange={(e) => maj('debut')(e.target.value)} />
            </Champ>
            <Champ label="Fin" erreur={erreurs.fin}>
              <Saisie type="time" step="900" value={f.fin ?? ''} onChange={(e) => maj('fin')(e.target.value)} />
            </Champ>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DUREES.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => appliquerDuree(h)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${
                  Math.abs(duree - h) < 0.01 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {formatDuree(h)}
              </button>
            ))}
            {duree > 0 && (
              <span className="ml-auto self-center text-[12px] font-semibold tabular text-ink-500">
                {formatDuree(duree)} · {fcfa(montant)}
              </span>
            )}
          </div>

          <Champ label="Mode">
            <Segments valeur={f.mode} onChange={maj('mode')} options={MODES.map((m) => ({ valeur: m.valeur, label: `${m.icone} ${m.label}` }))} />
          </Champ>

          {f.mode === 'ligne' ? (
            <Champ label="Lien de visio">
              <Saisie type="url" value={f.lien ?? ''} onChange={(e) => maj('lien')(e.target.value)} placeholder="https://meet.google.com/…" />
            </Champ>
          ) : (
            <Champ label="Salle / lieu">
              <Saisie value={f.lieu ?? ''} onChange={(e) => maj('lieu')(e.target.value)} placeholder="Salle B2, campus Liberté 6" />
            </Champ>
          )}

          {seance && (
            <Champ label="Statut">
              <Segments valeur={f.statut} onChange={maj('statut')} options={STATUTS_SEANCE.map((s) => ({ valeur: s.valeur, label: s.label }))} />
            </Champ>
          )}

          {!seance && (
            <div className="rounded-xl border border-ink-200 p-3.5">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={repeter}
                  onChange={(e) => setRepeter(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-[14px] font-medium text-ink-700">Cours récurrent (chaque semaine)</span>
              </label>
              {repeter && (
                <div className="mt-3 flex items-center gap-2">
                  <Saisie
                    type="number"
                    min="1"
                    max="52"
                    value={nbSemaines}
                    onChange={(e) => setNbSemaines(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-[13px] text-ink-500">
                    semaines supplémentaires — {Number(nbSemaines) + 1} séances, {formatDuree(duree * (Number(nbSemaines) + 1))} au total
                  </span>
                </div>
              )}
            </div>
          )}

          <Champ label="Notes (facultatif)">
            <Zone rows={2} value={f.notes ?? ''} onChange={(e) => maj('notes')(e.target.value)} placeholder="Chapitre, TP, évaluation…" />
          </Champ>

          {conflits.length > 0 && (
            <Bandeau ton={conflits.some((c) => c.gravite === 'erreur') ? 'erreur' : 'alerte'} titre="Conflit détecté">
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                {conflits.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </Bandeau>
          )}

          {depasseraitQuota && (
            <Bandeau ton="alerte" titre="Quota dépassé">
              Avec cette séance, {matiere.nom} atteindrait {formatDuree(avancement.faites + avancement.planifiees + duree)} sur un quota de{' '}
              {formatDuree(avancement.quota)}.
            </Bandeau>
          )}

          {avancement?.quota > 0 && !depasseraitQuota && (
            <p className="text-[12px] text-ink-500">
              {matiere.nom} : {formatDuree(avancement.faites)} effectuées sur {formatDuree(avancement.quota)} ({Math.round(avancement.pct)} %)
            </p>
          )}
        </div>
      </Modale>

      <MatiereForm
        ouvert={formMatiere}
        onFermer={() => setFormMatiere(false)}
        ecoles={ecoles}
        tauxParCle={tauxParCle}
        onEnregistre={(id) => setF((p) => ({ ...p, matiereId: id }))}
      />
    </>
  )
}
