# Contrat d’intégration des jeux

Version du contrat : **1.0**

## 1. Responsabilités

Brain Games Website possède les comptes, profils, historiques, statistiques,
graphiques, classements et calculs d’Elo. Chaque jeu reste responsable de ses
règles, de l’état officiel de la partie et de la détermination du résultat.

Un résultat déclaré uniquement par le navigateur peut être modifié par un joueur.
Il peut donc alimenter une partie amicale, mais jamais une partie classée.

## 2. Identifiants stables

Le fichier `games.json` est le registre de référence. Un jeu transmet toujours
son `game_id` stable ; le nom affiché et l’URL peuvent évoluer sans casser
l’historique.

Chaque événement possède un `event_id` UUID unique. Chaque partie possède aussi
un `match_id` créé par le jeu. Le stockage central refuse les doublons sur
`event_id` et sur le couple `(game_id, match_id)`.

## 3. Catégories

- `ranked` : résultat validé par une autorité serveur ; modifie l’Elo.
- `friendly_online` : partie online comptabilisée séparément ; aucun Elo.
- `friendly_local` : partie locale synchronisée vers un profil ; aucun Elo.
- Partie locale non synchronisée : reste sur l’appareil et n’est pas envoyée.

Une partie locale terminée hors ligne peut être placée dans une file d’attente.
Au retour d’Internet, le même événement est renvoyé avec le même `event_id`,
ce qui rend la synchronisation idempotente.

## 4. Résultats et fins de partie

Chaque participant reçoit `win`, `draw` ou `loss`. La partie indique aussi
une cause commune : `normal`, `forfeit`, `disconnect` ou `timeout`.
Les futurs modes par équipes utilisent `team_id` sans changer le contrat.

## 5. Validation

Pour `ranked`, `validation.authority` doit être `server` et
`validation.reference` doit permettre d’auditer la partie côté serveur.
Une confirmation identique de deux navigateurs ne suffit pas pour un classement
sérieux. Pour une partie amicale locale, l’autorité peut être `client`.

Le format machine est défini dans
`schemas/match-result.schema.json`. Toute évolution incompatible crée une
nouvelle `schema_version` au lieu de modifier silencieusement la version 1.0.

## 6. Exemple

```json
{
  "schema_version": "1.0",
  "event_id": "e1542024-6a70-4b5d-a9f7-9149bc0fbb7b",
  "game_id": "elite-pixel-art",
  "match_id": "epa-room-7f3c-match-2",
  "category": "friendly_online",
  "started_at": "2026-07-22T18:30:00Z",
  "ended_at": "2026-07-22T18:34:12Z",
  "format": { "type": "first_to", "target_score": 3 },
  "participants": [
    {
      "player_id": "1cd84e43-df64-49c0-8a08-f3bf17b2013b",
      "seat": 1,
      "team_id": null,
      "outcome": "win",
      "score": 3
    },
    {
      "player_id": "30d2225c-a83b-4790-a56c-5644d71d04dc",
      "seat": 2,
      "team_id": null,
      "outcome": "loss",
      "score": 2
    }
  ],
  "finish_reason": "normal",
  "validation": {
    "authority": "server",
    "reference": "epa_matches:7f3c:2"
  }
}
```
