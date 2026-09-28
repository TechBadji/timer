import { useState } from 'react'
import { compteExiste, creerCompte, verifierIdentifiants, ouvrirSession } from '../lib/auth'
import { Champ, Saisie, Bandeau } from '../components/ui'
import { IconeCheck } from '../components/icons'

export default function LoginPage({ premierAcces, onConnecte }) {
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  const valider = async (e) => {
    e.preventDefault()
    setErreur('')
    if (!identifiant.trim() || !motDePasse) {
      setErreur('Identifiant et mot de passe requis')
      return
    }
    if (premierAcces) {
      if (motDePasse.length < 4) {
        setErreur('Le mot de passe doit contenir au moins 4 caractères')
        return
      }
      if (motDePasse !== confirmation) {
        setErreur('Les mots de passe ne correspondent pas')
        return
      }
    }
    setEnCours(true)
    try {
      if (premierAcces) {
        await creerCompte(identifiant, motDePasse)
        ouvrirSession(identifiant.trim())
        onConnecte()
      } else {
        const ok = await verifierIdentifiants(identifiant, motDePasse)
        if (!ok) {
          setErreur('Identifiant ou mot de passe incorrect')
          setEnCours(false)
          return
        }
        ouvrirSession(identifiant.trim())
        onConnecte()
      }
    } catch (err) {
      setErreur(err.message || 'Erreur inattendue')
      setEnCours(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-5 pb-[var(--safe-bottom)] pt-[var(--safe-top)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="font-display text-[56px] font-extrabold leading-none text-ink-900">Timer</h1>
          <p className="mt-2 text-[14px] text-ink-500">
            {premierAcces ? 'Choisissez un identifiant et un mot de passe pour protéger votre carnet.' : 'Ouvrez votre carnet de cours.'}
          </p>
        </div>

        <form onSubmit={valider} className="carte space-y-3 p-4">
          <Champ label="Identifiant">
            <Saisie
              autoFocus
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              placeholder="ex : elias"
              autoComplete="username"
            />
          </Champ>
          <Champ label="Mot de passe">
            <Saisie
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete={premierAcces ? 'new-password' : 'current-password'}
            />
          </Champ>
          {premierAcces && (
            <Champ label="Confirmer le mot de passe">
              <Saisie
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </Champ>
          )}

          {erreur && <Bandeau ton="erreur">{erreur}</Bandeau>}

          <button type="submit" disabled={enCours} className="btn-primaire w-full disabled:opacity-60">
            <IconeCheck size={16} /> {premierAcces ? 'Créer mon accès' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-400">
          Vos données restent sur cet appareil.
        </p>
      </div>
    </div>
  )
}
