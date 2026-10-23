# Stickman Sprint

A dependency-free side scroller for the browser.

Open `index.html` in a modern browser to play. No install or build step is needed. You can also run `python -m http.server 8000` and visit `http://localhost:8000`.

Press **Left** and **Right** to move, and **Up** or **Space** to jump. **A**, **D**, and **W** work too. On a touch screen, hold the movement buttons and tap Jump. Press **P** to pause and **R** to restart after a collision. Obstacles stay in place as you move through the world. Your score tracks your furthest progress and your best score is saved in your browser.

The project uses plain HTML, CSS, and JavaScript. Game state and rendering live in `game.js` so the mechanics and visuals can be extended later.
