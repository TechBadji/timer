// Exports PDF : emploi du temps (semaine/mois) et récapitulatif mensuel.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fcfa, pourPdf } from './money'
import { formatDuree, jourLabel, moisLabel } from './dates'
import { heuresDe, montantDe } from './stats'

const INDIGO = [79, 70, 229]
const ARDOISE = [100, 116, 139]
const T = (v) => pourPdf(v ?? '')

function nouveauDoc() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  doc.setFont('helvetica', 'normal')
  return doc
}

function entete(doc, titre, sousTitre, enseignant) {
  doc.setFillColor(...INDIGO)
  doc.rect(0, 0, 210, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(T(titre), 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(T(sousTitre), 14, 20)
  if (enseignant) doc.text(T(enseignant), 196, 20, { align: 'right' })
  doc.setFontSize(11)
  doc.text('Timer', 196, 13, { align: 'right' })
  doc.setTextColor(15, 23, 42)
}

function piedDePage(doc) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...ARDOISE)
    doc.text(T(`Généré par Timer le ${new Date().toLocaleDateString('fr-FR')} — Dakar (GMT)`), 14, 289)
    doc.text(`${i} / ${total}`, 196, 289, { align: 'right' })
  }
}

const hexRgb = (hex) => {
  const h = String(hex || '#64748b').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Emploi du temps sur une période : une ligne par séance, regroupée par jour. */
export function pdfEmploiDuTemps(seances, { matieresById, ecolesById, titre, periode, enseignant }) {
  const doc = nouveauDoc()
  entete(doc, T(titre), T(periode), enseignant)

  const lignes = seances
    .slice()
    .sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut))
    .map((s) => {
      const m = matieresById.get(s.matiereId)
      const e = ecolesById.get(m?.ecoleId)
      return {
        couleur: e?.couleur,
        cells: [
          jourLabel(s.date, 'EEE dd/MM'),
          `${s.debut} – ${s.fin}`,
          e?.code || '—',
          `${m?.nom || '—'}\n${m?.niveau || ''}`,
          s.mode === 'ligne' ? 'En ligne' : 'Présentiel',
          s.mode === 'ligne' ? s.lien || '—' : s.lieu || '—',
        ],
      }
    })

  autoTable(doc, {
    startY: 34,
    head: [['Jour', 'Horaire', 'École', 'Matière / Niveau', 'Mode', 'Lieu / Lien']],
    body: lignes.map((l) => l.cells.map(T)),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 24 },
      2: { cellWidth: 22, fontStyle: 'bold' },
      4: { cellWidth: 20 },
      5: { cellWidth: 42 },
    },
    // Pastille de couleur de l'école dans la colonne "École"
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const c = hexRgb(lignes[data.row.index]?.couleur)
        data.cell.styles.textColor = c
      }
    },
  })

  const totalH = seances.reduce((t, s) => t + heuresDe(s), 0)
  const y = doc.lastAutoTable.finalY + 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(T(`${seances.length} séance(s) — ${formatDuree(totalH)} au total`), 14, y)
  piedDePage(doc)
  return doc
}

/** Récapitulatif mensuel complet : totaux, répartitions et détail des séances. */
export function pdfRecapMensuel(recap, { ecolesById, enseignant, precedent, paiementsParEcole }) {
  const doc = nouveauDoc()
  entete(doc, `Récapitulatif ${moisLabel(recap.mois)}`, 'Heures et rémunération', enseignant)

  // Bandeau de synthèse
  const cartes = [
    ['Heures totales', formatDuree(recap.heures)],
    ['Dont effectuées', formatDuree(recap.heuresFaites)],
    ['Séances', String(recap.nbSeances)],
    ['Montant total', fcfa(recap.montant)],
  ]
  let x = 14
  cartes.forEach(([label, valeur]) => {
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, 32, 44, 18, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setTextColor(...ARDOISE)
    doc.setFont('helvetica', 'normal')
    doc.text(T(label), x + 4, 38.5)
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(T(valeur), x + 4, 45.5)
    x += 46
  })

  const corpsEcoles = recap.parEcole.map((e) => {
    const p = paiementsParEcole?.get(e.ecoleId)
    return [
      e.code,
      formatDuree(e.heures),
      formatDuree(e.heuresFaites),
      String(e.nb),
      fcfa(e.montant),
      p?.statut === 'paye' ? 'Payé' : 'En attente',
    ].map(T)
  })

  autoTable(doc, {
    startY: 56,
    head: [['École', 'Heures', 'Effectuées', 'Séances', 'Montant', 'Paiement']],
    body: corpsEcoles,
    foot: [[
      'Total',
      formatDuree(recap.heures),
      formatDuree(recap.heuresFaites),
      String(recap.nbSeances),
      fcfa(recap.montant),
      '',
    ].map(T)],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4 },
    headStyles: { fillColor: INDIGO, textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = hexRgb(recap.parEcole[data.row.index]?.couleur)
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Répartitions niveau / mode
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Répartition', 'Heures', 'Montant']],
    body: [
      ...recap.parNiveau.map((n) => [n.niveau, formatDuree(n.heures), fcfa(n.montant)].map(T)),
      ...recap.parMode.map((m) => [m.mode === 'ligne' ? 'En ligne' : 'Présentiel', formatDuree(m.heures), fcfa(m.montant)].map(T)),
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
  })

  // Comparaison avec le mois précédent
  if (precedent) {
    const delta = (a, b) => (b ? `${a - b >= 0 ? '+' : ''}${(((a - b) / b) * 100).toFixed(0)} %` : '—')
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [[`Comparaison`, moisLabel(precedent.mois), moisLabel(recap.mois), 'Écart']],
      body: [
        ['Heures', formatDuree(precedent.heures), formatDuree(recap.heures), delta(recap.heures, precedent.heures)].map(T),
        ['Montant', fcfa(precedent.montant), fcfa(recap.montant), delta(recap.montant, precedent.montant)].map(T),
        ['Séances', String(precedent.nbSeances), String(recap.nbSeances), delta(recap.nbSeances, precedent.nbSeances)].map(T),
      ],
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    })
  }

  // Détail des matières
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Matière', 'École', 'Niveau', 'Heures', 'Montant']],
    body: recap.parMatiere.map((m) => [m.nom, m.code, m.niveau, formatDuree(m.heures), fcfa(m.montant)].map(T)),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
  })

  // Détail des séances
  doc.addPage()
  entete(doc, `Détail des séances`, moisLabel(recap.mois), enseignant)
  autoTable(doc, {
    startY: 34,
    head: [['Date', 'Horaire', 'École', 'Matière', 'Mode', 'Statut', 'Montant']],
    body: recap.seances.map((s) => {
      const m = recap.parMatiere.find((x) => x.matiereId === s.matiereId)
      return [
        jourLabel(s.date, 'dd/MM'),
        `${s.debut}–${s.fin}`,
        m?.code || '—',
        m?.nom || '—',
        s.mode === 'ligne' ? 'En ligne' : 'Présentiel',
        s.statut === 'fait' ? 'Effectuée' : 'Planifiée',
        fcfa(montantDe(s)),
      ].map(T)
    }),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 6: { halign: 'right' } },
  })

  piedDePage(doc)
  return doc
}

/**
 * Propose le partage natif (mobile) et retombe sur le téléchargement.
 * @returns {Promise<'partage'|'telecharge'>}
 */
export async function partagerOuTelecharger(doc, nomFichier, titre) {
  const blob = doc.output('blob')
  const fichier = new File([blob], nomFichier, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: titre })
      return 'partage'
    } catch (e) {
      if (e?.name === 'AbortError') return 'partage'
    }
  }
  doc.save(nomFichier)
  return 'telecharge'
}
