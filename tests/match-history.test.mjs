import test from "node:test";
import assert from "node:assert/strict";
import {
  BrainyMatchHistory,
  createFriendlyLocalMatch,
} from "../js/match-history.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, value);
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const makeEvent = () =>
  createFriendlyLocalMatch({
    eventId: "8b93f16d-9a80-4b81-929e-704202ef1101",
    gameId: "elite-pixel-art",
    matchId: "local-test-1",
    startedAt: "2026-07-23T10:00:00Z",
    endedAt: "2026-07-23T10:03:00Z",
    participants: [
      {
        player_id: "aa1ad6a7-7f5d-4ae1-b140-9a79e965666b",
        seat: 1,
        team_id: null,
        outcome: "win",
        score: 3,
      },
      {
        player_id: "b2e6a4c8-59d7-4b73-8c12-d1f0a9e76234",
        seat: 2,
        team_id: null,
        outcome: "loss",
        score: 1,
      },
    ],
  });

test("une partie hors ligne reste en attente", async () => {
  const storage = new MemoryStorage();
  const history = new BrainyMatchHistory({
    supabaseClient: { rpc: async () => assert.fail("RPC appelée hors ligne") },
    storage,
    onlineState: () => false,
  });

  history.queue(makeEvent());
  const result = await history.flush();

  assert.equal(result.offline, true);
  assert.equal(history.pending().length, 1);
});

test("une synchronisation réussie vide la file", async () => {
  const storage = new MemoryStorage();
  let calls = 0;
  const history = new BrainyMatchHistory({
    supabaseClient: {
      rpc: async () => {
        calls += 1;
        return { data: { synced: true, already_present: false }, error: null };
      },
    },
    storage,
    onlineState: () => true,
  });

  history.queue(makeEvent());
  const result = await history.flush();

  assert.equal(calls, 1);
  assert.equal(result.synced.length, 1);
  assert.deepEqual(history.pending(), []);
});

test("le même event_id n'est mis en file qu'une fois", () => {
  const history = new BrainyMatchHistory({
    supabaseClient: { rpc: async () => ({ data: {}, error: null }) },
    storage: new MemoryStorage(),
  });

  assert.equal(history.queue(makeEvent()).queued, true);
  assert.equal(history.queue(makeEvent()).already_present, true);
  assert.equal(history.pending().length, 1);
});

test("une erreur réseau conserve la partie", async () => {
  const history = new BrainyMatchHistory({
    supabaseClient: {
      rpc: async () => ({ data: null, error: { message: "network" } }),
    },
    storage: new MemoryStorage(),
    onlineState: () => true,
  });

  history.queue(makeEvent());
  const result = await history.flush();

  assert.equal(result.errors.length, 1);
  assert.equal(history.pending().length, 1);
});
