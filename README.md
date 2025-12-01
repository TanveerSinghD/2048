# 2048 Remix

Vanilla HTML/CSS/JS take on 2048 with special tiles, power-ups, easing-driven animations, and a responsive layout that works with both keyboard and touch.

## Game Link
https://tanveersinghd.github.io/2048/

## Quick start
```sh
cd /Users/tanveersd/2048
python -m http.server
```
Visit http://localhost:8000 in your browser.

## Features
- Arrow/WASD keys **and** swipe controls.
- Special tiles: Wild (merges with anything for a double) and Doubler (matching merges jump by 4x).
- Power-ups (single-use per run): Drop Wild, Bomb Blast (clear the highest tile + neighbors), Shuffle.
- Light/dark theme toggle saved in `localStorage`.
- Local leaderboard for the top 5 scores and a simple state machine (`idle → animating → idle/over/won`).
- Responsive board sizing and easing animations for slides, merges, and blasts.

## Controls
- Keyboard: Arrow keys or WASD.
- Touch: swipe in any direction.
- Power-ups: click a chip while the board is idle. Each can be used once per run.
- Theme: toggle light/dark via the header button (persists locally).

## Specials and power-ups
- **Wild tile (W):** merges with anything it hits, doubling the larger value.
- **Doubler tile (x2):** must match the same value; merge jumps it by 4×.
- **Drop Wild:** spawns a wild tile immediately.
- **Bomb Blast:** clears the highest tile and its surrounding 3×3 neighbors.
- **Shuffle:** randomizes all tile positions to break stalemates.

## Run locally
1. `cd /Users/tanveersd/2048`
2. Start a simple server (prevents any browser file-access issues):
   ```sh
   python -m http.server
   ```
3. Visit http://localhost:8000 in your browser and play with the arrow keys or swipe on touch devices.

You can also open `index.html` directly in a browser if you prefer.

## Quick primer
- **Objective:** combine tiles to climb past 2048. Highest score and top tile persist locally.
- **Special tiles:** Wild tiles merge with any neighbor into a doubled value. Doubler tiles merge only with a matching value but jump it by 4x.
- **Power-ups:** use them while the board is idle. Drop Wild adds a wild tile, Bomb Blast clears a 3×3 around the highest tile, Shuffle randomizes positions.
- **Leaderboard:** finishing a game (win or lose) records your score, top tile, and timestamp in the local top 5.

## File map
- `index.html` – layout and UI containers
- `style.css` – light/dark theme, board styling, and animations
- `script.js` – game logic, movement/merge handling, state machine, and leaderboard
