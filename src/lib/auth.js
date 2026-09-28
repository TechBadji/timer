// Authentification Supabase — un compte email + mot de passe par enseignant,
// valable sur tous ses appareils. Le mot de passe n'est jamais géré par le code
// applicatif : Supabase le hache et le vérifie côté serveur.
import { supabase } from '../data/supabase'

export async function creerCompte(email, motDePasse) {
  const { error } = await supabase.auth.signUp({ email: email.trim(), password: motDePasse })
  if (error) throw new Error(traduire(error))
}

export async function connecter(email, motDePasse) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: motDePasse })
  if (error) throw new Error(traduire(error))
}

export async function fermerSession() {
  await supabase.auth.signOut()
}

export async function sessionActuelle() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export function onChangementSession(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_evenement, session) => callback(session))
  return () => subscription.unsubscribe()
}

export async function changerMotDePasse(motDePasseActuel, nouveauMotDePasse) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email, password: motDePasseActuel })
  if (e1) throw new Error('Mot de passe actuel incorrect')
  const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse })
  if (error) throw new Error(traduire(error))
}

function traduire(error) {
  const m = error.message || ''
  if (/already registered/i.test(m)) return 'Un compte existe déjà avec cet email'
  if (/invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect'
  if (/password.*(least|character)/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères'
  if (/invalid email/i.test(m)) return 'Adresse email invalide'
  if (/email not confirmed/i.test(m)) return 'Confirmez votre email avant de vous connecter (lien envoyé par Supabase)'
  return m || 'Erreur inattendue'
}
