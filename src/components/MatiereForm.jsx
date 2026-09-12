import { useEffect, useState } from 'react'
import { NIVEAUX, MODES } from '../data/constants'
import { creerMatiere, majMatiere } from '../data/repo'
import { Modale, Champ, Saisie, Liste, Segments, Zone, useToast } from './ui'

const VIDE = { nom: '', ecoleId: '', niveau: 'Licence', volumeHoraire: '', modeParDefaut: 'presentiel', lieuParDefaut: '', lienParDefaut: '', note: '' }

export default function MatiereForm({ ouvert, onFermer, matiere, ecoles, tauxParCle, onEnregistre }) {
  const [f, setF] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const toast = useToast()

  useEffect(() => {
    if (!ouvert) return
    setErreurs({})
    setF(
      matiere
        ? { ...VIDE, ...matiere, volumeHoraire: String(matiere.volumeHoraire ?? '') }
        : { ...VIDE, ecoleId: ecoles[0]?.id ?? '' }
    )
  }, [ouvert, matiere, ecoles])

  const maj = (champ) => (v) => setF((p) => ({ ...p, [champ]: v }))
  const taux = tauxParCle?.get(`${Number(f.ecoleId)}|${f.niveau}`) ?? 0

  async function enregistrer() {
    const e = {}
    if (!f.nom.trim()) e.nom = 'Le nom est obligatoire'
    if (!f.ecoleId) e.ecoleId = 'Choisissez une école'
    if (!(Number(f.volumeHoraire) > 0)) e.volumeHoraire = 'Indiquez le volume horaire prévu'
    setErreurs(e)
    if (Object.keys(e).length) return

    if (matiere) {
      await majMatiere(matiere.id, {
        nom: f.nom.trim(),
        ecoleId: Number(f.ecoleId),
        niveau: f.niveau,
        volumeHoraire: Number(f.volumeHoraire),
        modeParDefaut: f.modeParDefaut,
        lieuParDefaut: f.lieuParDefaut,
        lienParDefaut: f.lienParDefaut,
        note: f.note,
      })
      toast('Matière mise à jour')
      onEnregistre?.(matiere.id)
    } else {
      const id = await creerMatiere(f)
      toast('Matière créée')
      onEnregistre?.(id)
    }
    onFermer()
  }

  return (
    <Modale
      ouvert={ouvert}
      onFermer={onFermer}
      titre={matiere ? 'Modifier la matière' : 'Nouvelle matière'}
      sousTitre="Nom, école, niveau et volume horaire à réaliser"
      pied={
        <div className="flex gap-2">
          <button className="btn-secondaire flex-1" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn-primaire flex-1" onClick={enregistrer}>
            {matiere ? 'Enregistrer' : 'Créer la matière'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Champ label="Intitulé de la matière" erreur={erreurs.nom}>
          <Saisie value={f.nom} onChange={(e) => maj('nom')(e.target.value)} placeholder="Réseaux informatiques" autoFocus />
        </Champ>

        <div className="grid grid-cols-2 gap-3">
          <Champ label="École" erreur={erreurs.ecoleId}>
            <Liste value={f.ecoleId} onChange={(e) => maj('ecoleId')(e.target.value)}>
              <option value="">—</option>
              {ecoles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ label="Niveau">
            <Segments valeur={f.niveau} onChange={maj('niveau')} options={NIVEAUX.map((n) => ({ valeur: n, label: n }))} />
          </Champ>
        </div>

        <Champ
          label="Volume horaire prévu (heures)"
          erreur={erreurs.volumeHoraire}
          aide={taux ? `Taux appliqué : ${taux.toLocaleString('fr-FR')} FCFA/h` : 'Aucun taux défini pour ce couple école + niveau'}
        >
          <Saisie
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={f.volumeHoraire}
            onChange={(e) => maj('volumeHoraire')(e.target.value)}
            placeholder="40"
          />
        </Champ>

        <Champ label="Mode habituel" aide="Pré-rempli à chaque nouvelle séance de cette matière">
          <Segments valeur={f.modeParDefaut} onChange={maj('modeParDefaut')} options={MODES.map((m) => ({ valeur: m.valeur, label: m.label }))} />
        </Champ>

        {f.modeParDefaut === 'presentiel' ? (
          <Champ label="Salle habituelle">
            <Saisie value={f.lieuParDefaut} onChange={(e) => maj('lieuParDefaut')(e.target.value)} placeholder="Salle B2" />
          </Champ>
        ) : (
          <Champ label="Lien de visio habituel">
            <Saisie value={f.lienParDefaut} onChange={(e) => maj('lienParDefaut')(e.target.value)} placeholder="https://meet.google.com/…" />
          </Champ>
        )}

        <Champ label="Note (facultatif)">
          <Zone rows={2} value={f.note} onChange={(e) => maj('note')(e.target.value)} placeholder="Programme, contacts, remarques…" />
        </Champ>
      </div>
    </Modale>
  )
}
