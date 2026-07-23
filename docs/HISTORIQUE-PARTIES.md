# Historique central des parties

BGW-P3 fournit la couche commune de stockage des résultats.

## 1. Ce qui est stocké

La table `match_events` conserve l'événement complet et refuse les doublons :

- clé primaire : `event_id` ;
- unicité supplémentaire : `(game_id, match_id)` ;
- catégories : `ranked`, `friendly_online`, `friendly_local` ;
- dates, format FTN, participants, résultat et cause de fin ;
- autorité et référence de validation.

La table `match_profile_results` relie uniquement les profils dont l'association
à la partie est vérifiée. Un identifiant cité dans le JSON d'une partie locale ne
suffit donc pas à écrire dans l'historique d'un autre joueur.

## 2. Règles de confiance

- Le navigateur peut envoyer uniquement `friendly_local` avec l'autorité
  `client`.
- Une partie locale ne modifie jamais l'Elo.
- `ranked` exige l'autorité `server` et ne peut pas être créé par un joueur
  depuis le navigateur.
- Les jeux online seront reliés progressivement par une validation serveur propre
  à chacun, à partir de BGW-P4.

Les deux tables utilisent RLS. Un profil voit uniquement les événements auxquels
il est relié et ne peut pas modifier ou supprimer l'historique accepté.

## 3. Synchronisation hors ligne

Le module `js/match-history.js` place une partie locale terminée dans
`localStorage`. Il réutilise le même `event_id` lors de chaque tentative et
retire l'événement de la file uniquement après l'accusé de réception Supabase.

Exemple :

```js
import {
  BrainyMatchHistory,
  createFriendlyLocalMatch,
} from "./js/match-history.js";

const history = new BrainyMatchHistory({ supabaseClient });
history.listenForReconnect();

const event = createFriendlyLocalMatch({
  gameId: "elite-pixel-art",
  matchId: crypto.randomUUID(),
  startedAt,
  participants,
  format: { type: "first_to", target_score: 3 },
});

await history.queueAndSync(event);
```

Si Internet est coupé, la partie reste sur l'appareil. Au retour du réseau, le
module appelle `submit_friendly_local_match`. Une répétition identique est
acceptée comme déjà synchronisée au lieu de créer une seconde partie.

## 4. Intégration future

BGW-P4 branchera d'abord Elite Pixel Art sur ce contrat. Les autres jeux suivront
sans changer le format version 1.0. Les statistiques et l'Elo seront construits
dans les étapes suivantes à partir des événements centraux.
