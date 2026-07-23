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
- Les jeux online sont reliés progressivement par une validation serveur propre
  à chacun. Elite Pixel Art est la première intégration terminée.

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

## 4. Elite Pixel Art — BGW-P4

### 4.1 Parties online

Quand un FT1, FT2 ou FT3 passe à l'état terminé, un déclencheur Supabase écrit un
événement `friendly_online` avec l'autorité `server`. Le navigateur ne peut ni
fabriquer ni modifier cet événement. Le `match_series_id` sert d'identifiant
idempotent et change au lancement d'une revanche.

Les joueurs déjà connectés à Brainy Games Hub sont reconnus grâce à la session
Supabase commune aux deux pages GitHub. Leur profil est relié au résultat. Un
invité ou un compte anonyme peut continuer à jouer, mais il ne crée pas de faux
historique personnel.

### 4.2 Parties locales

Le joueur connecté choisit s'il occupe J1 ou J2. À la fin du FT, le résultat est
enregistré comme `friendly_local`. Sans Internet, il reste dans une file propre
au profil sur l'appareil, puis se synchronise automatiquement au retour du réseau.

### 4.3 Elo

Toutes les parties Elite Pixel Art de cette étape sont amicales. Elles alimentent
l'historique, mais ne modifient pas l'Elo. Le classement sera ajouté dans une étape
ultérieure avec des règles de validation distinctes.

## 5. Intégrations suivantes

Otrio, Bingo Réversible, Lucky 21 puis Exit Strategy 3 suivront le même contrat
version 1.0, avec une validation serveur adaptée aux règles de chaque jeu.
