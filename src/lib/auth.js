// Verrou d'accès local : un seul compte (identifiant + mot de passe), hachage
// PBKDF2-SHA256 salé via Web Crypto. Aucun serveur : c'est un verrou d'écran
// pour éviter qu'une personne qui prend l'appareil en main ouvre l'app, pas une
// authentification réseau. La session est mémorisée 30 jours dans localStorage.
import { db } from '../data/db'

const ITERATIONS = 150000
const CLE_SESSION = 'timer.session'
const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000

const versHex = (buf) => Array.from(new Uint8Array(buf)).map((o) => o.toString(16).padStart(2, '0')).join('')
const depuisHex = (hex) => {
  const octets = new Uint8Array(hex.length / 2)
  for (let i = 0; i < octets.length; i++) octets[i] = parseInt(hex.substr(i * 2, 2), 16)
  return octets
}

async function derivHachage(motDePasse, selOctets) {
  const materiau = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: selOctets, iterations: ITERATIONS, hash: 'SHA-256' }, materiau, 256)
  return versHex(bits)
}

export async function compteExiste() {
  return (await db.comptes.count()) > 0
}

export async function creerCompte(identifiant, motDePasse) {
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const hachage = await derivHachage(motDePasse, sel)
  await db.comptes.clear()
  await db.comptes.add({ identifiant: identifiant.trim(), sel: versHex(sel), hachage })
}

export async function verifierIdentifiants(identifiant, motDePasse) {
  const compte = await db.comptes.toCollection().first()
  if (!compte || compte.identifiant.toLowerCase() !== identifiant.trim().toLowerCase()) return false
  return (await derivHachage(motDePasse, depuisHex(compte.sel))) === compte.hachage
}

export async function changerMotDePasse(motDePasseActuel, nouveauMotDePasse) {
  const compte = await db.comptes.toCollection().first()
  if (!compte) throw new Error('Aucun compte configuré')
  if (!(await verifierIdentifiants(compte.identifiant, motDePasseActuel))) throw new Error('Mot de passe actuel incorrect')
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const hachage = await derivHachage(nouveauMotDePasse, sel)
  await db.comptes.update(compte.id, { sel: versHex(sel), hachage })
}

export function ouvrirSession(identifiant) {
  localStorage.setItem(CLE_SESSION, JSON.stringify({ identifiant, expire: Date.now() + DUREE_SESSION_MS }))
}

export function sessionValide() {
  try {
    const { expire } = JSON.parse(localStorage.getItem(CLE_SESSION) || 'null') || {}
    return typeof expire === 'number' && Date.now() < expire
  } catch {
    return false
  }
}

export function identifiantSession() {
  try {
    return JSON.parse(localStorage.getItem(CLE_SESSION) || 'null')?.identifiant || null
  } catch {
    return null
  }
}

export function fermerSession() {
  localStorage.removeItem(CLE_SESSION)
}
