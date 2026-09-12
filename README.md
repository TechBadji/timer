# Timer

Application personnelle de gestion d'emploi du temps, de quotas horaires et de rémunération
pour un enseignant intervenant dans plusieurs écoles à Dakar.

**En ligne : https://techbadji.github.io/timer/** — à ouvrir depuis le téléphone puis
« Ajouter à l'écran d'accueil » pour l'installer comme une application.

**100 % hors-ligne, mono-appareil, sans compte ni serveur.** Toutes les données vivent dans
IndexedDB, sur l'appareil. Interface en français, montants en FCFA, heures locales (Dakar, GMT).

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # bundle de production + Service Worker
npm run preview  # sert le build (à ouvrir depuis le mobile pour installer la PWA)
npm test         # logique métier + couche de persistance
npm run icons    # régénère les icônes PWA
npm run deploy   # construit et publie sur https://techbadji.github.io/timer/
```

## Déploiement

Le site est servi par GitHub Pages depuis la branche `gh-pages`, construite en local :

```bash
npm run deploy
```

Le script construit `dist/`, y ajoute un `.nojekyll` et force-pousse le tout sur `gh-pages`.
La branche `main` ne contient que les sources ; elle n'est jamais servie directement.

En production, l'application vit sous le chemin `/timer/` : `vite.config.js` fixe `base` selon
le mode, et le code qui fabrique des URL absolues (icônes et liens des notifications) passe par
`import.meta.env.BASE_URL`. Le développement local reste à la racine.

Un workflow GitHub Actions (`.github/workflows/deploy.yml`) est prêt pour automatiser tout cela,
mais il est en déclenchement manuel uniquement : Actions est actuellement bloqué sur le compte
pour un problème de facturation. Une fois celui-ci réglé, il suffit de rétablir le déclencheur
`push` et de basculer la source Pages sur « GitHub Actions ».

## Stack

| Rôle | Choix |
| --- | --- |
| Vue | React 19 + Vite |
| Styles | Tailwind CSS |
| Persistance | IndexedDB via Dexie 4 (`dexie-react-hooks` pour la réactivité) |
| Calendrier | FullCalendar 6 (timeGrid jour/semaine, dayGrid mois, list) |
| PDF | jsPDF + jspdf-autotable (chargés à la demande) |
| Graphiques | Recharts |
| PWA | vite-plugin-pwa (Workbox, installable, notifications locales) |

## Écrans et navigation

Navigation par barre d'onglets fixe en bas (pouce), routage par hash — aucune dépendance de
routeur, et le retour arrière du navigateur fonctionne.

```
#/calendrier   Vues jour / semaine / mois / liste, 8h→21h
               Mobile : colonne étroite, page qui défile, bouton flottant +
               Ordinateur (≥1024px) : pleine largeur, calendrier qui remplit la fenêtre
               avec défilement interne, créneaux et libellés agrandis, bouton « Ajouter un cours »
               Glisser-déposer, création par sélection d'un créneau, bouton flottant +
               Conflits signalés sur l'événement, légende des 6 écoles, « prochain cours »
               Dupliquer la semaine · Exporter en PDF (partage natif sur mobile)

#/matieres     Matières en cours / terminées, filtre par école
               Barre de progression heures faites / planifiées / quota, alertes de dépassement
               Fiche détaillée : bilan + historique des séances

#/recap        Sélecteur de mois + historique des récapitulatifs
               4 indicateurs (heures, montant, écarts vs mois précédent)
               Heures par école (barres), répartition du montant (anneau), comparaison mensuelle
               Détail par école avec bascule « payé / en attente », par niveau, par mode, par matière
               Export PDF du récapitulatif complet

#/reglages     Grille tarifaire 6 écoles × 2 niveaux · couleurs et noms des écoles
               Journée de travail, temps de trajet, seuil d'alerte quota, auto-« effectuée »
               Rappels de cours (permission + test) · Installation PWA
               Sauvegarde / restauration JSON · Effacement des séances
```

## Arborescence

```
src/
├─ main.jsx                  Point d'entrée
├─ App.jsx                   Coquille : onglets, amorçage, planification des rappels
├─ index.css                 Base Tailwind + composants (.carte, .champ, .btn…) + thème FullCalendar
├─ data/
│  ├─ constants.js           Les 6 écoles, niveaux, modes, réglages par défaut
│  ├─ db.js                  Schéma Dexie + amorçage + lecture/écriture des réglages
│  ├─ repo.js                Toutes les écritures métier (séances, matières, tarifs, paiements)
│  └─ queries.js             Lectures réactives (useLiveQuery) + index mémoïsés
├─ lib/
│  ├─ dates.js               'YYYY-MM-DD' / 'HH:mm' — aucune arithmétique de fuseau
│  ├─ money.js               Formatage FCFA
│  ├─ conflicts.js           Chevauchements + trajet insuffisant entre écoles
│  ├─ stats.js               Progression des quotas, récapitulatif mensuel
│  ├─ notifications.js       Rappels locaux (minuteurs + Service Worker)
│  ├─ pdf.js                 Exports PDF (chargé dynamiquement)
│  ├─ backup.js              Export / import JSON
│  └─ router.js              Micro-routeur par hash
├─ components/
│  ├─ ui.jsx                 Modale, champs, segments, progression, toasts, confirmation
│  ├─ icons.jsx              Icônes SVG en trait
│  ├─ SeanceForm.jsx         Création / édition d'un cours (+ récurrence, conflits, quota)
│  └─ MatiereForm.jsx        Création / édition d'une matière
└─ pages/                    CalendrierPage · MatieresPage · RecapPage · ReglagesPage

tests/                       Logique métier et persistance (fake-indexeddb)
public/                      Icônes PWA générées, favicon, handler de notifications du SW
```

## Schéma de la base (Dexie / IndexedDB — base `timer`, version 1)

```js
ecoles:    '++id, code, ordre'
           { id, code, nom, couleur, ordre }

matieres:  '++id, ecoleId, niveau, statut, nom'
           { id, nom, ecoleId, niveau: 'Licence'|'Master', volumeHoraire,
             statut: 'en_cours'|'terminee', modeParDefaut, lieuParDefaut, lienParDefaut,
             note, creeLe, termineeLe }

tarifs:    '++id, &[ecoleId+niveau], ecoleId'      // un seul taux par couple
           { id, ecoleId, niveau, taux }            // FCFA / heure

seances:   '++id, date, matiereId, statut, serieId, [date+statut]'
           { id, matiereId, date: 'YYYY-MM-DD', debut: 'HH:mm', fin: 'HH:mm',
             mode: 'presentiel'|'ligne', lieu, lien,
             statut: 'planifie'|'fait'|'annule', notes,
             tauxHoraire,   // figé à la création
             serieId }      // regroupe les occurrences d'un cours récurrent

paiements: '++id, &[ecoleId+mois], mois, ecoleId'
           { id, ecoleId, mois: 'YYYY-MM', statut: 'paye'|'en_attente', montant, datePaiement }

reglages:  'cle'
           { cle, valeur }  // heureDebutJour, heureFinJour, trajetMinutes, rappelMinutes,
                            // seuilAlerteQuota, autoFait, enseignant
```

## Décisions structurantes

**Dates sous forme de chaînes.** Une séance stocke `'2026-09-07'` et `'08:00'`, jamais un
`Date` ni un timestamp UTC. Aucun décalage de fuseau n'est possible, et les comparaisons
lexicographiques servent d'index Dexie.

**Le taux est figé sur la séance.** `seances.tauxHoraire` est copié depuis la grille au moment
de la création. Corriger un tarif plus tard ne réécrit donc jamais un récapitulatif déjà validé.

**Le récapitulatif est calculé, pas stocké.** L'historique mensuel se reconstruit à la demande
depuis les séances : il reste exact même après une correction rétroactive. Seul le statut de
paiement, qui est une information extérieure, est persisté.

**Conflits.** Deux séances qui se chevauchent sont une erreur ; deux présentiels dans deux
écoles différentes séparés par moins que le temps de trajet configuré sont une alerte. Un cours
en ligne n'exige aucun trajet.

**Quotas.** Une séance `fait` décompte le quota de sa matière. Le réglage « marquer
automatiquement les séances passées » bascule les séances planifiées échues au lancement de
l'application.

**Deux formats, une seule page.** Le calendrier est mobile-first, mais à partir de 1024 px la
page passe en hauteur fixe : l'en-tête et la légende ne bougent plus, le calendrier occupe toute
la place restante et défile en interne, comme une application web de bureau. Le reste de
l'application garde une colonne de lecture de 768 px.

**Rappels.** Notifications locales programmées pour les 24 prochaines heures et reprogrammées à
chaque modification de l'agenda. Le Service Worker gère le clic (ouverture sur le bon jour).

## Sauvegarde

Un seul appareil, pas de serveur : `Réglages → Données → Exporter (JSON)` produit un fichier
complet (écoles, matières, tarifs, séances, paiements, réglages) restaurable à l'identique.
