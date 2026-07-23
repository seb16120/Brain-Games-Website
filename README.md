# Brainy Games Hub

Portail statique qui rassemble les jeux de la collection Brainy Games Hub.

## Architecture commune

BGW-P1 est terminé. Le portail possède désormais :

- un [planning](PLANNING.txt) central ;
- un [registre stable des jeux](games.json) ;
- un [contrat d’intégration](docs/INTEGRATION-JEUX.md) ;
- un [schéma de résultat](schemas/match-result.schema.json) vérifié automatiquement.

Les profils, statistiques et calculs d’Elo appartiennent au portail. Chaque jeu
conserve ses règles et doit faire valider côté serveur tout résultat classé.

## Comptes Brainy Games Hub

BGW-P2 ajoute une session persistante, la connexion e-mail/mot de passe et un
profil modifiable commun aux futurs jeux intégrés. Le bouton Google est prêt ;
son activation demande une configuration unique décrite dans
[docs/AUTHENTIFICATION.md](docs/AUTHENTIFICATION.md).

La clé publiée dans `supabase-config.js` est une clé publique prévue pour le
navigateur. Aucune clé `service_role` ou secrète n’est incluse.

## Lancer le site localement

Ouvrir `index.html` dans un navigateur, ou servir le dossier avec n’importe quel serveur HTTP statique.

## Vérifier le contrat

Avec Node.js 22 ou une version compatible :

```text
npm test
```

## Publication

Le workflow GitHub Actions publie automatiquement le contenu de la branche `main` sur GitHub Pages. Dans les paramètres du dépôt, choisir **GitHub Actions** comme source de déploiement Pages si nécessaire.
