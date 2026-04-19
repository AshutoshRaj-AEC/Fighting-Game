# Fighting Game Prototype

A browser-based 2D fighting game prototype built with HTML5 canvas, vanilla JavaScript, and sprite-based animations.

## Current Version

This project is currently a cleaned and expanded prototype with:

- player movement
- jump mechanics with gravity
- punch and kick attacks
- block and dodge actions
- health bars
- round restart
- a simple CPU opponent
- built-in sound effects using the Web Audio API

## Project Files

- `Canvas.html` - the main page and UI
- `Canvas.js` - the game logic, controls, combat, and rendering
- `images/` - character sprites and background assets

## How To Run

You can run the game in either of these ways.

### Option 1: Open Directly

Open `Canvas.html` in your browser.

### Option 2: Run A Local Server

From the project folder, run:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/Canvas.html
```

## Controls

- `ArrowLeft` / `ArrowRight` - move
- `W` or `ArrowUp` - jump
- `A` - punch
- `S` - kick
- `D` - block
- `Space` - dodge
- `R` - restart round

You can also use the on-screen buttons.

## Notes

- Sound effects start after your first interaction because browsers usually require a user action before enabling audio.
- This is still a prototype, not a full fighting game yet.

## Possible Next Steps

- add a proper start screen
- add rounds and score tracking
- improve CPU behavior
- add attack hitboxes and better collision logic
- add more animations and character states
- add background music and visual effects
