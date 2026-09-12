// Lectures réactives : chaque écriture Dexie rafraîchit automatiquement l'UI.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, lireReglages } from './db'
import { REGLAGES_DEFAUT } from './constants'
import { bornesMois, decalerJours } from '../lib/dates'

export const useEcoles = () => useLiveQuery(() => db.ecoles.orderBy('ordre').toArray(), [], [])

export const useMatieres = () => useLiveQuery(() => db.matieres.toArray(), [], [])

export const useTarifs = () => useLiveQuery(() => db.tarifs.toArray(), [], [])

export const useReglages = () => useLiveQuery(() => lireReglages(), [], REGLAGES_DEFAUT)

export const usePaiements = () => useLiveQuery(() => db.paiements.toArray(), [], [])

export const useSeances = () => useLiveQuery(() => db.seances.toArray(), [], [])

/** Séances entre deux dates ISO incluses. */
export const useSeancesEntre = (debut, fin) =>
  useLiveQuery(
    () => (debut && fin ? db.seances.where('date').between(debut, decalerJours(fin, 1), true, false).toArray() : []),
    [debut, fin],
    []
  )

export const useSeancesMois = (mois) => {
  const { debut, fin } = bornesMois(mois)
  return useSeancesEntre(debut, fin)
}

/** Index par identifiant, mémoïsés — évite les recherches linéaires dans les rendus. */
export const useIndex = (liste) =>
  useMemo(() => new Map((liste || []).map((x) => [x.id, x])), [liste])

/** Contexte complet du référentiel, utilisé par les calculs et les formulaires. */
export function useReferentiel() {
  const ecoles = useEcoles()
  const matieres = useMatieres()
  const tarifs = useTarifs()
  const reglages = useReglages()
  const ecolesById = useIndex(ecoles)
  const matieresById = useIndex(matieres)
  const tauxParCle = useMemo(
    () => new Map((tarifs || []).map((t) => [`${t.ecoleId}|${t.niveau}`, t.taux])),
    [tarifs]
  )
  return { ecoles, matieres, tarifs, reglages, ecolesById, matieresById, tauxParCle }
}
