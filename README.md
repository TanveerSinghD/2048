# 2048 Clone

Lightweight vanilla HTML/CSS/JS take on 2048 with animated slides and a clean light theme.

## Features
- Arrow key controls with smooth slide and merge animations.
- Score shows your highest tile; Best saves in `localStorage`.
- Responsive board sizing for smaller screens.

## Run locally
1. `cd /Users/tanveersd/2048`
2. Start a simple server (prevents any browser file-access issues):
   ```sh
   python -m http.server
   ```
3. Visit http://localhost:8000 in your browser and play with the arrow keys.

You can also open `index.html` directly in a browser if you prefer.

## File map
- `index.html` – layout and UI containers
- `style.css` – light theme, board styling, and animations
- `script.js` – game logic, movement/merge handling, and scoring
