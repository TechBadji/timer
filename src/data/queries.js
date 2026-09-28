// Lectures réactives : chargement initial puis abonnement Realtime Supabase —
// toute écriture (même depuis un autre appareil connecté au même compte)
// rafraîchit automatiquement l'UI.
import { useEffect, useMemo, useState } from 'react'
import { supabase, versObjets, lireReglages } from './supabase'
import { REGLAGES_DEFAUT } from './constants'
import { bornesMois, decalerJours } from '../lib/dates'

/**
 * Charge une table et se ré-abonne à ses changements. `cle` fait partie de la
 * dépendance de l'effet : un filtre différent relance le chargement.
 */
function useTable(table, { ordre, colonne, valeur } = {}, deps = []) {
  const [lignes, setLignes] = useState(null)

  useEffect(() => {
    let vivant = true
    async function charger() {
      let requete = supabase.from(table).select('*')
      if (colonne) requete = requete.eq(colonne, valeur)
      if (ordre) requete = requete.order(ordre)
      const { data, error } = await requete
      if (!vivant) return
      if (error) {
        console.error(`Lecture ${table} :`, error.message)
        return
      }
      setLignes(versObjets(data))
    }
    charger()
    const canal = supabase
      .channel(`${table}-${colonne || 'all'}-${valeur || ''}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, charger)
      .subscribe()
    return () => {
      vivant = false
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ordre, colonne, valeur, ...deps])

  return lignes || []
}

export const useEcoles = () => useTable('ecoles', { ordre: 'ordre' })

export const useMatieres = () => useTable('matieres')

export const useTarifs = () => useTable('tarifs')

export const usePaiements = () => useTable('paiements')

export const useSeances = () => useTable('seances')

export function useReglages() {
  const [reglages, setReglages] = useState(REGLAGES_DEFAUT)
  useEffect(() => {
    let vivant = true
    const charger = () => lireReglages().then((r) => vivant && setReglages(r))
    charger()
    const canal = supabase
      .channel('reglages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reglages' }, charger)
      .subscribe()
    return () => {
      vivant = false
      supabase.removeChannel(canal)
    }
  }, [])
  return reglages
}

/** Séances entre deux dates ISO incluses. */
export const useSeancesEntre = (debut, fin) => {
  const toutes = useSeances()
  return useMemo(() => {
    if (!debut || !fin) return []
    const finExclue = decalerJours(fin, 1)
    return toutes.filter((s) => s.date >= debut && s.date < finExclue)
  }, [toutes, debut, fin])
}

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
