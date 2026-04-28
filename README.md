# Fighting Game Prototype

A browser-based 2D fighting game prototype built with HTML5 Canvas, vanilla JavaScript, sprite animations, pet companions, and round-based combat.

## Live Demo

Play the deployed game here:

`https://imaginative-baklava-e105c6.netlify.app/`

## Current Version

The project is currently at `v0.9` with:

- player movement and jump mechanics
- punch, kick, block, and dodge actions
- round-based match flow
- start screen, pause/resume, and match-over UI
- health bars and HUD
- combat hitboxes and overlap control
- smarter CPU spacing and reactions
- selectable pet companions
- live pet switching during the match
- pet powers
- combat effects like floating damage text, sparks, and screen shake
- built-in sound effects using the Web Audio API

## Available Pet Companions

The player can choose between:

- Hawk
- Wolf
- Snake
- Phoenix
- Dragon

The CPU uses:

- Frost Owl

## Project Files

- `index.html` - the main app page and UI
- `Canvas.js` - game logic, rendering, combat, pets, and effects
- `images/` - character sprites and background assets

## How To Run Locally

### Option 1: Open Directly

Open `index.html` in your browser.

### Option 2: Run A Local Server

From the project folder, run:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Controls

- `ArrowLeft` / `ArrowRight` - move
- `W` or `ArrowUp` - jump
- `A` - punch
- `S` - kick
- `D` - block
- `Space` - dodge
- `F` - trigger pet power
- `Q` / `E` - switch pets
- `P` - pause / resume
- `R` - restart round or continue flow depending on state

You can also use the on-screen buttons.

## Notes

- Sound effects begin after your first interaction because browsers usually require a user action before enabling audio.
- This is still a prototype and not a full production fighting game yet.

## Next Ideas

- difficulty levels
- special attacks and combo chains
- stronger AI behavior
- pet-specific cooldown UI
- better sprite art and animation polish
- menu/settings screen
- background music and audio controls
