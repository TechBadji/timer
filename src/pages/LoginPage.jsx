import { useState } from 'react'
import { creerCompte, connecter } from '../lib/auth'
import { Champ, Saisie, Bandeau } from '../components/ui'
import { IconeCheck } from '../components/icons'

export default function LoginPage({ onConnecte }) {
  const [inscription, setInscription] = useState(false)
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  const [enCours, setEnCours] = useState(false)

  const valider = async (e) => {
    e.preventDefault()
    setErreur('')
    setInfo('')
    if (!email.trim() || !motDePasse) {
      setErreur('Email et mot de passe requis')
      return
    }
    if (inscription && motDePasse.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setEnCours(true)
    try {
      if (inscription) {
        await creerCompte(email, motDePasse)
        setInfo('Compte créé. Si une confirmation par email est demandée, cliquez sur le lien reçu puis connectez-vous.')
        setInscription(false)
      } else {
        await connecter(email, motDePasse)
        onConnecte()
      }
    } catch (err) {
      setErreur(err.message || 'Erreur inattendue')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-5 pb-[var(--safe-bottom)] pt-[var(--safe-top)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="font-display text-[56px] font-extrabold leading-none text-ink-900">Timer</h1>
          <p className="mt-2 text-[14px] text-ink-500">
            {inscription ? 'Créez votre compte pour accéder à votre carnet sur tous vos appareils.' : 'Ouvrez votre carnet de cours.'}
          </p>
        </div>

        <form onSubmit={valider} className="carte space-y-3 p-4">
          <Champ label="Email">
            <Saisie
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.com"
              autoComplete="username"
            />
          </Champ>
          <Champ label="Mot de passe" aide={inscription ? 'Au moins 6 caractères' : undefined}>
            <Saisie
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete={inscription ? 'new-password' : 'current-password'}
            />
          </Champ>

          {erreur && <Bandeau ton="erreur">{erreur}</Bandeau>}
          {info && <Bandeau ton="succes">{info}</Bandeau>}

          <button type="submit" disabled={enCours} className="btn-primaire w-full disabled:opacity-60">
            <IconeCheck size={16} /> {inscription ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>

        <button
          className="mt-3 w-full text-center text-[13px] font-semibold text-brand-600"
          onClick={() => {
            setInscription((v) => !v)
            setErreur('')
            setInfo('')
          }}
        >
          {inscription ? 'J’ai déjà un compte — me connecter' : 'Pas encore de compte — en créer un'}
        </button>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-400">
          Vos données sont stockées sur votre base Supabase, accessibles depuis tous vos appareils.
        </p>
      </div>
    </div>
  )
}
