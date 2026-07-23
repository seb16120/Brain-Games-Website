const DEFAULT_STORAGE_KEY = "brainy-games-pending-matches-v1";

function defaultStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function defaultOnlineState() {
  return typeof navigator === "undefined" || navigator.onLine;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createFriendlyLocalMatch({
  gameId,
  matchId,
  startedAt,
  endedAt = new Date().toISOString(),
  format,
  participants,
  finishReason = "normal",
  validationReference,
  eventId = crypto.randomUUID(),
}) {
  return {
    schema_version: "1.0",
    event_id: eventId,
    game_id: gameId,
    match_id: matchId,
    category: "friendly_local",
    started_at: startedAt,
    ended_at: endedAt,
    ...(format ? { format } : {}),
    participants: clone(participants),
    finish_reason: finishReason,
    validation: {
      authority: "client",
      reference:
        validationReference || `local:${gameId}:${matchId}`,
    },
  };
}

export class BrainyMatchHistory {
  constructor({
    supabaseClient,
    storage = defaultStorage(),
    storageKey = DEFAULT_STORAGE_KEY,
    onlineState = defaultOnlineState,
  }) {
    if (!supabaseClient?.rpc) {
      throw new TypeError("Un client Supabase est requis.");
    }
    if (!storage) {
      throw new TypeError("Un stockage local est requis.");
    }

    this.supabase = supabaseClient;
    this.storage = storage;
    this.storageKey = storageKey;
    this.onlineState = onlineState;
    this.flushPromise = null;
    this.detachOnlineListener = null;
  }

  pending() {
    try {
      const value = JSON.parse(this.storage.getItem(this.storageKey) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  queue(event) {
    this.#assertFriendlyLocalEvent(event);
    const events = this.pending();
    const sameEvent = events.find((item) => item.event_id === event.event_id);

    if (sameEvent) {
      return { event_id: event.event_id, queued: false, already_present: true };
    }

    const sameMatch = events.find(
      (item) =>
        item.game_id === event.game_id && item.match_id === event.match_id,
    );
    if (sameMatch) {
      throw new Error("match_id_already_queued");
    }

    events.push(clone(event));
    this.#write(events);
    return { event_id: event.event_id, queued: true, already_present: false };
  }

  async queueAndSync(event) {
    const queued = this.queue(event);
    const sync = await this.flush();
    return { queued, sync };
  }

  flush() {
    if (!this.flushPromise) {
      this.flushPromise = this.#flushNow().finally(() => {
        this.flushPromise = null;
      });
    }
    return this.flushPromise;
  }

  listenForReconnect(target = typeof window !== "undefined" ? window : null) {
    if (!target?.addEventListener) return () => {};

    const onOnline = () => {
      void this.flush();
    };
    target.addEventListener("online", onOnline);
    this.detachOnlineListener = () => target.removeEventListener("online", onOnline);

    return this.detachOnlineListener;
  }

  stopListening() {
    this.detachOnlineListener?.();
    this.detachOnlineListener = null;
  }

  async #flushNow() {
    const events = this.pending();
    if (!events.length) {
      return { synced: [], pending: [], offline: false };
    }
    if (!this.onlineState()) {
      return { synced: [], pending: events, offline: true };
    }

    const pending = [];
    const synced = [];
    const errors = [];

    for (const event of events) {
      try {
        const { data, error } = await this.supabase.rpc(
          "submit_friendly_local_match",
          { p_event: event },
        );

        if (error) {
          pending.push(event);
          errors.push({ event_id: event.event_id, message: error.message });
          continue;
        }

        synced.push({
          event_id: event.event_id,
          already_present: Boolean(data?.already_present),
        });
      } catch (error) {
        pending.push(event);
        errors.push({
          event_id: event.event_id,
          message: error?.message || "sync_failed",
        });
      }
    }

    this.#write(pending);
    return { synced, pending, errors, offline: false };
  }

  #write(events) {
    if (events.length) {
      this.storage.setItem(this.storageKey, JSON.stringify(events));
    } else {
      this.storage.removeItem(this.storageKey);
    }
  }

  #assertFriendlyLocalEvent(event) {
    if (
      !event ||
      event.schema_version !== "1.0" ||
      event.category !== "friendly_local" ||
      event.validation?.authority !== "client" ||
      !event.event_id ||
      !event.game_id ||
      !event.match_id ||
      !Array.isArray(event.participants) ||
      event.participants.length < 2
    ) {
      throw new TypeError("invalid_friendly_local_match");
    }
  }
}
