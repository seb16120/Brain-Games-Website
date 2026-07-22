import { readFile } from "node:fs/promises";

const registry = JSON.parse(await readFile("games.json", "utf8"));
const schema = JSON.parse(
  await readFile("schemas/match-result.schema.json", "utf8"),
);

const fail = (message) => {
  console.error(`Contrat invalide : ${message}`);
  process.exitCode = 1;
};

const ids = registry.games.map((game) => game.id);
const schemaIds = schema.properties.game_id.enum;

if (registry.contract_version !== schema.properties.schema_version.const) {
  fail("la version du registre diffère de celle du schéma");
}

if (new Set(ids).size !== ids.length) {
  fail("un game_id est dupliqué");
}

if (JSON.stringify(ids) !== JSON.stringify(schemaIds)) {
  fail("les game_id du registre et du schéma diffèrent");
}

for (const game of registry.games) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id)) {
    fail(`game_id non stable : ${game.id}`);
  }

  if (!game.public_url.startsWith("https://")) {
    fail(`URL publique non sécurisée : ${game.id}`);
  }
}

if (!process.exitCode) {
  console.log(`Contrat Brain Games valide : ${ids.length} jeux, version ${registry.contract_version}.`);
}
