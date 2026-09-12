// Référentiel figé de l'application : les 6 structures, les niveaux, les modes.
export const ECOLES_PAR_DEFAUT = [
  { code: 'BEMTECH', nom: 'BEMTECH', couleur: '#E11D48', ordre: 1 },
  { code: 'AFITECH', nom: 'AFITECH', couleur: '#F59E0B', ordre: 2 },
  { code: 'ISM-ING', nom: 'ISM Ingénierie', couleur: '#2563EB', ordre: 3 },
  { code: 'ISM-MAN', nom: 'ISM Management', couleur: '#059669', ordre: 4 },
  { code: 'ISM-SOIR', nom: 'ISM Cours du soir', couleur: '#7C3AED', ordre: 5 },
  { code: 'DM', nom: 'DigitalMatis', couleur: '#0891B2', ordre: 6 },
]

export const NIVEAUX = ['Licence', 'Master']

export const MODES = [
  { valeur: 'presentiel', label: 'Présentiel', icone: '📍' },
  { valeur: 'ligne', label: 'En ligne', icone: '💻' },
]

export const STATUTS_SEANCE = [
  { valeur: 'planifie', label: 'Planifiée' },
  { valeur: 'fait', label: 'Effectuée' },
  { valeur: 'annule', label: 'Annulée' },
]

export const REGLAGES_DEFAUT = {
  heureDebutJour: '08:00',
  heureFinJour: '21:00',
  trajetMinutes: 45, // temps de trajet minimum entre deux écoles en présentiel
  rappelMinutes: 30, // délai du rappel avant le début du cours
  seuilAlerteQuota: 90, // % de progression déclenchant l'alerte "quota proche"
  autoFait: true, // marquer automatiquement "effectuée" une séance passée
  enseignant: 'Elias Badji',
}

export const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
