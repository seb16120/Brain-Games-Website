# Brain Games

Portail statique qui rassemble les jeux de la collection Brain Games.

## Architecture commune

BGW-P1 est terminé. Le portail possède désormais :

- un [planning](PLANNING.txt) central ;
- un [registre stable des jeux](games.json) ;
- un [contrat d’intégration](docs/INTEGRATION-JEUX.md) ;
- un [schéma de résultat](schemas/match-result.schema.json) vérifié automatiquement.

Les profils, statistiques et calculs d’Elo appartiendront au portail. Chaque jeu
conservera ses règles et devra faire valider côté serveur tout résultat classé.

## Lancer le site localement

Ouvrir `index.html` dans un navigateur, ou servir le dossier avec n’importe quel serveur HTTP statique.

## Vérifier le contrat

Avec Node.js 22 ou une version compatible :

```text
npm test
```

## Publication

Le workflow GitHub Actions publie automatiquement le contenu de la branche `main` sur GitHub Pages. Dans les paramètres du dépôt, choisir **GitHub Actions** comme source de déploiement Pages si nécessaire.
