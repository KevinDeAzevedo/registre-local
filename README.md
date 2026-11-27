# Registre local

Application Next.js (App Router), TypeScript et SQLite pour consulter les créations récentes d’unités légales et les coordonnées professionnelles relevées sur les pages officielles des entreprises. Le serveur écoute uniquement sur la boucle locale.

## Installation et mode démo

Prérequis : Node.js 24 ou plus récent et npm. SQLite est fourni par Node.js.

```sh
npm ci
cp .env.example .env.local
npm run sync
npm run dev
```

Ouvrir [http://127.0.0.1:3000](http://127.0.0.1:3000), ou l’adresse affichée par Next.js si le port est occupé. Au démarrage, le mode par défaut est `demo`. La commande ou le bouton **Synchroniser** importe 12 fiches fictives, dont 11 dans la période de 30 jours lors du premier import. Les dates fictives sont fixées au premier import. Le filtre **Tout l’historique** retrouve l’ensemble du jeu démo, même après plusieurs semaines.

Les données de démonstration sont enregistrées dans `data/registre.sqlite.demo`. En mode Sirene, la base par défaut est `data/registre.sqlite`. `SQLITE_PATH` permet de choisir un autre emplacement. En mode démo, le suffixe `.demo` est ajouté à ce chemin. Pour servir la version de production en local, utiliser `npm run build` puis `npm start`.

## Activer Sirene

1. Créer un compte sur le portail des API de l’Insee, souscrire à **API Sirene open data**, puis générer une clé d’intégration. [Portail et documentation Sirene](https://portail-api.insee.fr/catalog/api/2ba0e549-5587-3ef1-9082-99cd865de66f)
2. Modifier `.env.local` puis redémarrer le serveur.

   ```dotenv
   APP_MODE=sirene
   SIRENE_API_KEY=votre_cle
   ```

3. Lancer `npm run sync` ou cliquer sur **Synchroniser**. La clé reste côté serveur. Un import national peut prendre du temps selon le nombre de sièges à lire et le quota. La liste reste consultable pendant l’import. L’état de la dernière réussite et le dernier échec sont enregistrés dans SQLite.

L’intégration utilise l’API ouverte stable **3.11** avec l’en-tête `X-INSEE-Api-Key-Integration`. L’Insee annonce le maintien de cette version en parallèle de la future version 4 jusqu’à la mi-2028. [Authentification officielle](https://static.insee.fr/api-sirene/Insee_API_publique_modalites_connexion.pdf) · [Calendrier et mises à jour](https://www.insee.fr/fr/information/9053325)

## Périmètre des données

- Le premier import recherche sur `/siren` l’intervalle inclusif de 30 jours calendaires, aujourd’hui compris, à partir de `dateCreationUniteLegale` en heure de Paris. Le SIREN est la clé unique. Le SIRET du siège est construit à partir du SIREN et de `nicSiegeUniteLegale` dans la période courante. La recherche sur `/siret` récupère ces sièges et leur code commune INSEE. L’application compte les créations d’unités légales Sirene et ne reprend pas le périmètre d’une publication statistique de l’Insee.
- Les recherches utilisent `q`, `nombre=1000`, `curseur=*` puis `header.curseurSuivant`. Les requêtes de sièges sont regroupées par lots de 100 SIRET. Le client espace ses appels d’au moins 2,1 secondes pour respecter le plafond open data de 30 appels par minute. En cas de quota partagé atteint, le message HTTP 429 indique quand relancer. [Fiche technique](https://www.data.gouv.fr/dataservices/api-sirene-open-data) · [Pagination et recherches multicritères](https://www.insee.fr/fr/information/9019311)
- Après le premier import, les exécutions rafraîchissent aussi l’historique déjà présent pour détecter les changements de diffusion. Le temps de synchronisation augmente avec l’historique. Les mises à jour sont atomiques. Un échec d’API ou de pagination conserve les fiches, les coordonnées et l’horodatage de la dernière réussite. Une seule synchronisation peut écrire à la fois.
- Les filtres se combinent et s’appliquent aux fiches déjà importées. Une période de 90 jours ne déclenche pas de téléchargement rétroactif. Les communes homonymes sont identifiées par leur code INSEE. Les codes officiels d’activité et de forme juridique sont affichés lorsqu’aucun libellé local n’est fourni.
- Les entreprises individuelles sont incluses. Sirene est la seule source d’identité intégrée. Une entreprise individuelle en diffusion totale peut afficher le nom diffusé par Sirene. Le régime reste **Régime inconnu** dans le mode Sirene. La démo contient un exemple fictif de micro-entrepreneur. Les représentants légaux issus du RNE ne sont pas importés.
- Les champs masqués `[ND]` deviennent indisponibles et remplacent les anciennes valeurs. Le passage en diffusion partielle retire les coordonnées manuelles de la fiche et désactive leur saisie. Le formulaire demande la page officielle qui publie chaque coordonnée, sa date de vérification et une confirmation manuelle. La page source n’est pas visitée ou analysée par l’application. [Modalités de diffusion Sirene](https://www.sirene.fr/static-resources/documentation/Evolutions_Sirene-Statut_de_diffusion.pdf)

## Synchronisation quotidienne

Sur macOS ou Linux, utiliser `crontab -e`. Exemple à **10 h 30**, après l’heure de rafraîchissement recommandée par l’Insee. Cette crontab suppose que la machine utilise l’heure de Paris. Adapter les deux chemins et obtenir celui de Node.js avec `dirname "$(command -v node)"`. La machine doit être allumée au moment prévu. [Horaire recommandé par l’Insee](https://www.insee.fr/fr/information/9053325)

```cron
PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
30 10 * * * cd "/chemin/absolu/idée prospection" && npm run sync >> "$HOME/registre-local-sync.log" 2>&1
```

La commande charge `.env.local` depuis le dossier du projet et utilise la même base que l’interface. Elle fonctionne indépendamment du serveur web et retourne un code d’échec si la synchronisation échoue. Sous Windows, planifier `npm.cmd run sync` dans le Planificateur de tâches avec le dossier du projet comme répertoire de démarrage.

## Vérifications

```sh
npm test
npm run build
```

Les tests utilisent des bases temporaires. Ils couvrent deux imports successifs, les six filtres combinés, le tri, la persistance des coordonnées et leur retrait lors d’une diffusion partielle, ainsi que la conservation des fiches lors d’une erreur Sirene simulée. En l’absence de clé, l’authentification, la pagination nationale, les jointures avec les sièges et le comportement face aux réponses réelles de l’Insee restent à valider avec une souscription active.

## Recherche Google Places (facultative)

1. Dans Google Cloud, rattacher un compte de facturation à un projet et activer **Places API (New)**.
2. Créer une clé d’API, restreindre la clé à **Places API (New)**, puis ajouter `GOOGLE_PLACES_API_KEY` dans `.env.local`. La clé reste côté serveur.
3. Redémarrer Next.js. En mode Sirene, ouvrir une fiche en diffusion totale qui possède un nom et une commune, puis cliquer sur **Rechercher sur Google Maps**. En mode démo, le même bouton affiche un exemple fictif sans requête externe.

Chaque clic en mode Sirene lance un appel **Text Search Enterprise** et affiche jusqu’à trois établissements candidats avec adresse, téléphone et site, selon les données disponibles. Le nom et la commune publics servent à la recherche. Vérifier l’établissement avant d’utiliser un résultat. Les résultats sont consultables à l’écran et ne sont pas écrits dans SQLite. Pour relever une coordonnée à conserver, vérifier la page officielle de l’entreprise et utiliser le formulaire de saisie. Le clic est indépendant de l’import Sirene.

Google inclut 1 000 appels Text Search Enterprise par mois, puis facture 35 $ US par tranche de 1 000 appels au premier palier. Le quota s’applique au compte de facturation. [Tarifs Google](https://developers.google.com/maps/billing-and-pricing/pricing) · [Règles Google Places](https://developers.google.com/maps/documentation/places/web-service/policies)
