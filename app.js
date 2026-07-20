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
