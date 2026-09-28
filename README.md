# Timer

Application personnelle de gestion d'emploi du temps, de quotas horaires et de rémunération
pour un enseignant intervenant dans plusieurs écoles à Dakar.

**En ligne : https://techbadji.github.io/timer/** — à ouvrir depuis le téléphone puis
« Ajouter à l'écran d'accueil » pour l'installer comme une application.

**Compte email + mot de passe, base Postgres hébergée sur Supabase.** Les données sont
synchronisées entre tous les appareils connectés au même compte ; une connexion internet est
requise. Interface en français, montants en FCFA, heures locales (Dakar, GMT).

## Démarrer

```bash
npm install
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev      # http://localhost:5173
npm run build    # bundle de production + Service Worker
npm run preview  # sert le build (à ouvrir depuis le mobile pour installer la PWA)
npm test         # logique métier pure + analyse de la saisie vocale
npm run icons    # régénère les icônes PWA
npm run deploy   # construit et publie sur https://techbadji.github.io/timer/
```

### Configurer Supabase (une fois)

1. Créer un projet gratuit sur [supabase.com](https://supabase.com).
2. Project → SQL Editor → New query → coller le contenu de `supabase/schema.sql` → Run.
   Crée les 6 tables, les politiques de sécurité (RLS, un utilisateur ne voit que ses propres
   données) et l'amorçage automatique des 6 écoles à l'inscription.
3. Project Settings → API → copier `Project URL` et la clé `anon public` dans `.env.local`.
4. Authentication → Providers → Email : désactiver « Confirm email » pour un usage personnel
   rapide (sinon un email de confirmation est envoyé à chaque inscription).

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

`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` doivent être disponibles au moment du build
(`npm run deploy` les lit depuis `.env.local`, comme `npm run dev`). La clé `anon` est publique
par conception ; la sécurité vient des politiques RLS de `supabase/schema.sql`, pas du secret de
cette clé.

Un workflow GitHub Actions (`.github/workflows/deploy.yml`) est prêt pour automatiser tout cela,
mais il est en déclenchement manuel uniquement : Actions est actuellement bloqué sur le compte
pour un problème de facturation. Une fois celui-ci réglé, il suffit d'ajouter les deux variables
en secrets du dépôt, de rétablir le déclencheur `push` et de basculer la source Pages sur
« GitHub Actions ».

## Stack

| Rôle | Choix |
| --- | --- |
| Vue | React 19 + Vite |
| Styles | Tailwind CSS |
| Persistance | Supabase (Postgres + Auth + Realtime), via `@supabase/supabase-js` |
| Calendrier | FullCalendar 6 (timeGrid jour/semaine, dayGrid mois, list) |
| PDF | jsPDF + jspdf-autotable (chargés à la demande) |
| Graphiques | Recharts |
| Saisie vocale | Web Speech API (navigateur), analyse en français dans `lib/voix.js` |
| PWA | vite-plugin-pwa (Workbox, installable, notifications locales) |

## Écrans et navigation

Navigation par barre d'onglets flottante en bas (pouce), routage par hash — aucune dépendance de
routeur, et le retour arrière du navigateur fonctionne.

```
#/calendrier   Vues jour / semaine / mois / liste, 8h→21h
               Mobile : colonne étroite, page qui défile, bouton flottant +, dicter une séance
               Ordinateur (≥1024px) : pleine largeur, calendrier qui remplit la fenêtre
               avec défilement interne, créneaux et libellés agrandis, boutons « Ajouter un
               cours » et « Dicter la séance »
               Glisser-déposer, création par sélection d'un créneau
               Conflits signalés sur l'événement, légende des 6 écoles, bandeau « prochain cours »
               Notes de séance affichées sur l'événement (ou en infobulle en vue mois)
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
               Sécurité (email connecté, changement de mot de passe, déconnexion)
               Export / import JSON complet (copie de secours, en plus de la base Supabase)
               Effacement des séances
```

## Arborescence

```
src/
├─ main.jsx                  Point d'entrée
├─ App.jsx                   Coquille : session, onglets, amorçage, planification des rappels
├─ index.css                 Base Tailwind + composants (.carte, .champ, .btn…) + thème FullCalendar
├─ data/
│  ├─ constants.js           Les 6 écoles, niveaux, modes, réglages par défaut
│  ├─ supabase.js            Client Supabase + conversion camelCase ↔ snake_case + réglages
│  ├─ repo.js                Toutes les écritures métier (séances, matières, tarifs, paiements)
│  └─ queries.js             Lectures réactives (chargement + abonnement Realtime) + index mémoïsés
├─ lib/
│  ├─ dates.js               'YYYY-MM-DD' / 'HH:mm' — aucune arithmétique de fuseau
│  ├─ money.js                Formatage FCFA
│  ├─ conflicts.js            Chevauchements + trajet insuffisant entre écoles
│  ├─ stats.js                Progression des quotas, récapitulatif mensuel
│  ├─ notifications.js        Rappels locaux (minuteurs + Service Worker)
│  ├─ pdf.js                  Exports PDF (chargé dynamiquement)
│  ├─ backup.js               Export / import JSON complet, en plus de la base Supabase
│  ├─ voix.js                 Reconnaissance vocale + analyse d'une phrase dictée
│  └─ router.js                Micro-routeur par hash
├─ components/
│  ├─ ui.jsx                  Modale, champs, segments, progression, toasts, confirmation
│  ├─ icons.jsx                Icônes SVG en trait
│  ├─ SeanceForm.jsx           Création / édition d'un cours (+ récurrence, conflits, quota, dictée)
│  └─ MatiereForm.jsx          Création / édition d'une matière
└─ pages/                     LoginPage · CalendrierPage · MatieresPage · RecapPage · ReglagesPage

supabase/schema.sql          Schéma Postgres + politiques RLS + amorçage des 6 écoles
tests/                       Logique métier pure + analyse de la saisie vocale
public/                      Icônes PWA générées, favicon, handler de notifications du SW
```

## Schéma de la base (Postgres / Supabase — `supabase/schema.sql`)

Toutes les tables portent une colonne `user_id` et une politique RLS (`auth.uid() = user_id`) :
un compte ne voit jamais les données d'un autre, même sur la même base partagée.

```sql
ecoles     (id, user_id, code, nom, couleur, ordre)

matieres   (id, user_id, ecole_id, nom, niveau, volume_horaire, statut,
            mode_par_defaut, lieu_par_defaut, lien_par_defaut, note,
            cree_le, termine_le)

tarifs     (id, user_id, ecole_id, niveau, taux)              -- unique (user_id, ecole_id, niveau)

seances    (id, user_id, matiere_id, date, debut, fin, mode, lieu, lien,
            statut, notes, taux_horaire, serie_id)
           -- taux_horaire figé à la création ; serie_id regroupe une récurrence

paiements  (id, user_id, ecole_id, mois, statut, montant, date_paiement)  -- unique (user_id, ecole_id, mois)

reglages   (user_id, cle, valeur jsonb)                        -- clé primaire (user_id, cle)
```

Côté application, les colonnes `snake_case` sont converties en `camelCase` (`ecoleId`,
`volumeHoraire`, `tauxHoraire`…) par `data/supabase.js`, pour que `repo.js` et les écrans gardent
les mêmes noms qu'avant la migration.

## Décisions structurantes

**Dates sous forme de chaînes.** Une séance stocke `'2026-09-07'` et `'08:00'`, jamais un
`Date` ni un timestamp UTC. Aucun décalage de fuseau n'est possible.

**Le taux est figé sur la séance.** `seances.taux_horaire` est copié depuis la grille au moment
de la création. Corriger un tarif plus tard ne réécrit donc jamais un récapitulatif déjà validé.

**Le récapitulatif est calculé, pas stocké.** L'historique mensuel se reconstruit à la demande
depuis les séances : il reste exact même après une correction rétroactive. Seul le statut de
paiement, qui est une information extérieure, est persisté.

**Isolation par compte, pas par appareil.** Avant Supabase, chaque navigateur avait sa propre
base IndexedDB. Désormais, l'isolation se fait par compte (RLS) : les mêmes données apparaissent
sur tous les appareils connectés avec le même email, en temps réel (Supabase Realtime).

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

**Saisie vocale.** Le bouton « Dicter la séance » utilise la reconnaissance vocale native du
navigateur (Web Speech API, `fr-FR`) puis une analyse de texte locale (`lib/voix.js`) qui
reconnaît matière, école, jour, horaires, salle/en ligne et notes. Les champs sont pré-remplis,
jamais enregistrés sans validation. Sur Chrome, l'audio est envoyé aux serveurs de Google pour la
reconnaissance ; les données de l'application, elles, ne transitent que par Supabase.

## Sauvegarde

Les données vivent sur Supabase (sauvegardées côté serveur). En complément,
`Réglages → Données → Exporter (JSON)` produit une copie complète (écoles, matières, tarifs,
séances, paiements, réglages) restaurable à l'identique sur le compte connecté.
