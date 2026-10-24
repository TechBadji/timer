// Bibliothèque de supports : liens vers slides, TP, dépôts de code, vidéos.

export const TYPES_SUPPORT = {
  slides: { label: 'Slides', icone: '📊' },
  doc: { label: 'Document', icone: '📄' },
  code: { label: 'Code', icone: '💻' },
  video: { label: 'Vidéo', icone: '🎬' },
  lien: { label: 'Lien', icone: '🔗' },
}

/** Ajoute https:// si l'adresse a été saisie sans protocole. */
export const normaliserUrl = (url) => {
  const u = String(url || '').trim()
  return !u || /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`
}

export const urlValide = (url) => {
  try {
    return ['http:', 'https:'].includes(new URL(normaliserUrl(url)).protocol)
  } catch {
    return false
  }
}

/** Type deviné d'après l'adresse (hébergeur ou extension). */
export function typeSupport(url) {
  const u = String(url).toLowerCase()
  if (/github\.com|gitlab\.|bitbucket\.org|replit\.com|codesandbox\.io|colab\.research/.test(u)) return 'code'
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(u)) return 'video'
  if (/docs\.google\.com\/presentation|\.pptx?(\?|$)|canva\.com|slides\.com|prezi\.com/.test(u)) return 'slides'
  if (/docs\.google\.com|notion\.so|\.pdf(\?|$)|\.docx?(\?|$)|drive\.google\.com|onedrive|sharepoint/.test(u)) return 'doc'
  return 'lien'
}

/** Titre par défaut : dernier segment lisible de l'adresse, sinon le domaine. */
export function titreDepuisUrl(url) {
  try {
    const u = new URL(url)
    const segment = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
    return segment && !/^(edit|view|preview)$/i.test(segment) && segment.length < 60 ? segment : u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Supports d'une matière groupés : d'abord ceux de toute la matière, puis par numéro de séance. */
export function grouperSupports(supports, matiereId) {
  const siens = supports.filter((s) => s.matiereId === matiereId)
  const groupes = new Map()
  for (const s of siens.sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0) || String(a.creeLe).localeCompare(String(b.creeLe)))) {
    const cle = s.rang ?? 0
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle).push(s)
  }
  return [...groupes].map(([rang, liste]) => ({ rang: rang || null, supports: liste }))
}

/** Supports à avoir sous la main pour une séance donnée (son numéro + ceux de toute la matière). */
export const supportsDeSeance = (supports, matiereId, rang) =>
  supports.filter((s) => s.matiereId === matiereId && (s.rang === rang || s.rang == null)).sort((a, b) => (b.rang ?? 0) - (a.rang ?? 0))
