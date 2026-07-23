const games = [
  {
    name: "Bingo Réversible",
    description: "Un bingo tactique où chaque choix peut renverser le cours de la partie.",
    tags: ["Tactique"],
    icon: "↔",
    accent: "#6c45db",
    url: "https://seb16120.github.io/bingo-reversible/",
  },
  {
    name: "Elite Pixel Art",
    description: "Créez et explorez un univers rétro, pixel après pixel.",
    tags: ["Créativité"],
    icon: "▦",
    accent: "#e05f5f",
    url: "https://seb16120.github.io/Elite-Pixel-Art/",
  },
  {
    name: "Lucky 21",
    description: "Mémorisez les cartes et tentez d’approcher le nombre parfait.",
    tags: ["Cartes", "Mémoire"],
    icon: "♠",
    accent: "#208b73",
    url: "https://seb16120.github.io/Lucky-21/",
  },
  {
    name: "Exit Strategy 3",
    description: "Anticipez, planifiez et trouvez la meilleure voie de sortie.",
    tags: ["Stratégie"],
    icon: "⌁",
    accent: "#d16f20",
    url: "https://seb16120.github.io/Exit-Strategy-3/",
  },
  {
    name: "Otrio",
    description: "Alignez les formes, bloquez vos adversaires et maîtrisez la grille.",
    tags: ["Tactique"],
    icon: "◎",
    accent: "#3477cf",
    url: "https://seb16120.github.io/otrio-web/",
  },
];

const gamesGrid = document.querySelector("#games-grid");
const tagFilters = document.querySelector("#tag-filters");
const visibleGamesCount = document.querySelector("#visible-games-count");
const visibleGamesLabel = document.querySelector("#visible-games-label");
const tags = ["Tous", ...new Set(games.flatMap((game) => game.tags))];
const gameCards = [];

games.forEach((game) => {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = game.url;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.style.setProperty("--accent", game.accent);
  card.setAttribute("aria-label", `${game.name} — ouvrir le jeu dans un nouvel onglet`);

  card.innerHTML = `
    <div class="card-top">
      <span class="game-icon" aria-hidden="true">${game.icon}</span>
      <span class="external-icon" aria-hidden="true">↗</span>
    </div>
    <div class="card-content">
      <h3>${game.name}</h3>
      <p>${game.description}</p>
      <div class="game-tags">
        ${game.tags.map((tag) => `<span class="game-tag">${tag}</span>`).join("")}
      </div>
    </div>
  `;

  gamesGrid.append(card);
  gameCards.push({ card, game });
});

function applyFilter(selectedTag) {
  const visibleCards = gameCards.filter(({ card, game }) => {
    const isVisible = selectedTag === "Tous" || game.tags.includes(selectedTag);
    card.hidden = !isVisible;
    card.classList.remove("featured", "solo");
    return isVisible;
  });

  visibleCards.forEach(({ card }, index) => {
    card.classList.toggle("featured", visibleCards.length > 1 && index < 2);
    card.classList.toggle("solo", visibleCards.length === 1);
  });

  visibleGamesCount.textContent = visibleCards.length;
  visibleGamesLabel.textContent = visibleCards.length > 1 ? "jeux affichés" : "jeu affiché";

  tagFilters.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.tag === selectedTag));
  });
}

tags.forEach((tag) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tag-filter";
  button.dataset.tag = tag;
  button.textContent = tag;
  button.setAttribute("aria-pressed", String(tag === "Tous"));
  button.addEventListener("click", () => applyFilter(tag));
  tagFilters.append(button);
});

applyFilter("Tous");

document.querySelector("#current-year").textContent = new Date().getFullYear();


const SUPABASE_CONFIG = window.BRAIN_GAMES_SUPABASE;
const supabaseClient =
  window.supabase && SUPABASE_CONFIG
    ? window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.publishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      )
    : null;

const authDialog = document.querySelector("#auth-dialog");
const accountButton = document.querySelector("#account-button");
const accountLabel = document.querySelector("#account-label");
const accountInitial = document.querySelector("#account-initial");
const profileCta = document.querySelector("#profile-cta");
const authClose = document.querySelector("#auth-close");
const guestView = document.querySelector("#auth-guest-view");
const profileView = document.querySelector("#auth-profile-view");
const authStatus = document.querySelector("#auth-status");
const googleLogin = document.querySelector("#google-login");
const emailAuthForm = document.querySelector("#email-auth-form");
const emailSignup = document.querySelector("#email-signup");
const profileForm = document.querySelector("#profile-form");
const logoutButton = document.querySelector("#logout-button");
let activeUser = null;
let activeProfile = null;
let emailRateLimitInterval = null;

const EMAIL_RATE_LIMIT_STORAGE_KEY = "brain-games-email-rate-limit-started-at";
const EMAIL_RATE_LIMIT_DURATION_MS = 60 * 60 * 1000;
const EMAIL_RATE_LIMIT_STEPS = 8;

function stopEmailRateLimitUpdates() {
  if (emailRateLimitInterval) {
    window.clearInterval(emailRateLimitInterval);
    emailRateLimitInterval = null;
  }
}

function setAuthStatus(message, kind = "") {
  stopEmailRateLimitUpdates();
  authStatus.textContent = message;
  authStatus.dataset.kind = kind;
}

function formatRemainingWait(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 10000) * 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}

function paintEmailRateLimitStatus(startedAt) {
  const elapsed = Date.now() - startedAt;
  const remaining = EMAIL_RATE_LIMIT_DURATION_MS - elapsed;

  if (remaining <= 0) {
    localStorage.removeItem(EMAIL_RATE_LIMIT_STORAGE_KEY);
    setAuthStatus("Vous pouvez maintenant réessayer.", "success");
    return false;
  }

  const progress = Math.min(
    EMAIL_RATE_LIMIT_STEPS,
    Math.floor((elapsed / EMAIL_RATE_LIMIT_DURATION_MS) * EMAIL_RATE_LIMIT_STEPS) + 1,
  );

  const warning = document.createElement("span");
  warning.className = "auth-status-line auth-status-line--danger";
  warning.textContent =
    "Trop d’e-mails ont été envoyés à l’ensemble des joueurs potentiels.";

  const wait = document.createElement("span");
  wait.className = "auth-status-line auth-status-line--info";
  wait.textContent =
    `Patientez encore environ ${formatRemainingWait(remaining)} avant de réessayer. ` +
    `(progression de l’attente ${progress}/${EMAIL_RATE_LIMIT_STEPS})`;

  authStatus.replaceChildren(warning, wait);
  authStatus.dataset.kind = "email-rate-limit";
  return true;
}

function startEmailRateLimitStatus() {
  stopEmailRateLimitUpdates();

  const storedStartedAt = Number(
    localStorage.getItem(EMAIL_RATE_LIMIT_STORAGE_KEY),
  );
  const startedAt =
    storedStartedAt &&
    Date.now() - storedStartedAt < EMAIL_RATE_LIMIT_DURATION_MS
      ? storedStartedAt
      : Date.now();

  localStorage.setItem(EMAIL_RATE_LIMIT_STORAGE_KEY, String(startedAt));

  if (!paintEmailRateLimitStatus(startedAt)) return;

  emailRateLimitInterval = window.setInterval(() => {
    if (!paintEmailRateLimitStatus(startedAt)) {
      stopEmailRateLimitUpdates();
    }
  }, 10000);
}

function hasActiveEmailRateLimit() {
  const startedAt = Number(
    localStorage.getItem(EMAIL_RATE_LIMIT_STORAGE_KEY),
  );
  return (
    startedAt > 0 &&
    Date.now() - startedAt < EMAIL_RATE_LIMIT_DURATION_MS
  );
}

function friendlyAuthError(error) {
  const message = error?.message || "Une erreur inattendue est survenue.";
  const translations = {
    "Invalid login credentials": "Adresse e-mail ou mot de passe incorrect.",
    "Email not confirmed": "Confirmez d’abord votre adresse e-mail.",
    "User already registered": "Un compte existe déjà avec cette adresse e-mail.",
    "Unsupported provider": "La connexion Google doit encore être activée dans Supabase.",
  };
  return translations[message] || message;
}

function openAuthDialog() {
  if (hasActiveEmailRateLimit()) {
    startEmailRateLimitStatus();
  } else {
    setAuthStatus("");
  }
  if (typeof authDialog.showModal === "function") {
    authDialog.showModal();
  } else {
    authDialog.setAttribute("open", "");
  }
}

function closeAuthDialog() {
  authDialog.close();
}

function getFallbackName(user) {
  const metadata = user.user_metadata || {};
  const emailName = (user.email || "").split("@")[0];
  return (
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    emailName ||
    "Joueur"
  ).slice(0, 24);
}

async function loadOrCreateProfile(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const fallbackName = getFallbackName(user);
  const displayName = fallbackName.length >= 2 ? fallbackName : "Joueur";
  const { data: created, error: createError } = await supabaseClient
    .from("profiles")
    .insert({ id: user.id, display_name: displayName })
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

function paintAccount(user, profile) {
  activeUser = user;
  activeProfile = profile;

  if (!user) {
    accountLabel.textContent = "Se connecter";
    accountInitial.textContent = "?";
    guestView.hidden = false;
    profileView.hidden = true;
    profileCta.textContent = "Créer mon profil";
    return;
  }

  const name = profile?.display_name || getFallbackName(user);
  const initial = name.trim().charAt(0).toUpperCase() || "J";
  accountLabel.textContent = name;
  accountInitial.textContent = initial;
  profileCta.textContent = "Ouvrir mon profil";
  guestView.hidden = true;
  profileView.hidden = false;
  document.querySelector("#profile-avatar").textContent = initial;
  document.querySelector("#profile-name").textContent = name;
  document.querySelector("#profile-email").textContent = user.email || "Compte Google";
  document.querySelector("#profile-display-name").value = name;
}

async function renderSession(session) {
  if (!session?.user || session.user.is_anonymous || !session.user.email) {
    paintAccount(null, null);
    return;
  }

  try {
    const profile = await loadOrCreateProfile(session.user);
    paintAccount(session.user, profile);
  } catch (error) {
    paintAccount(session.user, null);
    setAuthStatus(friendlyAuthError(error), "error");
  }
}

accountButton.addEventListener("click", openAuthDialog);
profileCta.addEventListener("click", openAuthDialog);
authClose.addEventListener("click", closeAuthDialog);
authDialog.addEventListener("click", (event) => {
  if (event.target === authDialog) closeAuthDialog();
});

googleLogin.addEventListener("click", async () => {
  if (!supabaseClient) return;
  setAuthStatus("Ouverture de Google…");
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) setAuthStatus(friendlyAuthError(error), "error");
});

emailAuthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;

  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  setAuthStatus("Connexion…");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  setAuthStatus(
    error ? friendlyAuthError(error) : "Connexion réussie.",
    error ? "error" : "success",
  );
});

emailSignup.addEventListener("click", async () => {
  if (!supabaseClient) return;

  const displayName = document.querySelector("#auth-display-name").value.trim();
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;

  if (displayName.length < 2 || displayName.length > 24) {
    setAuthStatus("Choisissez un nom de joueur entre 2 et 24 caractères.", "error");
    return;
  }

  if (!emailAuthForm.reportValidity()) return;
  setAuthStatus("Création du compte…");

  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    if (/email rate limit exceeded/i.test(error.message || "")) {
      startEmailRateLimitStatus();
    } else {
      setAuthStatus(friendlyAuthError(error), "error");
    }
  } else if (!data.session) {
    setAuthStatus("Compte créé. Confirmez maintenant votre adresse e-mail.", "success");
  } else {
    setAuthStatus("Votre profil Brain Games est prêt.", "success");
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient || !activeUser) return;

  const displayName = document.querySelector("#profile-display-name").value.trim();
  if (displayName.length < 2 || displayName.length > 24) {
    setAuthStatus("Le nom doit contenir entre 2 et 24 caractères.", "error");
    return;
  }

  setAuthStatus("Enregistrement…");
  const { data, error } = await supabaseClient
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", activeUser.id)
    .select()
    .single();

  if (error) {
    setAuthStatus(friendlyAuthError(error), "error");
    return;
  }

  paintAccount(activeUser, data);
  setAuthStatus("Profil enregistré.", "success");
});

logoutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  setAuthStatus(
    error ? friendlyAuthError(error) : "Vous êtes déconnecté.",
    error ? "error" : "success",
  );
});

if (!supabaseClient) {
  setAuthStatus("Le service de connexion est momentanément indisponible.", "error");
  accountButton.disabled = true;
  profileCta.disabled = true;
} else {
  supabaseClient.auth.getSession().then(({ data }) => renderSession(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => renderSession(session), 0);
  });
}
