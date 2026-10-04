// Classes d'une matière : une même matière peut être dispensée à plusieurs
// classes à la fois (ex. ISM : « L3 IA, L3 GLRS, L3 IAGE, L3 ETSE »).

/** « L3 IA, L3 GLRS ; l3 ia » → ['L3 IA', 'L3 GLRS'] (sans vides ni doublons). */
export function analyserClasses(texte) {
  const vues = new Set()
  const classes = []
  for (const brut of String(texte || '').split(/[,;\n]/)) {
    const c = brut.trim().replace(/\s+/g, ' ')
    const cle = c.toLowerCase()
    if (!c || vues.has(cle)) continue
    vues.add(cle)
    classes.push(c)
  }
  return classes
}

/** Libellé court des classes d'une matière ('' si aucune). */
export const libelleClasses = (matiere, separateur = ', ') => (matiere?.classes || []).join(separateur)
