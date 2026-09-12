const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 125000 → '125 000 FCFA' */
export const fcfa = (montant) => `${nf.format(Math.round(montant || 0))} FCFA`

/** Version compacte pour les axes de graphiques : 125000 → '125k' */
export const fcfaCourt = (montant) => {
  const n = Math.round(montant || 0)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export const nombre = (n) => nf.format(n || 0)

/** jsPDF ne gère pas les espaces insécables étroits d'Intl. */
export const pourPdf = (texte) => String(texte).replace(/[  ]/g, ' ')
