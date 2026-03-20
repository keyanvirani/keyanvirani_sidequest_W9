/*
  Week 9 — Example 3: Adding Sound & Music

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Mar. 19, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
      = empty (no sprite)
*/

let player;
let playerImg, bgImg;
let jumpSfx, musicSfx;
let musicStarted = false;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
};

let ground, groundDeep;
let groundImg, groundDeepImg;

let attacking = false; // track if the player is attacking
let attackFrameCounter = 0; // tracking attack animation

// --- TILE MAP ---
// an array that uses the tile key to create the level
let level = [
  "              ",
  "              ",
  "              ",
  "              ",
  "              ",
  "       ggg    ",
  "gggggggggggggg", // surface ground
  "dddddddddddddd", // deep ground
];

// --- LEVEL CONSTANTS ---
// camera view size
const VIEWW = 320,
  VIEWH = 180;

// tile width & height
const TILE_W = 24,
  TILE_H = 24;

// size of individual animation frames
const FRAME_W = 32,
  FRAME_H = 32;

// Y-coordinate of player start (4 tiles above the bottom)
const MAP_START_Y = VIEWH - TILE_H * 4;

// gravity
const GRAVITY = 10;
const MOON_GRAVITY = 0.3;

// --- DEBUG ---
let debugOpen = false;
let moonGravityOn = false;
let debugBtn, debugPanel, gravityLabel, moonToggleBtn, hitboxToggleBtn;
let hitboxesOn = false;

function preload() {
  // --- IMAGES ---
  playerImg = loadImage("assets/foxSpriteSheet.png");
  bgImg = loadImage("assets/combinedBackground.png");
  groundImg = loadImage("assets/groundTile.png");
  groundDeepImg = loadImage("assets/groundTileDeep.png");

  // --- SOUND ---
  if (typeof loadSound === "function") {
    jumpSfx = loadSound("assets/sfx/jump.wav");
    musicSfx = loadSound("assets/sfx/music.wav");
  }
}

function setup() {
  // pixelated rendering with autoscaling
  new Canvas(VIEWW, VIEWH, "pixelated");

  // needed to correct an visual artifacts from attempted antialiasing
  allSprites.pixelPerfect = true;

  world.gravity.y = GRAVITY;

  // Try to start background music immediately.
  if (musicSfx) musicSfx.setLoop(true);
  startMusicIfNeeded();

  // --- TILE GROUPS ---
  ground = new Group();
  ground.physics = "static";
  ground.img = groundImg;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundDeepImg;
  groundDeep.tile = "d";

  // a Tiles object creates a level based on the level map array (defined at the beginning)
  new Tiles(level, 0, 0, TILE_W, TILE_H);

  // --- PLAYER ---
  player = new Sprite(FRAME_W, MAP_START_Y, FRAME_W, FRAME_H); // create the player
  player.spriteSheet = playerImg; // use the sprite sheet
  player.rotationLock = true; // turn off rotations (player shouldn't rotate)

  // player animation parameters
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -4; // offset the collision box up
  player.addAnis(playerAnis); // add the player animations defined earlier
  player.ani = "idle"; // default to the idle animation
  player.w = 18; // set the width of the collsion box
  player.h = 20; // set the height of the collsion box
  player.friction = 0; // set the friciton to 0 so we don't stick to walls
  player.bounciness = 0; // set the bounciness to 0 so the player doesn't bounce

  // --- GROUND SENSOR --- for use when detecting if the player is standing on the ground
  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;
  sensor.removeColliders();
  sensor.visible = false;
  let sensorJoint = new GlueJoint(player, sensor);
  sensorJoint.visible = false;

  // --- DEBUG UI (HTML overlay, crisp at any canvas scale) ---
  debugBtn = createButton("DEBUG");
  debugBtn.style("position", "fixed");
  debugBtn.style("top", "8px");
  debugBtn.style("right", "8px");
  debugBtn.style("z-index", "9999");
  debugBtn.style("background", "rgba(15,15,25,0.85)");
  debugBtn.style("color", "#aaa");
  debugBtn.style("border", "1px solid #444");
  debugBtn.style("border-radius", "4px");
  debugBtn.style("font-family", "monospace");
  debugBtn.style("font-size", "12px");
  debugBtn.style("padding", "4px 10px");
  debugBtn.style("cursor", "pointer");
  debugBtn.mousePressed(() => {
    debugOpen = !debugOpen;
    debugPanel.style("display", debugOpen ? "flex" : "none");
    debugBtn.style("color", debugOpen ? "#78ff9e" : "#aaa");
    debugBtn.style("border", debugOpen ? "1px solid #50c878" : "1px solid #444");
  });

  debugPanel = createDiv("");
  debugPanel.style("position", "fixed");
  debugPanel.style("top", "38px");
  debugPanel.style("right", "8px");
  debugPanel.style("z-index", "9999");
  debugPanel.style("display", "none");
  debugPanel.style("flex-direction", "column");
  debugPanel.style("gap", "8px");
  debugPanel.style("background", "rgba(10,10,20,0.92)");
  debugPanel.style("border", "1px solid rgba(80,200,120,0.6)");
  debugPanel.style("border-radius", "5px");
  debugPanel.style("padding", "10px 14px");
  debugPanel.style("font-family", "monospace");
  debugPanel.style("min-width", "170px");

  let panelTitle = createDiv("[ DEBUG ]");
  panelTitle.parent(debugPanel);
  panelTitle.style("color", "#78ff9e");
  panelTitle.style("font-size", "13px");
  panelTitle.style("font-weight", "bold");

  gravityLabel = createDiv("gravity: EARTH (10.0)");
  gravityLabel.parent(debugPanel);
  gravityLabel.style("color", "#9090b8");
  gravityLabel.style("font-size", "11px");

  moonToggleBtn = createButton("MOON GRAVITY  [OFF]");
  moonToggleBtn.parent(debugPanel);
  moonToggleBtn.style("background", "rgba(30,110,70,0.85)");
  moonToggleBtn.style("color", "#fff");
  moonToggleBtn.style("border", "1px solid #50dc8c");
  moonToggleBtn.style("border-radius", "3px");
  moonToggleBtn.style("font-family", "monospace");
  moonToggleBtn.style("font-size", "12px");
  moonToggleBtn.style("padding", "5px 10px");
  moonToggleBtn.style("cursor", "pointer");
  moonToggleBtn.mousePressed(() => {
    moonGravityOn = !moonGravityOn;
    world.gravity.y = moonGravityOn ? MOON_GRAVITY : GRAVITY;
    if (moonGravityOn) {
      moonToggleBtn.html("MOON GRAVITY  [ON]");
      moonToggleBtn.style("background", "rgba(140,50,50,0.85)");
      moonToggleBtn.style("border", "1px solid #ff7878");
      gravityLabel.html("gravity: MOON (10)");
    } else {
      moonToggleBtn.html("MOON GRAVITY  [OFF]");
      moonToggleBtn.style("background", "rgba(30,110,70,0.85)");
      moonToggleBtn.style("border", "1px solid #50dc8c");
      gravityLabel.html("gravity: EARTH (10.0)");
    }
  });

  hitboxToggleBtn = createButton("SHOW HITBOXES  [OFF]");
  hitboxToggleBtn.parent(debugPanel);
  hitboxToggleBtn.style("background", "rgba(30,110,70,0.85)");
  hitboxToggleBtn.style("color", "#fff");
  hitboxToggleBtn.style("border", "1px solid #50dc8c");
  hitboxToggleBtn.style("border-radius", "3px");
  hitboxToggleBtn.style("font-family", "monospace");
  hitboxToggleBtn.style("font-size", "12px");
  hitboxToggleBtn.style("padding", "5px 10px");
  hitboxToggleBtn.style("cursor", "pointer");
  hitboxToggleBtn.mousePressed(() => {
    hitboxesOn = !hitboxesOn;
    allSprites.debug = hitboxesOn;
    if (hitboxesOn) {
      hitboxToggleBtn.html("SHOW HITBOXES  [ON]");
      hitboxToggleBtn.style("background", "rgba(140,50,50,0.85)");
      hitboxToggleBtn.style("border", "1px solid #ff7878");
    } else {
      hitboxToggleBtn.html("SHOW HITBOXES  [OFF]");
      hitboxToggleBtn.style("background", "rgba(30,110,70,0.85)");
      hitboxToggleBtn.style("border", "1px solid #50dc8c");
    }
  });
}

function startMusicIfNeeded() {
  if (musicStarted || !musicSfx) return;

  const startLoop = () => {
    if (!musicSfx.isPlaying()) musicSfx.play();
    musicStarted = musicSfx.isPlaying();
  };

  // Some browsers require a user gesture before audio can start.
  const maybePromise = userStartAudio();
  if (maybePromise && typeof maybePromise.then === "function") {
    maybePromise.then(startLoop).catch(() => {});
  } else {
    startLoop();
  }
}

function keyPressed() {
  startMusicIfNeeded();
}

function mousePressed() {
  startMusicIfNeeded();
}

function touchStarted() {
  startMusicIfNeeded();
  return false;
}

function draw() {
  // --- BACKGROUND ---
  camera.off();
  imageMode(CORNER);
  image(bgImg, 0, 0, bgImg.width, bgImg.height);
  camera.on();

  // --- PLAYER CONTROLS ---
  // first check to see if the player is on the ground
  let grounded = sensor.overlapping(ground);

  // -- ATTACK INPUT --
  if (grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play(); // plays once to end
  }

  // -- JUMP --
  if (grounded && kb.presses("up")) {
    player.vel.y = -4;
    if (jumpSfx) jumpSfx.play();
  }

  // --- STATE MACHINE ---
  if (attacking) {
    attackFrameCounter++;
    // Attack lasts ~6 frames * frameDelay 2 = 12 cycles (adjust if needed)
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  // --- MOVEMENT ---
  if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -1.5;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = 1.5;
      player.mirror.x = false;
    }
  }

  // --- KEEP IN VIEW ---
  player.pos.x = constrain(player.pos.x, FRAME_W / 2, VIEWW - FRAME_W / 2);

}
