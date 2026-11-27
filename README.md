# Registre local

Application Next.js (App Router), TypeScript et SQLite pour consulter les créations récentes d’unités légales et les coordonnées professionnelles relevées sur les pages officielles des entreprises. Le serveur écoute uniquement sur la boucle locale.

## Installation et mode démo

Utiliser **Node.js 24 ou plus récent** et npm. SQLite est fourni par Node.js. Exécuter les commandes à la racine du dépôt cloné, dans le dossier qui contient `package.json`.

```sh
npm ci
cp .env.example .env.local
npm run sync
npm run dev
```

Ouvrir [http://127.0.0.1:3000](http://127.0.0.1:3000), ou l’adresse affichée par Next.js si le port est occupé. Au démarrage, le mode par défaut est `demo`. La commande ou le bouton **Synchroniser** importe 12 fiches fictives, dont 11 dans la période de 30 jours lors du premier import. Les dates fictives sont fixées au premier import. Le filtre **Tout l’historique** retrouve l’ensemble du jeu démo, même après plusieurs semaines.

Les données de démonstration sont enregistrées dans `data/registre.sqlite.demo`. En mode Sirene, la base par défaut est `data/registre.sqlite`. `SQLITE_PATH` permet de choisir un autre emplacement. En mode démo, le suffixe `.demo` est ajouté à ce chemin. Pour servir la version de production en local, utiliser `npm run build` puis `npm start`.

## Clés API et configuration

| Usage | Variable | Coût et accès |
| --- | --- | --- |
| Tester avec des données fictives | `APP_MODE=demo` | Aucune clé requise |
| Importer les créations réelles | `SIRENE_API_KEY` | Clé gratuite avec un compte Insee et une souscription au plan **Public** |
| Chercher le téléphone, le site ou l’adresse d’un établissement | `GOOGLE_PLACES_API_KEY` | Facultative. Compte Google Cloud avec facturation à l’usage pour une clé standard |

Conserver les clés dans **`.env.local`**, à la racine du projet. Ce fichier est ignoré par Git. [`.env.example`](.env.example) est le modèle public à versionner avec des valeurs vides. Les deux clés sont lues côté serveur. Garder les noms de variables ci-dessus, sans préfixe `NEXT_PUBLIC_`.

### Obtenir la clé Sirene de l’Insee

1. Ouvrir le portail, cliquer sur **Se connecter → Connexion pour les externes → Enregistrement**, puis créer un compte. Confirmer l’adresse e-mail via le lien reçu et se reconnecter. [Portail des API de l’Insee](https://portail-api.insee.fr/)
2. Dans **Tableau de bord**, choisir **Créer ma première application**. Saisir un nom et une description, par exemple *Registre local* et *Consultation des créations d’entreprises*. Choisir le mode **Simple**, laisser la souscription vide pendant cette création, puis valider.
3. Ouvrir **API Sirene open data** dans le catalogue, cliquer sur **Souscrire**, choisir le plan **Public**, puis sélectionner l’application créée à l’étape précédente et confirmer. La souscription génère la clé. [Fiche API Sirene sur le portail](https://portail-api.insee.fr/catalog/api/2ba0e549-5587-3ef1-9082-99cd865de66f)
4. Pour retrouver la clé, ouvrir l’application dans le tableau de bord, aller dans **Souscriptions**, choisir la souscription Sirene et utiliser l’icône de copie. [Guide officiel illustré de l’Insee](https://static.insee.fr/api-sirene/Insee_API_publique_modalites_connexion.pdf)

Le projet utilise l’API **Sirene 3.11** et transmet la clé d’intégration dans l’en-tête `X-INSEE-Api-Key-Integration`. Pour vérifier la clé avant l’import national, ouvrir **Documentation → Swagger** sur la fiche de l’API, cliquer sur **Authorize**, saisir la clé et exécuter `GET /informations`. Une réponse HTTP 200 confirme l’accès. [Accès gratuit à Sirene](https://www.insee.fr/fr/information/3591226)

### Obtenir la clé Google Places (facultative)

1. Créer un projet Google Cloud, par exemple *Registre local*. Garder ce projet sélectionné dans le bandeau de la console pour les étapes suivantes. [Créer un projet Google Cloud](https://console.cloud.google.com/projectcreate)
2. Dans **Facturation**, associer un compte de facturation au projet ou en créer un si nécessaire. **L’abonnement Starter à 100 $ US par mois est facultatif.** Pour ce projet, la facturation standard à l’usage suffit. [Facturation Google Cloud](https://console.cloud.google.com/billing) · [Comparatif des modes de facturation](https://developers.google.com/maps/billing-and-pricing/overview)
3. Dans la bibliothèque des API, ouvrir **Places API (New)** et cliquer sur **Activer**. Si la console affiche **Gérer**, l’API est déjà activée pour le projet sélectionné. [Activer Places API (New)](https://console.cloud.google.com/apis/library/places.googleapis.com)
4. Ouvrir **API et services → Identifiants → Créer des identifiants → Clé API**. Dans **Restrictions d’API**, limiter la clé à **Places API (New)**, enregistrer, puis copier la clé. Les appels partent du serveur Next.js. Si une restriction par adresse IP est utilisée, elle doit correspondre à l’adresse IP publique de sortie du serveur. [Page des identifiants](https://console.cloud.google.com/apis/credentials) · [Guide Google de création d’une clé](https://developers.google.com/maps/documentation/places/web-service/get-api-key)

Le bouton **Rechercher sur Google Maps** déclenche un appel **Text Search Enterprise** par clic en mode Sirene. Selon le tarif mondial publié par Google, les 1 000 premiers appels de ce type par mois sont inclus, puis le premier palier coûte 35 $ US pour 1 000 appels supplémentaires. Le quota est partagé entre les projets liés au même compte de facturation. [Grille tarifaire Google](https://developers.google.com/maps/billing-and-pricing/pricing)

### Configurer et tester les clés en local

Si `.env.local` n’existe pas encore, copier `.env.example` dans `.env.local`. Dans ce fichier, renseigner les valeurs réelles à la place des exemples et laisser `GOOGLE_PLACES_API_KEY` vide pour utiliser Sirene seul.

```dotenv
APP_MODE=sirene
SIRENE_API_KEY=remplacer_par_la_cle_insee
GOOGLE_PLACES_API_KEY=
```

1. Redémarrer Next.js après avoir enregistré le fichier. Pour lancer le serveur de développement, exécuter `npm run dev`.
2. Cliquer sur **Synchroniser** ou lancer `npm run sync` depuis la racine du projet. Le premier import national couvre les 30 derniers jours et peut prendre plusieurs dizaines de minutes. L’accueil affiche la dernière synchronisation réussie.
3. Pour tester Google Places, ouvrir une fiche en diffusion totale avec un nom et une commune, puis cliquer sur **Rechercher sur Google Maps**. Les résultats éventuels affichent jusqu’à trois établissements candidats. Vérifier la correspondance avant de relever une coordonnée sur le site officiel de l’entreprise. Les résultats Google ne sont pas écrits dans SQLite. [Règles Google Places](https://developers.google.com/maps/documentation/places/web-service/policies)

### Dépannage

| Symptôme | Vérification |
| --- | --- |
| Sirene renvoie HTTP 401 ou 403 | Vérifier que la clé copiée provient de la souscription **API Sirene open data** au plan **Public**. Tester la clé dans Swagger. |
| Sirene renvoie HTTP 429 | Attendre au moins une minute avant de relancer et vérifier si d’autres imports utilisent la même clé. |
| Le bouton Google est absent d’une fiche | Ouvrir une fiche en diffusion totale disposant d’un nom et d’une commune. |
| Le bouton Google affiche des données fictives | Vérifier `APP_MODE=sirene` dans `.env.local` et redémarrer Next.js. |
| Google renvoie HTTP 400, 401 ou 403 | Vérifier la clé, ses restrictions et l’activation de **Places API (New)** et de la facturation sur le projet qui a émis la clé. Après l’activation, attendre quelques minutes si nécessaire. |
| Google renvoie HTTP 429 | Vérifier les quotas de Places API (New) dans le projet Google Cloud. |

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

Les tests utilisent des bases temporaires. Ils couvrent deux imports successifs, les six filtres combinés, le tri, la persistance des coordonnées et leur retrait lors d’une diffusion partielle, la conservation des fiches lors d’une erreur Sirene simulée et la recherche Google Places avec une réponse de test. Les commandes de test ne nécessitent aucune clé et ne consomment aucun quota API.
