const size = 4;
const animationMs = 200;
const defaultPowers = { wild: 2, bomb: 1, shuffle: 1 };
const leaderboardKey = "leaderboard-2048-v2";
const themeKey = "theme-2048";

const gridEl = document.getElementById("grid");
const tilesEl = document.getElementById("tiles");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const topTileEl = document.getElementById("top-tile");
const restartBtn = document.getElementById("restart");
const statusEl = document.getElementById("status");
const stateIndicator = document.getElementById("state-indicator");
const themeToggle = document.getElementById("theme-toggle");
const helpBtn = document.getElementById("help");
const leaderboardList = document.getElementById("leaderboard");
const clearLeaderboardBtn = document.getElementById("clear-leaderboard");

const powerButtons = {
  wild: document.getElementById("power-wild"),
  bomb: document.getElementById("power-bomb"),
  shuffle: document.getElementById("power-shuffle"),
};

const powerCountEls = {
  wild: document.getElementById("wild-count"),
  bomb: document.getElementById("bomb-count"),
  shuffle: document.getElementById("shuffle-count"),
};

const vectors = {
  ArrowUp: { r: -1, c: 0 },
  ArrowDown: { r: 1, c: 0 },
  ArrowLeft: { r: 0, c: -1 },
  ArrowRight: { r: 0, c: 1 },
};

const keyMap = {
  w: "ArrowUp",
  W: "ArrowUp",
  s: "ArrowDown",
  S: "ArrowDown",
  a: "ArrowLeft",
  A: "ArrowLeft",
  d: "ArrowRight",
  D: "ArrowRight",
};

let board = createBoard();
let nextId = 1;
let score = 0;
let best = Number(
  localStorage.getItem("best-2048-score") ||
    normalizeStoredBest(Number(localStorage.getItem("best-2048") || 0)) ||
    0
);
let topTile = 0;
let powerUses = { ...defaultPowers };
let touchStart = null;
const gameState = createStateMachine("idle");

function createBoard() {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function setup() {
  renderGrid();
  bindControls();
  loadTheme();
  renderLeaderboard();
  startGame();
}

function bindControls() {
  restartBtn.addEventListener("click", startGame);
  window.addEventListener("keydown", handleKey);
  window.addEventListener("resize", refreshTilePositions);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd);

  themeToggle.addEventListener("click", toggleTheme);
  helpBtn.addEventListener("click", showHelp);
  clearLeaderboardBtn.addEventListener("click", clearLeaderboard);

  Object.entries(powerButtons).forEach(([kind, btn]) => {
    btn.addEventListener("click", () => tryPower(kind));
  });
}

function loadTheme() {
  const stored = localStorage.getItem(themeKey) || "light";
  document.documentElement.dataset.theme = stored;
  themeToggle.textContent = stored === "dark" ? "Light mode" : "Dark mode";
}

function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(themeKey, next);
  themeToggle.textContent = next === "dark" ? "Light mode" : "Dark mode";
}

function renderGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < size * size; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    gridEl.appendChild(cell);
  }
}

function startGame() {
  board = createBoard();
  tilesEl.innerHTML = "";
  statusEl.classList.add("hidden");
  nextId = 1;
  score = 0;
  topTile = 0;
  powerUses = { ...defaultPowers };
  gameState.to("idle");
  addRandomTile();
  addRandomTile();
  topTile = getHighestTile();
  updateHud();
}

function handleKey(event) {
  const mapped = keyMap[event.key] || event.key;
  if (!vectors[mapped]) return;
  event.preventDefault();
  move(mapped);
}

function onTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function onTouchEnd(event) {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  touchStart = null;

  if (Math.max(absX, absY) < 20) return;
  const direction =
    absX > absY ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp";
  move(direction);
}

function canAct() {
  return gameState.is("idle") || gameState.is("won");
}

function move(key) {
  if (!vectors[key] || !canAct()) return;
  const vector = vectors[key];

  gameState.to("animating");
  clearMergedFlags();

  const traversals = buildTraversals(vector);
  const moves = [];
  const merges = [];
  let moved = false;
  let gained = 0;

  traversals.rows.forEach((row) => {
    traversals.cols.forEach((col) => {
      const tile = board[row][col];
      if (!tile) return;

      const { farthest, next } = findFarthestPosition({ row, col }, vector);
      const nextTile =
        withinBounds(next) && board[next.row][next.col]
          ? board[next.row][next.col]
          : null;

      if (nextTile && canMerge(tile, nextTile) && !nextTile.merged) {
        const outcome = mergeTiles(tile, nextTile);
        board[row][col] = null;
        nextTile.value = outcome.value;
        nextTile.type = outcome.type;
        nextTile.merged = true;

        tile.row = next.row;
        tile.col = next.col;
        moves.push({ tile, to: next, remove: true });
        merges.push({ target: nextTile, outcome });
        gained += outcome.gain;
        moved = true;
      } else {
        board[row][col] = null;
        board[farthest.row][farthest.col] = tile;
        tile.row = farthest.row;
        tile.col = farthest.col;
        if (farthest.row !== row || farthest.col !== col) {
          moved = true;
        }
        moves.push({ tile, to: farthest, remove: false });
      }
    });
  });

  animateMoves(moves, merges, moved).then(() => {
    if (moved) {
      score += gained;
      topTile = getHighestTile();
      updateBest();
      addRandomTile();
      refreshTilePositions();
    }
    finalizeMove();
  });
}

function animateMoves(moves, merges, moved) {
  moves.forEach(({ tile, to }) => {
    if (tile.el) setTilePosition(tile.el, to.row, to.col);
  });

  return new Promise((resolve) => {
    if (!moved) {
      resolve();
      return;
    }

    const removableIds = moves.filter((m) => m.remove).map((m) => m.tile.id);

    window.setTimeout(() => {
      merges.forEach(({ target, outcome }) => {
        updateTileElement(target);
        if (outcome.burst) pulseTile(target.el);
      });

      removableIds.forEach((id) => {
        const tileEl = document.querySelector(`[data-id="${id}"]`);
        if (tileEl) tileEl.remove();
      });

      resolve();
    }, animationMs);
  });
}

function pulseTile(el) {
  if (!el) return;
  el.classList.add("tile-burst");
  window.setTimeout(() => el.classList.remove("tile-burst"), 220);
}

function finalizeMove() {
  if (topTile >= 2048 && !gameState.is("won")) {
    statusEl.textContent = "You reached 2048+";
    statusEl.classList.remove("hidden");
    recordRun("win");
    gameState.to("won");
  } else if (isGameOver()) {
    statusEl.textContent = "Game over";
    statusEl.classList.remove("hidden");
    recordRun("over");
    gameState.to("over");
  } else {
    statusEl.classList.add("hidden");
    gameState.to("idle");
  }

  updateHud();
}

function buildTraversals(vector) {
  const rows = [];
  const cols = [];

  for (let i = 0; i < size; i += 1) {
    rows.push(i);
    cols.push(i);
  }

  if (vector.r === 1) rows.reverse();
  if (vector.c === 1) cols.reverse();

  return { rows, cols };
}

function findFarthestPosition(start, vector) {
  let previous = start;
  let cell = { row: start.row + vector.r, col: start.col + vector.c };

  while (withinBounds(cell) && !board[cell.row][cell.col]) {
    previous = cell;
    cell = { row: cell.row + vector.r, col: cell.col + vector.c };
  }

  return { farthest: previous, next: cell };
}

function withinBounds(cell) {
  return cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
}

function clearMergedFlags() {
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const tile = board[r][c];
      if (tile) tile.merged = false;
    }
  }
}

function addRandomTile(forceType) {
  const empties = emptyCells();
  if (!empties.length) return null;

  const spot = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.1 ? 4 : 2;
  const tile = {
    id: nextId++,
    row: spot.row,
    col: spot.col,
    value,
    merged: false,
    type: forceType || chooseSpawnType(),
  };

  board[spot.row][spot.col] = tile;
  createTileElement(tile, true);
  topTile = Math.max(topTile, tile.value);
  return tile;
}

function chooseSpawnType() {
  if (topTile >= 64 && Math.random() < 0.12) return "wild";
  if (topTile >= 32 && Math.random() < 0.1) return "doubler";
  return "normal";
}

function emptyCells() {
  const cells = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!board[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function createTileElement(tile, isNew) {
  const tileEl = document.createElement("div");
  tile.el = tileEl;
  tileEl.dataset.id = tile.id;
  tileEl.className = tileClassName(tile);
  tileEl.textContent = tileLabel(tile);
  applySizeClass(tileEl, tile.value);
  tileEl.style.transition = "none";
  setTilePosition(tileEl, tile.row, tile.col);
  tilesEl.appendChild(tileEl);
  requestAnimationFrame(() => {
    tileEl.style.transition = "";
    if (isNew) tileEl.classList.add("tile-new");
  });
  return tileEl;
}

function updateTileElement(tile) {
  const tileEl = tile.el;
  if (!tileEl) return;
  tileEl.textContent = tileLabel(tile);
  tileEl.className = tileClassName(tile);
  applySizeClass(tileEl, tile.value);
  setTilePosition(tileEl, tile.row, tile.col);
}

function tileClass(value) {
  if (value >= 8192) return "8192";
  if (value >= 4096) return "4096";
  if (value >= 2048) return "2048";
  return String(value);
}

function tileClassName(tile) {
  const specials =
    tile.type && tile.type !== "normal" ? ` tile-${tile.type}` : "";
  return `tile tile-${tileClass(tile.value)}${specials}`;
}

function tileLabel(tile) {
  if (tile.type === "wild") return "W";
  if (tile.type === "doubler") return "x2";
  return tile.value;
}

function applySizeClass(el, value) {
  el.classList.remove("small", "tiny");
  if (value >= 1024 && value < 8192) el.classList.add("small");
  if (value >= 8192) el.classList.add("tiny");
}

function translateTo(row, col) {
  const gap = getGap();
  const cell = getCellSize();
  const x = gap + col * (cell + gap);
  const y = gap + row * (cell + gap);
  return { x, y };
}

function getCellSize() {
  const val = getComputedStyle(document.documentElement).getPropertyValue(
    "--cell-size"
  );
  return parseFloat(val);
}

function getGap() {
  const val = getComputedStyle(document.documentElement).getPropertyValue(
    "--gap"
  );
  return parseFloat(val);
}

function refreshTilePositions() {
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const tile = board[r][c];
      if (tile?.el) {
        setTilePosition(tile.el, tile.row, tile.col);
      }
    }
  }
}

function updateScore() {
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  topTileEl.textContent = topTile;
  updateStateIndicator();
  updatePowerButtons();
}

function updatePowerButtons() {
  Object.entries(powerButtons).forEach(([kind, btn]) => {
    const remaining = powerUses[kind] ?? 0;
    powerCountEls[kind].textContent = remaining;
    btn.disabled = remaining <= 0 || !canAct();
  });
}

function updateStateIndicator() {
  stateIndicator.textContent = gameState.current;
}

function updateBest() {
  if (score > best) {
    best = score;
    localStorage.setItem("best-2048-score", String(best));
  }
}

function isGameOver() {
  if (emptyCells().length) return false;

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const tile = board[r][c];
      if (!tile) continue;
      const neighbors = [
        { row: r + 1, col: c },
        { row: r - 1, col: c },
        { row: r, col: c + 1 },
        { row: r, col: c - 1 },
      ];
      if (
        neighbors.some(
          (cell) =>
            withinBounds(cell) && canMerge(tile, board[cell.row][cell.col])
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function setTilePosition(el, row, col) {
  const { x, y } = translateTo(row, col);
  el.style.setProperty("--x", `${x}px`);
  el.style.setProperty("--y", `${y}px`);
}

function getHighestTile() {
  let highest = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const val = board[r][c]?.value || 0;
      if (val > highest) highest = val;
    }
  }
  return highest;
}

function canMerge(a, b) {
  if (!a || !b) return false;
  if (a.type === "wild" || b.type === "wild") return true;
  if (a.type === "doubler" || b.type === "doubler") return a.value === b.value;
  return a.value === b.value;
}

function mergeTiles(moving, target) {
  const hasWild = moving.type === "wild" || target.type === "wild";
  const hasDoubler = moving.type === "doubler" || target.type === "doubler";
  const base = hasWild ? Math.max(moving.value, target.value) : target.value;
  const value = hasWild ? base * 2 : hasDoubler ? target.value * 4 : target.value * 2;

  return {
    value,
    type: "normal",
    gain: value,
    burst: hasWild || hasDoubler,
  };
}

function tryPower(kind) {
  if (!canAct() || !powerUses[kind]) return;
  gameState.to("animating");

  let applied = false;
  if (kind === "wild") applied = Boolean(addRandomTile("wild"));
  if (kind === "bomb") applied = blastHighestTile();
  if (kind === "shuffle") applied = shuffleTiles();

  if (applied) {
    powerUses[kind] -= 1;
    topTile = getHighestTile();
    updateHud();
  }

  window.setTimeout(() => {
    if (!gameState.is("over")) gameState.to("idle");
    updateHud();
  }, 220);
}

function blastHighestTile() {
  const target = highestTileObject();
  if (!target) return false;

  const blastCells = neighborsIncluding(target.row, target.col);
  blastCells.forEach((cell) => {
    const tile = board[cell.row]?.[cell.col];
    if (!tile) return;
    board[cell.row][cell.col] = null;
    tile.el?.classList.add("tile-bombed");
    window.setTimeout(() => tile.el?.remove(), 180);
  });
  board[target.row][target.col] = null;
  return true;
}

function neighborsIncluding(row, col) {
  const cells = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (withinBounds({ row: r, col: c })) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function highestTileObject() {
  let bestTile = null;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const tile = board[r][c];
      if (!tile) continue;
      if (!bestTile || tile.value > bestTile.value) bestTile = tile;
    }
  }
  return bestTile;
}

function shuffleTiles() {
  const tiles = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (board[r][c]) {
        tiles.push(board[r][c]);
        board[r][c] = null;
      }
    }
  }

  if (!tiles.length) return false;

  const positions = shuffleArray(
    Array.from({ length: size * size }, (_, idx) => ({
      row: Math.floor(idx / size),
      col: idx % size,
    }))
  );

  tiles.forEach((tile, index) => {
    const pos = positions[index];
    tile.row = pos.row;
    tile.col = pos.col;
    board[pos.row][pos.col] = tile;
    setTilePosition(tile.el, pos.row, pos.col);
    pulseTile(tile.el);
  });

  return true;
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function recordRun(label) {
  const entry = {
    score,
    top: topTile,
    label,
    date: new Date().toISOString(),
  };
  const list = loadLeaderboard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.top - a.top);
  const trimmed = list.slice(0, 5);
  localStorage.setItem(leaderboardKey, JSON.stringify(trimmed));
  renderLeaderboard(trimmed);
}

function loadLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(leaderboardKey) || "[]") || [];
  } catch (e) {
    return [];
  }
}

function renderLeaderboard(list = loadLeaderboard()) {
  leaderboardList.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("li");
    empty.textContent = "No runs yet. Reach 256+ to start filling the board.";
    leaderboardList.appendChild(empty);
    return;
  }

  list.forEach((entry) => {
    const li = document.createElement("li");
    const scoreSpan = document.createElement("span");
    scoreSpan.textContent = `${entry.score} pts`;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${entry.top} tile · ${formatDate(entry.date)} · ${
      entry.label
    }`;
    li.append(scoreSpan, meta);
    leaderboardList.appendChild(li);
  });
}

function formatDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clearLeaderboard() {
  localStorage.removeItem(leaderboardKey);
  renderLeaderboard([]);
}

function showHelp() {
  const msg = [
    "Controls: arrow keys or swipe. States: idle → animating → idle/over/won.",
    "Special tiles: Wild merges with anything for a double. Doubler merges matching tiles for a x4 jump.",
    "Power-ups: Drop Wild (adds a wild tile), Bomb Blast (clears highest tile + neighbors), Shuffle (reorders all tiles).",
    "Dark mode and leaderboard are stored locally.",
  ].join("\n\n");
  window.alert(msg);
}

function createStateMachine(initial) {
  const graph = {
    idle: ["animating", "over", "won"],
    animating: ["idle", "over", "won"],
    over: ["idle"],
    won: ["idle", "animating"],
  };

  return {
    current: initial,
    is(name) {
      return this.current === name;
    },
    can(next) {
      return graph[this.current]?.includes(next);
    },
    to(next) {
      if (graph[this.current]?.includes(next)) {
        this.current = next;
        updateStateIndicator();
      }
    },
  };
}

function normalizeStoredBest(raw) {
  if (!Number.isFinite(raw) || raw < 2) return 0;
  let val = 2;
  while (val * 2 <= raw) {
    val *= 2;
  }
  return val;
}

setup();
