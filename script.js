const size = 4;
const animationMs = 160;

const gridEl = document.getElementById("grid");
const tilesEl = document.getElementById("tiles");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restart");
const statusEl = document.getElementById("status");

let board = createBoard();
let nextId = 1;
let score = 0;
let best = normalizeStoredBest(Number(localStorage.getItem("best-2048") || 0));
let locked = false;

const vectors = {
  ArrowUp: { r: -1, c: 0 },
  ArrowDown: { r: 1, c: 0 },
  ArrowLeft: { r: 0, c: -1 },
  ArrowRight: { r: 0, c: 1 },
};

function createBoard() {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function setup() {
  renderGrid();
  bestEl.textContent = best;
  restartBtn.addEventListener("click", startGame);
  window.addEventListener("keydown", handleKey);
  window.addEventListener("resize", refreshTilePositions);
  startGame();
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
  locked = false;
  updateScoreFromBoard();
  addRandomTile();
  addRandomTile();
  updateScoreFromBoard();
}

function handleKey(event) {
  if (!vectors[event.key]) return;
  event.preventDefault();
  move(event.key);
}

function move(key) {
  if (locked) return;
  const vector = vectors[key];
  if (!vector) return;

  locked = true;
  clearMergedFlags();

  const traversals = buildTraversals(vector);
  const moves = [];
  const merges = [];
  let moved = false;

  traversals.rows.forEach((row) => {
    traversals.cols.forEach((col) => {
      const tile = board[row][col];
      if (!tile) return;

      const { farthest, next } = findFarthestPosition({ row, col }, vector);
      const nextTile =
        withinBounds(next) && board[next.row][next.col]
          ? board[next.row][next.col]
          : null;

      if (nextTile && nextTile.value === tile.value && !nextTile.merged) {
        board[row][col] = null;
        nextTile.value *= 2;
        nextTile.merged = true;

        tile.row = next.row;
        tile.col = next.col;
        moves.push({ tile, to: next, remove: true });
        merges.push(nextTile);
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

  animateMoves(moves, merges, moved);
}

function animateMoves(moves, merges, moved) {
  moves.forEach(({ tile, to }) => {
    const el = tile.el;
    if (!el) return;
    setTilePosition(el, to.row, to.col);
  });

  if (!moved) {
    locked = false;
    return;
  }

  const removableIds = moves.filter((m) => m.remove).map((m) => m.tile.id);

  window.setTimeout(() => {
    merges.forEach((target) => {
      updateTileElement(target);
      target.el.classList.add("tile-burst");
      window.setTimeout(() => target.el.classList.remove("tile-burst"), 160);
    });

    removableIds.forEach((id) => {
      const tileEl = document.querySelector(`[data-id="${id}"]`);
      if (tileEl) tileEl.remove();
    });

    updateScoreFromBoard();
    addRandomTile();
    refreshTilePositions();

    if (isGameOver()) {
      statusEl.textContent = "Game over";
      statusEl.classList.remove("hidden");
    }

    locked = false;
  }, animationMs);
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

function addRandomTile() {
  const empties = emptyCells();
  if (!empties.length) return;

  const spot = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.1 ? 4 : 2;
  const tile = {
    id: nextId++,
    row: spot.row,
    col: spot.col,
    value,
    merged: false,
  };

  board[spot.row][spot.col] = tile;
  createTileElement(tile, true);
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
  tileEl.className = "tile tile-" + tileClass(tile.value);
  tileEl.textContent = tile.value;
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
  tileEl.textContent = tile.value;
  tileEl.className = "tile tile-" + tileClass(tile.value);
  applySizeClass(tileEl, tile.value);
  setTilePosition(tileEl, tile.row, tile.col);
}

function tileClass(value) {
  if (value >= 8192) return "8192";
  if (value >= 4096) return "4096";
  if (value >= 2048) return "2048";
  return String(value);
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
  // kept for backward compatibility; delegates to the new scorer
  updateScoreFromBoard();
}

function updateScoreFromBoard() {
  score = getHighestTile();
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem("best-2048", String(best));
  }
  bestEl.textContent = best;
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
      if (neighbors.some((cell) => withinBounds(cell) && board[cell.row][cell.col]?.value === tile.value)) {
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

function normalizeStoredBest(raw) {
  if (!Number.isFinite(raw) || raw < 2) return 0;
  let val = 2;
  while (val * 2 <= raw) {
    val *= 2;
  }
  return val;
}

setup();
