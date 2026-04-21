const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");
const gameStateLabel = document.getElementById("gameStateLabel");
const controlsHint = document.getElementById("controlsHint");
const startOverlay = document.getElementById("startOverlay");
const matchOverlay = document.getElementById("matchOverlay");
const matchOverlayKicker = document.getElementById("matchOverlayKicker");
const matchOverlayTitle = document.getElementById("matchOverlayTitle");
const matchOverlayText = document.getElementById("matchOverlayText");
const pauseButton = document.getElementById("pauseGame");

const arena = {
  width: canvas.width,
  height: canvas.height,
  floorY: canvas.height - 62,
};

const frames = {
  idle: [1, 2, 3, 4, 5, 6, 7, 8],
  kick: [1, 2, 3, 4, 5, 6, 7],
  punch: [1, 2, 3, 4, 5, 6, 7],
  backward: [1, 2, 3, 4, 5, 6],
  Block: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  forward: [1, 2, 3, 4, 5, 6],
};

const imageCache = {};
const controls = {
  left: false,
  right: false,
};

const state = {
  running: false,
  paused: false,
  phase: "pre_match",
  winner: "",
  lastTime: 0,
  cpuDecisionTimer: 0,
  cpuAttackCooldown: 0,
  roundNumber: 1,
  playerRoundsWon: 0,
  cpuRoundsWon: 0,
  roundsToWin: 3,
  matchOver: false,
};

const physics = {
  gravity: 1600,
  jumpVelocity: -700,
};

let audioContext;

const fighterDefaults = {
  player: {
    x: 120,
    health: 100,
  },
  cpu: {
    x: 640,
    health: 100,
  },
};

function loadImage(src, callback) {
  const img = new Image();
  img.onload = () => callback(img);
  img.src = src;
}

function imagePath(frameNumber, animation) {
  return "images/" + animation + "/" + frameNumber + ".png";
}

function loadImages(callback) {
  const animations = Object.keys(frames);
  const images = {};
  let imagesToLoad = 0;

  animations.forEach((animation) => {
    images[animation] = [];
    imagesToLoad += frames[animation].length;
  });

  animations.forEach((animation) => {
    frames[animation].forEach((frameNumber, index) => {
      loadImage(imagePath(frameNumber, animation), (image) => {
        images[animation][index] = image;
        imagesToLoad -= 1;

        if (imagesToLoad === 0) {
          callback(images);
        }
      });
    });
  });
}

function createFighter(config) {
  return {
    name: config.name,
    x: config.x,
    y: arena.floorY - config.height,
    width: config.width,
    height: config.height,
    facing: config.facing,
    health: 100,
    animation: "idle",
    frameIndex: 0,
    frameTimer: 0,
    frameInterval: 0.09,
    speed: config.speed,
    isAttacking: false,
    attackTimer: 0,
    attackDuration: 0,
    attackName: "",
    attackDamage: 0,
    attackRange: 0,
    attackConnected: false,
    isBlocking: false,
    blockTimer: 0,
    dodgeTimer: 0,
    hitFlashTimer: 0,
    tint: config.tint,
    spriteScale: config.spriteScale,
    velocityY: 0,
    isJumping: false,
    pet: {
      name: config.pet.name,
      type: config.pet.type,
      accent: config.pet.accent,
      glow: config.pet.glow,
      x: config.x - 40,
      y: arena.floorY - config.height - 50,
      bobTimer: Math.random() * Math.PI * 2,
    },
  };
}

const player = createFighter({
  name: "Player",
  x: 120,
  width: 180,
  height: 240,
  facing: 1,
  speed: 240,
  tint: "rgba(255, 196, 61, 0.18)",
  spriteScale: 1,
  pet: {
    name: "Solar Eagle",
    type: "eagle",
    accent: "#ffd166",
    glow: "rgba(255, 189, 92, 0.32)",
  },
});

const cpu = createFighter({
  name: "CPU",
  x: 640,
  width: 180,
  height: 240,
  facing: -1,
  speed: 180,
  tint: "rgba(70, 160, 255, 0.18)",
  spriteScale: -1,
  pet: {
    name: "Frost Owl",
    type: "owl",
    accent: "#90e0ef",
    glow: "rgba(126, 214, 223, 0.3)",
  },
});

function setStatus(message) {
  statusText.textContent = message;
}

function setUiState() {
  const startVisible = state.phase === "pre_match";
  const matchVisible = state.phase === "match_over";

  startOverlay.classList.toggle("visible", startVisible);
  matchOverlay.classList.toggle("visible", matchVisible);

  if (state.phase === "pre_match") {
    gameStateLabel.textContent = "Waiting to start";
    controlsHint.textContent = "Best of 5";
    pauseButton.textContent = "Pause";
    return;
  }

  if (state.phase === "paused") {
    gameStateLabel.textContent = "Paused";
    controlsHint.textContent = "Press P to resume";
    pauseButton.textContent = "Resume";
    return;
  }

  if (state.phase === "match_over") {
    gameStateLabel.textContent = "Match over";
    controlsHint.textContent = "Restart to play again";
    pauseButton.textContent = "Pause";
    return;
  }

  if (!state.running && state.phase === "playing") {
    gameStateLabel.textContent = "Round finished";
    controlsHint.textContent = "Press R for next round";
    pauseButton.textContent = "Pause";
    return;
  }

  gameStateLabel.textContent = "Round active";
  controlsHint.textContent = "P pauses";
  pauseButton.textContent = "Pause";
}

function openMatchOverlay(title, description) {
  matchOverlayKicker.textContent = "Match Over";
  matchOverlayTitle.textContent = title;
  matchOverlayText.textContent = description;
  state.phase = "match_over";
  state.matchOver = true;
  state.running = false;
  state.paused = false;
  setUiState();
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playSound(type) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.connect(gain);
  gain.connect(context.destination);

  const presets = {
    punch: { frequency: 240, peak: 0.08, duration: 0.08, wave: "square", sweep: 110 },
    kick: { frequency: 150, peak: 0.09, duration: 0.14, wave: "sawtooth", sweep: 70 },
    block: { frequency: 460, peak: 0.06, duration: 0.1, wave: "triangle", sweep: 520 },
    hit: { frequency: 120, peak: 0.08, duration: 0.12, wave: "square", sweep: 70 },
    dodge: { frequency: 620, peak: 0.05, duration: 0.12, wave: "triangle", sweep: 420 },
    jump: { frequency: 340, peak: 0.05, duration: 0.16, wave: "sine", sweep: 520 },
    win: { frequency: 520, peak: 0.08, duration: 0.4, wave: "triangle", sweep: 760 },
    restart: { frequency: 300, peak: 0.05, duration: 0.12, wave: "sine", sweep: 420 },
  };

  const preset = presets[type];

  if (!preset) {
    return;
  }

  oscillator.type = preset.wave;
  oscillator.frequency.setValueAtTime(preset.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(preset.sweep, now + preset.duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(preset.peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);

  oscillator.start(now);
  oscillator.stop(now + preset.duration);
}

function resetFighter(fighter, defaults) {
  fighter.x = defaults.x;
  fighter.health = defaults.health;
  fighter.y = arena.floorY - fighter.height;
  fighter.animation = "idle";
  fighter.frameIndex = 0;
  fighter.frameTimer = 0;
  fighter.isAttacking = false;
  fighter.attackTimer = 0;
  fighter.attackDuration = 0;
  fighter.attackName = "";
  fighter.attackDamage = 0;
  fighter.attackRange = 0;
  fighter.attackConnected = false;
  fighter.isBlocking = false;
  fighter.blockTimer = 0;
  fighter.dodgeTimer = 0;
  fighter.hitFlashTimer = 0;
  fighter.velocityY = 0;
  fighter.isJumping = false;
  fighter.pet.x = fighter.x + fighter.width / 2 - fighter.facing * 96;
  fighter.pet.y = fighter.y - 70;
  fighter.pet.bobTimer = Math.random() * Math.PI * 2;
}

function restartRound() {
  resetFighter(player, fighterDefaults.player);
  resetFighter(cpu, fighterDefaults.cpu);
  controls.left = false;
  controls.right = false;
  state.running = true;
  state.paused = false;
  state.phase = "playing";
  state.winner = "";
  state.cpuDecisionTimer = 0;
  state.cpuAttackCooldown = 0;
  state.lastTime = 0;
  setStatus("Round " + state.roundNumber + " started. Step in and throw the first hit.");
  playSound("restart");
  setUiState();
}

function restartMatch() {
  state.roundNumber = 1;
  state.playerRoundsWon = 0;
  state.cpuRoundsWon = 0;
  state.matchOver = false;
  matchOverlay.classList.remove("visible");
  restartRound();
  setStatus("Match restarted. Round 1 is live.");
}

function startMatch() {
  state.roundNumber = 1;
  state.playerRoundsWon = 0;
  state.cpuRoundsWon = 0;
  state.matchOver = false;
  restartRound();
}

function togglePause() {
  if (state.phase === "pre_match" || state.phase === "match_over" || !state.running) {
    return;
  }

  state.paused = !state.paused;
  state.phase = state.paused ? "paused" : "playing";
  setStatus(state.paused ? "Game paused. Press P or Pause to resume." : "Back in the fight.");
  setUiState();
}

function closeOverlay() {
  if (state.phase !== "match_over") {
    return;
  }

  matchOverlay.classList.remove("visible");
}

function getCurrentFrame(images, fighter) {
  const animationFrames = images[fighter.animation] || images.idle;
  return animationFrames[fighter.frameIndex % animationFrames.length];
}

function updateAnimation(fighter, dt) {
  const animationFrames = frames[fighter.animation];
  fighter.frameTimer += dt;

  if (fighter.frameTimer >= fighter.frameInterval) {
    fighter.frameTimer = 0;
    fighter.frameIndex = (fighter.frameIndex + 1) % animationFrames.length;
  }
}

function beginAttack(fighter, type) {
  if (!state.running || state.paused || fighter.isAttacking || fighter.dodgeTimer > 0 || fighter.blockTimer > 0 || fighter.isJumping) {
    return;
  }

  if (type === "punch") {
    fighter.animation = "punch";
    fighter.attackName = "Punch";
    fighter.attackDamage = 12;
    fighter.attackRange = 110;
    fighter.attackDuration = 0.48;
  } else {
    fighter.animation = "kick";
    fighter.attackName = "Kick";
    fighter.attackDamage = 18;
    fighter.attackRange = 130;
    fighter.attackDuration = 0.62;
  }

  fighter.isAttacking = true;
  fighter.attackConnected = false;
  fighter.attackTimer = fighter.attackDuration;
  fighter.frameIndex = 0;
  fighter.frameTimer = 0;
  playSound(type);
}

function beginBlock(fighter, duration) {
  if (!state.running || state.paused || fighter.isAttacking || fighter.dodgeTimer > 0 || fighter.isJumping) {
    return;
  }

  fighter.isBlocking = true;
  fighter.blockTimer = duration;
  fighter.animation = "Block";
  fighter.frameIndex = 0;
  fighter.frameTimer = 0;
  playSound("block");
}

function beginDodge(fighter, direction) {
  if (!state.running || state.paused || fighter.isAttacking || fighter.blockTimer > 0 || fighter.dodgeTimer > 0 || fighter.isJumping) {
    return;
  }

  fighter.dodgeTimer = 0.24;
  fighter.animation = direction > 0 ? "forward" : "backward";
  fighter.frameIndex = 0;
  fighter.frameTimer = 0;
  fighter.x += 85 * direction;
  clampFighter(fighter);
  playSound("dodge");
}

function beginJump(fighter) {
  if (!state.running || state.paused || fighter.isAttacking || fighter.blockTimer > 0 || fighter.dodgeTimer > 0 || fighter.isJumping) {
    return;
  }

  fighter.velocityY = physics.jumpVelocity;
  fighter.isJumping = true;
  fighter.animation = "forward";
  fighter.frameIndex = 0;
  fighter.frameTimer = 0;
  playSound("jump");
}

function clampFighter(fighter) {
  fighter.x = Math.max(30, Math.min(arena.width - fighter.width - 30, fighter.x));
}

function getDistance(attacker, defender) {
  const attackerFront = attacker.facing === 1 ? attacker.x + attacker.width : attacker.x;
  const defenderFront = defender.facing === 1 ? defender.x : defender.x + defender.width;
  return Math.abs(defenderFront - attackerFront);
}

function dealDamage(attacker, defender) {
  if (attacker.attackConnected || !state.running || state.paused) {
    return;
  }

  if (getDistance(attacker, defender) > attacker.attackRange) {
    return;
  }

  let damage = attacker.attackDamage;

  if (defender.isBlocking) {
    damage = Math.ceil(damage * 0.35);
    setStatus(defender.name + " blocked most of the " + attacker.attackName.toLowerCase() + ".");
    playSound("block");
  } else {
    setStatus(attacker.name + " landed a " + attacker.attackName.toLowerCase() + ".");
    playSound("hit");
  }

  defender.health = Math.max(0, defender.health - damage);
  defender.hitFlashTimer = 0.18;
  attacker.attackConnected = true;

  if (defender.health === 0) {
    state.running = false;
    state.winner = attacker.name;
    if (attacker === player) {
      state.playerRoundsWon += 1;
    } else {
      state.cpuRoundsWon += 1;
    }

    if (state.playerRoundsWon >= state.roundsToWin || state.cpuRoundsWon >= state.roundsToWin) {
      openMatchOverlay(
        attacker.name + " Wins The Match",
        "Final score: " + state.playerRoundsWon + " - " + state.cpuRoundsWon + ". Restart the match to fight again."
      );
      setStatus(attacker.name + " wins the match.");
    } else {
      state.roundNumber += 1;
      state.phase = "playing";
      setStatus(attacker.name + " wins the round. Press R to start round " + state.roundNumber + ".");
      setUiState();
    }
    playSound("win");
  }
}

function updateAttack(fighter, defender, dt) {
  if (!fighter.isAttacking) {
    return;
  }

  fighter.attackTimer -= dt;

  if (fighter.attackTimer <= fighter.attackDuration * 0.55) {
    dealDamage(fighter, defender);
  }

  if (fighter.attackTimer <= 0) {
    fighter.isAttacking = false;
    fighter.attackName = "";
    fighter.attackDamage = 0;
    fighter.attackRange = 0;
    fighter.animation = "idle";
    fighter.frameIndex = 0;
  }
}

function updateDefense(fighter, dt) {
  if (fighter.blockTimer > 0) {
    fighter.blockTimer -= dt;

    if (fighter.blockTimer <= 0) {
      fighter.blockTimer = 0;
      fighter.isBlocking = false;
      fighter.animation = "idle";
      fighter.frameIndex = 0;
    }
  }

  if (fighter.dodgeTimer > 0) {
    fighter.dodgeTimer -= dt;

    if (fighter.dodgeTimer <= 0) {
      fighter.dodgeTimer = 0;
      fighter.animation = "idle";
      fighter.frameIndex = 0;
    }
  }

  if (fighter.hitFlashTimer > 0) {
    fighter.hitFlashTimer = Math.max(0, fighter.hitFlashTimer - dt);
  }
}

function updatePlayer(dt) {
  if (!state.running || state.paused || player.isAttacking || player.blockTimer > 0 || player.dodgeTimer > 0) {
    return;
  }

  let moved = false;

  if (controls.left) {
    player.x -= player.speed * dt;
    if (!player.isJumping) {
      player.animation = "backward";
    }
    moved = true;
  }

  if (controls.right) {
    player.x += player.speed * dt;
    if (!player.isJumping) {
      player.animation = "forward";
    }
    moved = true;
  }

  if (!moved && !player.isJumping) {
    player.animation = "idle";
  }

  clampFighter(player);
}

function updateCpu(dt) {
  if (!state.running || state.paused) {
    return;
  }

  state.cpuDecisionTimer -= dt;
  state.cpuAttackCooldown = Math.max(0, state.cpuAttackCooldown - dt);

  if (cpu.isAttacking || cpu.blockTimer > 0 || cpu.dodgeTimer > 0) {
    return;
  }

  const distance = getDistance(cpu, player);

  if (distance > 105) {
    cpu.x -= cpu.speed * dt;
    if (!cpu.isJumping) {
      cpu.animation = "forward";
    }
    clampFighter(cpu);
    return;
  }

  if (state.cpuDecisionTimer > 0) {
    cpu.animation = "idle";
    return;
  }

  state.cpuDecisionTimer = 0.7 + Math.random() * 0.5;

  if (player.isAttacking && Math.random() < 0.45) {
    beginBlock(cpu, 0.55);
    return;
  }

  if (!cpu.isJumping && Math.random() < 0.12) {
    beginJump(cpu);
    return;
  }

  if (state.cpuAttackCooldown <= 0) {
    state.cpuAttackCooldown = 0.9;

    if (Math.random() < 0.5) {
      beginAttack(cpu, "punch");
    } else {
      beginAttack(cpu, "kick");
    }
    return;
  }

  cpu.animation = "idle";
}

function updateJump(fighter, dt) {
  if (!fighter.isJumping) {
    return;
  }

  fighter.velocityY += physics.gravity * dt;
  fighter.y += fighter.velocityY * dt;

  const groundY = arena.floorY - fighter.height;

  if (fighter.y >= groundY) {
    fighter.y = groundY;
    fighter.velocityY = 0;
    fighter.isJumping = false;
    fighter.animation = "idle";
    fighter.frameIndex = 0;
  }
}

function updatePet(fighter, dt) {
  const pet = fighter.pet;
  const baseX = fighter.x + fighter.width / 2 - fighter.facing * 104;
  const baseY = fighter.y - 62;
  const bobOffset = Math.sin(pet.bobTimer) * 10;

  pet.bobTimer += dt * 3.2;
  pet.x += (baseX - pet.x) * Math.min(1, dt * 7);
  pet.y += (baseY + bobOffset - pet.y) * Math.min(1, dt * 7);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, arena.height);
  sky.addColorStop(0, "rgba(8, 13, 24, 0.08)");
  sky.addColorStop(1, "rgba(6, 10, 16, 0.52)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, arena.width, arena.height);

  const shine = ctx.createRadialGradient(arena.width * 0.5, 120, 10, arena.width * 0.5, 140, 260);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  shine.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, arena.width, arena.height);

  ctx.fillStyle = "rgba(10, 15, 22, 0.3)";
  ctx.fillRect(0, arena.floorY, arena.width, arena.height - arena.floorY);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, arena.floorY + 2);
  ctx.lineTo(arena.width, arena.floorY + 2);
  ctx.stroke();
}

function drawHealthBar(x, y, width, height, health, label, color, accentText) {
  ctx.fillStyle = "rgba(14, 20, 31, 0.72)";
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * (health / 100), height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#f8fbff";
  ctx.font = "bold 16px Arial";
  ctx.fillText(label + ": " + health, x, y - 12);

  ctx.fillStyle = accentText;
  ctx.font = "bold 12px Arial";
  ctx.fillText("Pet: " + (label === "Player" ? player.pet.name : cpu.pet.name), x, y + height + 18);
}

function drawPet(fighter) {
  const pet = fighter.pet;
  const blink = Math.sin(pet.bobTimer * 1.7) > 0.92;

  ctx.save();
  ctx.translate(pet.x, pet.y);

  ctx.shadowColor = pet.glow;
  ctx.shadowBlur = 18;

  ctx.fillStyle = pet.glow;
  ctx.beginPath();
  ctx.ellipse(0, 18, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = pet.accent;

  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.quadraticCurveTo(-28, 8, -14, 12);
  ctx.quadraticCurveTo(-7, 6, -8, -1);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.quadraticCurveTo(28, 8, 14, 12);
  ctx.quadraticCurveTo(7, 6, 8, -1);
  ctx.fill();

  ctx.fillStyle = pet.type === "eagle" ? "#fff5d6" : "#edfaff";
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pet.type === "eagle" ? "#f77f00" : "#ffb703";
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-5, 10);
  ctx.lineTo(5, 10);
  ctx.fill();

  ctx.fillStyle = blink ? "#07111d" : "#0f1d33";
  ctx.beginPath();
  ctx.arc(-5, -1, 2, 0, Math.PI * 2);
  ctx.arc(5, -1, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(pet.name, 0, -30);

  ctx.restore();
}

function drawFighter(images, fighter) {
  const frame = getCurrentFrame(images, fighter);
  const drawX = fighter.x + fighter.width / 2;
  const drawY = fighter.y;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.scale(fighter.spriteScale, 1);

  if (fighter.hitFlashTimer > 0) {
    ctx.shadowColor = "rgba(255, 90, 90, 0.95)";
    ctx.shadowBlur = 26;
  }

  ctx.drawImage(frame, -fighter.width / 2, 0, fighter.width, fighter.height);

  if (fighter.isBlocking) {
    ctx.fillStyle = "rgba(130, 220, 255, 0.2)";
    ctx.fillRect(-fighter.width / 2, 0, fighter.width, fighter.height);
  }

  ctx.restore();

  ctx.fillStyle = fighter.tint;
  ctx.fillRect(fighter.x, fighter.y, fighter.width, fighter.height);

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(
    fighter.x + fighter.width / 2,
    arena.floorY + 10,
    fighter.width * (fighter.isJumping ? 0.22 : 0.3),
    fighter.isJumping ? 10 : 14,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawHud() {
  ctx.fillStyle = "rgba(8, 13, 23, 0.62)";
  ctx.fillRect(18, 18, arena.width - 36, 74);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.strokeRect(18, 18, arena.width - 36, 74);

  drawHealthBar(36, 42, 280, 18, player.health, "Player", "#ffb703", "#ffe7a3");
  drawHealthBar(arena.width - 316, 42, 280, 18, cpu.health, "CPU", "#4cc9f0", "#d2f5ff");

  ctx.fillStyle = "rgba(13, 20, 33, 0.9)";
  ctx.fillRect(arena.width / 2 - 122, 30, 244, 42);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.strokeRect(arena.width / 2 - 122, 30, 244, 42);

  ctx.fillStyle = "#f8fbff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";

  let hudTitle = "Round " + state.roundNumber;
  if (state.paused) {
    hudTitle = "Paused";
  } else if (!state.running && !state.matchOver && state.winner) {
    hudTitle = state.winner + " Won Round";
  } else if (state.matchOver) {
    hudTitle = state.winner + " Wins Match";
  }

  ctx.fillText(hudTitle, arena.width / 2, 57);

  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#dce7f5";
  ctx.fillText("First to " + state.roundsToWin, arena.width / 2, 80);

  ctx.textAlign = "start";
  ctx.fillStyle = "#f8fbff";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Rounds: " + state.playerRoundsWon, 36, 86);
  ctx.textAlign = "right";
  ctx.fillText("Rounds: " + state.cpuRoundsWon, arena.width - 36, 86);
  ctx.textAlign = "start";
}

function drawPausedOverlay() {
  if (!state.paused) {
    return;
  }

  ctx.fillStyle = "rgba(5, 10, 17, 0.45)";
  ctx.fillRect(0, 0, arena.width, arena.height);

  ctx.fillStyle = "rgba(7, 13, 23, 0.88)";
  ctx.fillRect(arena.width / 2 - 170, arena.height / 2 - 54, 340, 108);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.strokeRect(arena.width / 2 - 170, arena.height / 2 - 54, 340, 108);

  ctx.fillStyle = "#f8fbff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Game Paused", arena.width / 2, arena.height / 2 - 6);
  ctx.font = "15px Arial";
  ctx.fillStyle = "#d6e2f2";
  ctx.fillText("Press P or Resume to jump back into the round.", arena.width / 2, arena.height / 2 + 24);
  ctx.textAlign = "start";
}

function render(images) {
  ctx.clearRect(0, 0, arena.width, arena.height);
  drawBackground();
  drawHud();
  drawFighter(images, cpu);
  drawFighter(images, player);
  drawPet(cpu);
  drawPet(player);
  drawPausedOverlay();
}

function gameLoop(images, timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;

  if (state.running && !state.paused) {
    updatePlayer(dt);
    updateCpu(dt);
    updateJump(player, dt);
    updateJump(cpu, dt);
    updatePet(player, dt);
    updatePet(cpu, dt);
    updateAttack(player, cpu, dt);
    updateAttack(cpu, player, dt);
    updateDefense(player, dt);
    updateDefense(cpu, dt);
    updateAnimation(player, dt);
    updateAnimation(cpu, dt);
  } else {
    updatePet(player, dt);
    updatePet(cpu, dt);
  }

  render(images);
  requestAnimationFrame((nextTimestamp) => gameLoop(images, nextTimestamp));
}

function handleAction(action) {
  switch (action) {
    case "punch":
      beginAttack(player, "punch");
      break;
    case "kick":
      beginAttack(player, "kick");
      break;
    case "block":
      beginBlock(player, 0.7);
      break;
    case "dodge":
      beginDodge(player, controls.left ? -1 : 1);
      break;
    case "jump":
      beginJump(player);
      break;
  }
}

function bindControls() {
  document.getElementById("startGame").onclick = startMatch;
  document.getElementById("restartMatchButton").onclick = restartMatch;
  document.getElementById("closeOverlayButton").onclick = closeOverlay;
  document.getElementById("restartMatchInline").onclick = restartMatch;
  document.getElementById("pauseGame").onclick = togglePause;
  document.getElementById("punch").onclick = () => handleAction("punch");
  document.getElementById("kick").onclick = () => handleAction("kick");
  document.getElementById("jump").onclick = () => handleAction("jump");
  document.getElementById("Block").onclick = () => handleAction("block");
  document.getElementById("Dodge").onclick = () => handleAction("dodge");
  document.getElementById("restartRound").onclick = () => {
    if (state.phase === "pre_match") {
      startMatch();
      return;
    }

    if (state.phase === "match_over") {
      restartMatch();
      return;
    }

    restartRound();
  };
  document.getElementById("backward").onclick = () => {
    if (!state.running || state.paused) {
      return;
    }
    player.x -= 36;
    player.animation = "backward";
    clampFighter(player);
  };
  document.getElementById("forward").onclick = () => {
    if (!state.running || state.paused) {
      return;
    }
    player.x += 36;
    player.animation = "forward";
    clampFighter(player);
  };

  document.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        controls.left = true;
        break;
      case "ArrowRight":
        controls.right = true;
        break;
      case "a":
      case "A":
        handleAction("punch");
        break;
      case "ArrowUp":
      case "w":
      case "W":
        handleAction("jump");
        break;
      case "s":
      case "S":
        handleAction("kick");
        break;
      case "d":
      case "D":
        handleAction("block");
        break;
      case " ":
        event.preventDefault();
        handleAction("dodge");
        break;
      case "r":
      case "R":
        if (state.phase === "match_over") {
          restartMatch();
        } else if (state.phase === "pre_match") {
          startMatch();
        } else {
          restartRound();
        }
        break;
      case "p":
      case "P":
        togglePause();
        break;
    }
  });

  document.addEventListener("keyup", (event) => {
    switch (event.key) {
      case "ArrowLeft":
        controls.left = false;
        break;
      case "ArrowRight":
        controls.right = false;
        break;
      case "d":
      case "D":
        player.blockTimer = 0;
        player.isBlocking = false;
        if (!player.isAttacking && player.dodgeTimer <= 0) {
          player.animation = "idle";
        }
        break;
    }
  });
}

loadImages((images) => {
  Object.assign(imageCache, images);
  bindControls();
  setStatus("Press Start Match to enter the arena.");
  setUiState();
  requestAnimationFrame((timestamp) => gameLoop(imageCache, timestamp));
});
