const games = [
  {
    name: "Bingo Réversible",
    description: "Un bingo tactique où chaque choix peut renverser le cours de la partie.",
    category: "Tactique",
    icon: "↔",
    accent: "#6c45db",
    url: "https://seb16120.github.io/bingo-reversible/",
  },
  {
    name: "Elite Pixel Art",
    description: "Créez et explorez un univers rétro, pixel après pixel.",
    category: "Créativité",
    icon: "▦",
    accent: "#e05f5f",
    url: "https://seb16120.github.io/Elite-Pixel-Art/",
  },
  {
    name: "Lucky 21",
    description: "Tentez votre chance et approchez-vous du nombre parfait.",
    category: "Cartes",
    icon: "♠",
    accent: "#208b73",
    url: "https://seb16120.github.io/Lucky-21/",
  },
  {
    name: "Exit Strategy 3",
    description: "Anticipez, planifiez et trouvez la meilleure voie de sortie.",
    category: "Stratégie",
    icon: "⌁",
    accent: "#d16f20",
    url: "https://seb16120.github.io/Exit-Strategy-3/",
  },
  {
    name: "Otrio",
    description: "Alignez les formes, bloquez vos adversaires et maîtrisez la grille.",
    category: "Logique",
    icon: "◎",
    accent: "#3477cf",
    url: "https://seb16120.github.io/otrio-web/",
  },
];

const gamesGrid = document.querySelector("#games-grid");

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
      <span class="game-tag">${game.category}</span>
    </div>
  `;

  gamesGrid.append(card);
});

document.querySelector("#current-year").textContent = new Date().getFullYear();
