const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roomLabel = document.querySelector("#roomLabel");
const torchLabel = document.querySelector("#torchLabel");
const audioToggle = document.querySelector("#audioToggle");
const promptBox = document.querySelector("#prompt");
const messageBox = document.querySelector("#messageBox");
const messageTitle = document.querySelector("#messageTitle");
const messageText = document.querySelector("#messageText");
const messageClose = document.querySelector("#messageClose");
const startPanel = document.querySelector("#startPanel");
const startButton = document.querySelector("#startButton");
const keypadModal = document.querySelector("#keypadModal");
const keypadDisplay = document.querySelector("#keypadDisplay");
const keypadFeedback = document.querySelector("#keypadFeedback");
const keypadSubmit = document.querySelector("#keypadSubmit");
const keypadLeave = document.querySelector("#keypadLeave");
const keypadClose = document.querySelector("#keypadClose");
const endingModal = document.querySelector("#endingModal");
const endingKicker = document.querySelector("#endingKicker");
const endingTitle = document.querySelector("#endingTitle");
const endingText = document.querySelector("#endingText");
const endingMark = document.querySelector("#endingMark");
const endingLinks = document.querySelector("#endingLinks");
const touchInteract = document.querySelector("#touchInteract");
const touchTorch = document.querySelector("#touchTorch");

const WORLD = { width: 1120, height: 720 };
const PLAYER_RADIUS = 14;
const WALK_SPEED = 128;
const TOUCH_BREAKPOINT = 820;

const rooms = {
  nemo: { name: "Camera di Nemo", x: 55, y: 420, w: 285, h: 240 },
  nemoDoor: { name: "Soglia", x: 310, y: 520, w: 68, h: 72 },
  corridor: { name: "Corridoio principale", x: 330, y: 500, w: 490, h: 120 },
  conferenceDoor: { name: "Soglia della sala", x: 785, y: 500, w: 70, h: 110 },
  conference: { name: "Sala conferenze", x: 810, y: 300, w: 270, h: 320 }
};

const player = {
  x: 180,
  y: 548,
  angle: 0,
  lastStep: 0,
  walkTime: 0,
  isWalking: false
};

const state = {
  started: false,
  hasTorch: false,
  torchOn: false,
  leftRoom: false,
  heardMovement: false,
  conferenceDoorOpen: false,
  enteredConference: false,
  spokeGianna: false,
  keypadValue: "",
  keypadAttempts: 0,
  keypadLocked: false,
  messageOpen: false,
  modalOpen: false,
  endingOpen: false,
  audioEnabled: false,
  lastRoom: "Camera di Nemo"
};

const keys = new Set();
const touchDirs = new Set();
let nearestInteractive = null;
let lastTime = performance.now();
let audioContext = null;
let audioMaster = null;
let rainSource = null;

const chairRects = buildChairs();

const staticSolids = [
  { id: "bed", x: 82, y: 458, w: 105, h: 64 },
  { id: "suitcase", x: 244, y: 588, w: 48, h: 34 },
  { id: "parideDoor", x: 454, y: 494, w: 104, h: 12 },
  { id: "conferenceTable", x: 846, y: 356, w: 120, h: 28 }
];

const interactives = [
  {
    id: "torch",
    title: "Torcia",
    prompt: "Prendi la torcia",
    x: 137,
    y: 548,
    radius: 42,
    visible: () => !state.hasTorch,
    action: () => {
      state.hasTorch = true;
      state.torchOn = true;
      showMessage("Torcia", "La torcia era più pesante di quanto ricordasse.");
      playTone("switch");
    }
  },
  {
    id: "suitcase",
    title: "Valigia",
    prompt: "Esamina la valigia",
    x: 268,
    y: 604,
    radius: 48,
    visible: () => true,
    action: () => showMessage("Valigia", "Era già pronta. Questo non la rendeva rassicurante.")
  },
  {
    id: "window",
    title: "Finestra",
    prompt: "Guarda fuori",
    x: 154,
    y: 650,
    radius: 52,
    visible: () => true,
    action: () => showMessage("Finestra", "Fuori, la pioggia cancellava il cortile.")
  },
  {
    id: "roomDoor",
    title: "Porta",
    prompt: "Apri la porta",
    x: 332,
    y: 554,
    radius: 50,
    visible: () => true,
    action: () => {
      if (!state.hasTorch) {
        showMessage("Porta", "Il corridoio era troppo buio. Prima serviva una luce.");
        return;
      }
      state.leftRoom = true;
      player.x = Math.max(player.x, 350);
      player.y = 554;
      player.angle = 0;
      showMessage("Corridoio", "La Casa sembrò allungarsi appena oltre la soglia.");
      playTone("door");
    }
  },
  {
    id: "parideDoor",
    title: "Camera di Paride",
    prompt: "Ascolta",
    x: 506,
    y: 498,
    radius: 56,
    visible: () => state.hasTorch,
    action: () => showMessage("Camera di Paride", "La porta era chiusa. Dietro, un silenzio troppo composto.")
  },
  {
    id: "conferenceDoor",
    title: "Doppia porta",
    prompt: "Apri la porta",
    x: 807,
    y: 555,
    radius: 58,
    visible: () => state.leftRoom && !state.conferenceDoorOpen,
    action: () => {
      state.conferenceDoorOpen = true;
      player.x = 842;
      player.y = 585;
      player.angle = 0;
      showMessage("Sala conferenze", "La doppia porta cedette senza fare rumore.");
      playTone("door");
    }
  },
  {
    id: "missingChair",
    title: "Sedia mancante",
    prompt: "Osserva la fila",
    x: 926,
    y: 472,
    radius: 46,
    visible: () => state.enteredConference,
    action: () => showMessage("Sedia mancante", "Una fila perfetta. Una sola assenza.")
  },
  {
    id: "gianna",
    title: "Gianna",
    prompt: "Parla con Gianna",
    x: 944,
    y: 346,
    radius: 62,
    visible: () => state.enteredConference,
    action: () => {
      state.spokeGianna = true;
      showMessage("Gianna", "“Il fantasma è tornato, Nemo.”");
      playTone("whisper");
    }
  },
  {
    id: "archive",
    title: "Archivio",
    prompt: "Usa il tastierino illuminato",
    x: 1056,
    y: 512,
    radius: 64,
    visible: () => state.enteredConference,
    action: () => {
      if (!state.spokeGianna) {
        showMessage("Ultima porta", "La porta rimase muta. Qualcosa, nella sala, non era ancora finito.");
        return;
      }
      openKeypad();
    }
  }
];

function buildChairs() {
  const chairs = [];
  const xs = [848, 888, 928, 968];
  const ys = [432, 472, 512, 552];

  ys.forEach((y, row) => {
    xs.forEach((x, col) => {
      if (row === 1 && col === 2) return;
      chairs.push({ id: `chair-${row}-${col}`, x: x - 10, y: y - 10, w: 20, h: 20 });
    });
  });

  return chairs;
}

function getWalkableAreas() {
  const areas = [rooms.nemo];

  if (state.leftRoom) {
    areas.push(rooms.nemoDoor, rooms.corridor);
  }

  if (state.conferenceDoorOpen) {
    areas.push(rooms.conferenceDoor, rooms.conference);
  }

  return areas;
}

function startGame() {
  state.started = true;
  startPanel.hidden = true;
  showMessage("La Casa", "La corrente era staccata. La pioggia no.");
  playTone("door");
}

function update(delta) {
  if (!state.started || state.modalOpen || state.endingOpen) return;

  const move = getMoveVector();
  if (move.x !== 0 || move.y !== 0) {
    player.angle = Math.atan2(move.y, move.x);
    const step = WALK_SPEED * delta;
    const startX = player.x;
    const startY = player.y;
    tryMove(move.x * step, 0);
    tryMove(0, move.y * step);
    player.isWalking = player.x !== startX || player.y !== startY;
    if (player.isWalking) {
      player.walkTime += delta;
      maybePlayFootstep();
    }
  } else {
    player.isWalking = false;
  }

  updateRoom();
  updateTriggers();
  nearestInteractive = findNearestInteractive();
  updatePrompt();
}

function getMoveVector() {
  let x = 0;
  let y = 0;

  if (keys.has("ArrowLeft") || keys.has("a")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) x += 1;
  if (keys.has("ArrowUp") || keys.has("w")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) y += 1;
  if (touchDirs.has("left")) x -= 1;
  if (touchDirs.has("right")) x += 1;
  if (touchDirs.has("up")) y -= 1;
  if (touchDirs.has("down")) y += 1;

  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

function tryMove(dx, dy) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (canOccupy(nextX, nextY)) {
    player.x = nextX;
    player.y = nextY;
  }
}

function canOccupy(x, y) {
  if (!getWalkableAreas().some((area) => circleCenterInRect(x, y, area, PLAYER_RADIUS))) {
    return false;
  }

  return !staticSolids.some((solid) => circleRectCollision(x, y, PLAYER_RADIUS, solid));
}

function circleCenterInRect(x, y, rect, radius) {
  return (
    x >= rect.x + radius &&
    x <= rect.x + rect.w - radius &&
    y >= rect.y + radius &&
    y <= rect.y + rect.h - radius
  );
}

function circleRectCollision(cx, cy, radius, rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  return Math.hypot(cx - closestX, cy - closestY) < radius;
}

function updateRoom() {
  const current = getCurrentRoomName();
  if (current !== state.lastRoom) {
    state.lastRoom = current;
    roomLabel.textContent = current;
  }
}

function getCurrentRoomName() {
  if (pointInRect(player.x, player.y, rooms.conference)) return rooms.conference.name;
  if (pointInRect(player.x, player.y, rooms.corridor)) return rooms.corridor.name;
  return rooms.nemo.name;
}

function updateTriggers() {
  if (state.hasTorch && !state.heardMovement && pointInRect(player.x, player.y, rooms.corridor) && player.x > 565) {
    state.heardMovement = true;
    showMessage("Corridoio", "Qualcosa si mosse in fondo al buio. O forse fu soltanto la luce.");
    playTone("whisper");
  }

  if (!state.enteredConference && pointInRect(player.x, player.y, rooms.conference)) {
    state.enteredConference = true;
    showMessage("Sala conferenze", "File di sedie vuote. Davanti alla finestra, una figura immobile.");
  }
}

function findNearestInteractive() {
  let nearest = null;
  let nearestDistance = Infinity;

  interactives.forEach((item) => {
    if (!item.visible()) return;
    const distance = Math.hypot(player.x - item.x, player.y - item.y);
    if (distance < item.radius && distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  });

  return nearest;
}

function updatePrompt() {
  if (state.messageOpen || state.modalOpen || state.endingOpen || !nearestInteractive) {
    promptBox.hidden = true;
    return;
  }

  const isTouch = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= TOUCH_BREAKPOINT;
  const verb = isTouch ? "Tocca Interagisci" : "Premi E per interagire";
  promptBox.textContent = `${verb}: ${nearestInteractive.prompt}`;
  promptBox.hidden = false;
}

function interact() {
  if (state.modalOpen || state.endingOpen) return;

  if (state.messageOpen) {
    closeMessage();
    return;
  }

  nearestInteractive = findNearestInteractive();
  if (!nearestInteractive) return;
  nearestInteractive.action();
  updateHud();
}

function toggleTorch() {
  if (!state.hasTorch || state.modalOpen || state.endingOpen) return;
  state.torchOn = !state.torchOn;
  showMessage("Torcia", state.torchOn ? "Il cono di luce tornò a respirare." : "Il buio fece un passo avanti.");
  playTone("switch");
  updateHud();
}

function showMessage(title, text) {
  state.messageOpen = true;
  messageTitle.textContent = title;
  messageText.textContent = text;
  messageBox.hidden = false;
  promptBox.hidden = true;
}

function closeMessage() {
  state.messageOpen = false;
  messageBox.hidden = true;
  updatePrompt();
}

function openKeypad() {
  state.modalOpen = true;
  state.keypadValue = "";
  keypadModal.hidden = false;
  document.body.classList.add("keypad-active");
  updateKeypad();
}

function closeKeypad() {
  state.modalOpen = false;
  keypadModal.hidden = true;
  document.body.classList.remove("keypad-active");
  updatePrompt();
}

function updateKeypad() {
  keypadDisplay.textContent = state.keypadValue.padEnd(4, "-");
  keypadFeedback.classList.toggle("warning", state.keypadLocked);

  if (state.keypadLocked) {
    keypadFeedback.innerHTML = "Nemo ritrasse la mano dal tastierino.<br>Certe porte non si aprono per tentativi.<br>Bisogna arrivarci da un’altra storia.";
  } else {
    keypadFeedback.textContent = "";
  }
}

function addKeypadDigit(digit) {
  if (state.keypadLocked || state.keypadValue.length >= 4) return;
  state.keypadValue += digit;
  updateKeypad();
  playTone("tap");
}

function submitKeypad() {
  if (state.keypadLocked) return;

  if (state.keypadValue === "2115") {
    closeKeypad();
    showEnding("secret");
    playTone("unlock");
    return;
  }

  state.keypadValue = "";
  state.keypadAttempts += 1;
  playTone("wrong");

  if (state.keypadAttempts >= 3) {
    state.keypadLocked = true;
    updateKeypad();
    return;
  }

  keypadFeedback.textContent = "La serratura rimase muta.";
  updateKeypadDisplayOnly();
}

function updateKeypadDisplayOnly() {
  keypadDisplay.textContent = state.keypadValue.padEnd(4, "-");
}

function showEnding(type) {
  state.endingOpen = true;
  endingModal.hidden = false;
  touchDirs.clear();
  document.body.classList.remove("keypad-active");
  document.body.classList.add("ending-active");

  if (type === "secret") {
    endingKicker.textContent = "Finale segreto";
    endingTitle.textContent = "L’ultima porta";
    endingText.innerHTML = [
      "La serratura scattò.",
      "Per un istante, Nemo non respirò.",
      "",
      "Oltre la porta non c’era una risposta.",
      "C’era un altro buio.",
      "Più quieto.",
      "Più profondo.",
      "",
      "E, dentro quel buio, alcuni appunti lasciati ad aspettare."
    ].map((line) => line || "<br>").join("<br>");
    endingMark.hidden = false;
    endingMark.innerHTML = "<strong>HAI APERTO L’ULTIMA PORTA</strong>";
    endingLinks.innerHTML = buildEndingLinks([
      { label: "Entra in Appunti dal buio", href: "appunti-dal-buio.html", primary: true },
      { label: "Ricomincia", action: "restart" },
      { label: "Torna al sito", href: "/" }
    ]);
    bindEndingActions();
    return;
  }

  endingKicker.textContent = "Finale";
  endingTitle.textContent = "Un corridoio in più";
  endingText.innerHTML = "La Casa non aveva risposto.<br>Si era limitata ad aprire un corridoio in più.";
  endingMark.hidden = true;
  endingLinks.innerHTML = buildEndingLinks([
    // Link segnaposto facilmente modificabili quando la struttura definitiva del sito sara' disponibile.
    { label: "Leggi l’incipit", href: "/incipit.html", primary: true },
    { label: "Scopri il romanzo", href: "/lontano-dai-cipressi.html" },
    { label: "Torna al sito", href: "/" }
  ]);
  bindEndingActions();
}

function buildEndingLinks(links) {
  return links.map((link) => {
    const className = link.primary ? "primary-action" : "";
    if (link.action) {
      return `<button class="${className}" type="button" data-ending-action="${link.action}">${link.label}</button>`;
    }
    return `<a class="${className}" href="${link.href}">${link.label}</a>`;
  }).join("");
}

function bindEndingActions() {
  endingLinks.querySelectorAll("[data-ending-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.endingAction === "restart") restartGame();
    });
  });
}

function restartGame() {
  state.started = true;
  state.hasTorch = false;
  state.torchOn = false;
  state.leftRoom = false;
  state.heardMovement = false;
  state.conferenceDoorOpen = false;
  state.enteredConference = false;
  state.spokeGianna = false;
  state.keypadValue = "";
  state.keypadAttempts = 0;
  state.keypadLocked = false;
  state.messageOpen = false;
  state.modalOpen = false;
  state.endingOpen = false;
  state.lastRoom = "Camera di Nemo";

  player.x = 180;
  player.y = 548;
  player.angle = 0;
  player.walkTime = 0;
  player.isWalking = false;

  endingModal.hidden = true;
  keypadModal.hidden = true;
  messageBox.hidden = true;
  startPanel.hidden = true;
  document.body.classList.remove("ending-active", "keypad-active");
  roomLabel.textContent = state.lastRoom;
  updateHud();
  updatePrompt();
}

function updateHud() {
  if (!state.hasTorch) {
    torchLabel.textContent = "Torcia assente";
    torchLabel.classList.remove("is-on");
    return;
  }

  torchLabel.textContent = state.torchOn ? "Torcia accesa" : "Torcia spenta";
  torchLabel.classList.toggle("is-on", state.torchOn);
}

function draw() {
  resizeCanvas();

  const view = getCameraView();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(view.scale, view.scale);
  ctx.translate(-view.x, -view.y);

  drawMap();
  drawObjects();
  drawLighting();
  drawForegroundObjects();
  drawTorchBeam();
  drawPlayer();

  ctx.restore();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getCameraView() {
  const rect = canvas.getBoundingClientRect();
  const aspect = Math.max(1, rect.width / Math.max(1, rect.height));
  const viewHeight = window.innerWidth <= TOUCH_BREAKPOINT ? 470 : 560;
  const viewWidth = viewHeight * aspect;
  const x = clamp(player.x - viewWidth / 2, 0, Math.max(0, WORLD.width - viewWidth));
  const y = clamp(player.y - viewHeight / 2, 0, Math.max(0, WORLD.height - viewHeight));
  const scale = rect.width / viewWidth;

  return { x, y, width: viewWidth, height: viewHeight, scale };
}

function drawMap() {
  ctx.fillStyle = "#0b0a09";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawRoom(rooms.nemo, "#2d2822");
  drawRoom(rooms.corridor, "#28241f");
  drawRoom(rooms.conference, "#2b2722");
  drawConnector(rooms.nemoDoor);
  drawConnector(rooms.conferenceDoor);

  drawNemoRoomDetails();
  drawCorridorDetails();
  drawConferenceDetails();
  drawArchiveDoor();
}

function drawRoom(rect, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  drawStoneTexture(rect);

  ctx.strokeStyle = "#51473b";
  ctx.lineWidth = 10;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function drawConnector(rect) {
  ctx.fillStyle = "#211f1c";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(105, 91, 74, 0.82)";
  ctx.lineWidth = 4;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function drawNemoRoomDetails() {
  drawBed(82, 458);
  drawSuitcase(244, 588);
  if (!state.hasTorch) {
    drawFloorTorch(137, 548, -0.18, 1);
  }
  drawWindow(112, 650, 108, 8);
  drawRoomDoor();
}

function drawCorridorDetails() {
  drawParideDoor();
  drawConferenceDoor();
  drawRect(466, 466, 76, 16, "#161412", "rgba(217, 184, 113, 0.22)");
  drawRect(650, 596, 48, 8, "#302820", "rgba(217, 184, 113, 0.18)");

  if (state.heardMovement && !state.enteredConference) {
    ctx.fillStyle = "rgba(155, 178, 189, 0.32)";
    ctx.beginPath();
    ctx.ellipse(735, 535, 10, 22, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawConferenceDetails() {
  drawWindow(870, 304, 134, 8);
  drawConferenceTable(846, 356);

  chairRects.forEach((chair) => drawChair(chair.x + chair.w / 2, chair.y + chair.h / 2));

  ctx.strokeStyle = "rgba(217, 184, 113, 0.38)";
  ctx.lineWidth = 2;
  ctx.strokeRect(916, 462, 24, 24);

  drawGianna();
}

function drawArchiveDoor() {
  const doorColor = state.spokeGianna ? "#66533f" : "#332b25";
  drawDoor(1058, 482, 12, 86, doorColor);

  if (state.spokeGianna) {
    const pulse = 0.78 + Math.sin(performance.now() / 360) * 0.18;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "rgba(255, 222, 145, 0.92)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = `rgba(217, 184, 113, ${0.2 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(1046, 526, 32, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRect(1033, 510, 22, 34, "#100f0e", state.spokeGianna ? "#ffe1a0" : "#5d5148");
  ctx.fillStyle = state.spokeGianna ? "rgba(255,225,160,0.48)" : "rgba(0,0,0,0.28)";
  ctx.fillRect(1038, 516, 12, 4);
  ctx.fillRect(1038, 525, 12, 4);
  ctx.fillRect(1038, 534, 12, 4);

  if (state.spokeGianna) {
    ctx.strokeStyle = "rgba(255, 235, 184, 0.72)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1030, 507, 28, 40);
  }
}

function drawStoneTexture(rect) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(192, 174, 145, 0.16)";

  for (let y = rect.y + 24; y < rect.y + rect.h - 12; y += 34) {
    ctx.beginPath();
    for (let x = rect.x + 12; x <= rect.x + rect.w - 12; x += 28) {
      const offset = (stoneNoise(x, y) - 0.5) * 8;
      if (x === rect.x + 12) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(116, 105, 88, 0.22)";
  for (let y = rect.y + 18; y < rect.y + rect.h - 20; y += 34) {
    const stagger = Math.floor((y - rect.y) / 34) % 2 === 0 ? 0 : 24;
    for (let x = rect.x + 28 + stagger; x < rect.x + rect.w - 18; x += 54) {
      const top = y + (stoneNoise(x, y) - 0.5) * 10;
      const bottom = Math.min(y + 30, rect.y + rect.h - 16);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + (stoneNoise(y, x) - 0.5) * 7, bottom);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(226, 210, 180, 0.1)";
  for (let i = 0; i < 38; i += 1) {
    const x = rect.x + 12 + stoneNoise(i * 19, rect.x) * (rect.w - 24);
    const y = rect.y + 12 + stoneNoise(rect.y, i * 23) * (rect.h - 24);
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  ctx.restore();
}

function stoneNoise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function drawRoomDoor() {
  if (state.leftRoom) {
    drawRect(327, 526, 10, 54, "#7f674e", "#d2b88b");
    drawRect(340, 523, 28, 8, "#3f3329", "rgba(224,199,153,0.25)");
    return;
  }

  drawRect(324, 522, 18, 64, "#6a513d", "#d5b178");
  drawRect(327, 529, 12, 50, "#3d3027", "rgba(244,236,220,0.18)");
  ctx.fillStyle = "#d8b871";
  ctx.beginPath();
  ctx.arc(331, 554, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawParideDoor() {
  drawRect(454, 492, 104, 16, "#49382f", "#b28f66");
  drawRect(464, 495, 84, 9, "#2a211d", "rgba(244,236,220,0.14)");
  ctx.fillStyle = "#d8b871";
  ctx.beginPath();
  ctx.arc(542, 501, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawConferenceDoor() {
  if (state.conferenceDoorOpen) {
    drawRect(800, 508, 10, 40, "#6a513d", "#caa977");
    drawRect(800, 566, 10, 40, "#6a513d", "#caa977");
    drawRect(814, 520, 26, 8, "#3d3027", "rgba(244,236,220,0.14)");
    drawRect(814, 586, 26, 8, "#3d3027", "rgba(244,236,220,0.14)");
    return;
  }

  drawRect(802, 506, 16, 48, "#5b4435", "#caa977");
  drawRect(802, 558, 16, 48, "#5b4435", "#caa977");
  drawRect(806, 514, 8, 32, "#2a211d", "rgba(244,236,220,0.14)");
  drawRect(806, 566, 8, 32, "#2a211d", "rgba(244,236,220,0.14)");
  ctx.fillStyle = "#d8b871";
  ctx.beginPath();
  ctx.arc(812, 551, 2.3, 0, Math.PI * 2);
  ctx.arc(812, 561, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawObjects() {
  if (!state.hasTorch) {
    ctx.save();
    ctx.shadowColor = "rgba(244, 218, 152, 0.85)";
    ctx.shadowBlur = 18;
    drawFloorTorch(137, 548, -0.18, 1.12);
    ctx.restore();
  }
}

function drawForegroundObjects() {
  if (state.hasTorch) return;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "rgba(255, 236, 181, 0.95)";
  ctx.shadowBlur = 22;

  const pulse = 0.72 + Math.sin(performance.now() / 420) * 0.16;
  ctx.fillStyle = `rgba(255, 225, 145, ${0.2 * pulse})`;
  ctx.beginPath();
  ctx.ellipse(137, 548, 62, 34, -0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  drawFloorTorch(137, 548, -0.18, 1.36);
}

function drawBed(x, y) {
  drawRect(x, y, 108, 66, "#40382f", "#766755");
  drawRect(x + 8, y + 7, 42, 25, "#766452", "#a28f78");
  drawRect(x + 8, y + 36, 92, 22, "#2b2621", "rgba(224,199,153,0.24)");

  ctx.strokeStyle = "rgba(244,236,220,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 57, y + 9);
  ctx.lineTo(x + 57, y + 58);
  ctx.stroke();
}

function drawSuitcase(x, y) {
  drawRect(x, y, 50, 36, "#5a3f32", "#9b7b61");
  drawRect(x + 4, y + 5, 42, 26, "#3f2e28", "rgba(244,236,220,0.16)");

  ctx.strokeStyle = "#c5a576";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 1);
  ctx.quadraticCurveTo(x + 25, y - 7, x + 31, y + 1);
  ctx.stroke();

  ctx.fillStyle = "#d2b06f";
  ctx.fillRect(x + 23, y + 17, 7, 4);
}

function drawFloorTorch(x, y, angle, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(217,184,113,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#151311";
  ctx.strokeStyle = "#d7b871";
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundedRectPath(-20, -6, 30, 12, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d7b871";
  ctx.beginPath();
  roundedRectPath(7, -8, 13, 16, 4);
  ctx.fill();

  ctx.fillStyle = "#fff0bd";
  ctx.beginPath();
  ctx.ellipse(21, 0, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 231, 166, 0.18)";
  ctx.beginPath();
  ctx.moveTo(24, -7);
  ctx.lineTo(58, -19);
  ctx.lineTo(58, 19);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawConferenceTable(x, y) {
  drawRect(x, y, 120, 30, "#3a3129", "#806c55");
  drawRect(x + 8, y + 6, 104, 18, "#2b2520", "rgba(244,236,220,0.16)");
  ctx.strokeStyle = "rgba(224,199,153,0.18)";
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 15);
  ctx.lineTo(x + 106, y + 15);
  ctx.stroke();
}

function drawChair(x, y) {
  drawRect(x - 10, y - 8, 20, 17, "#484039", "#8b7a64");
  drawRect(x - 8, y - 14, 16, 5, "#302a25", "rgba(244,236,220,0.16)");
  ctx.strokeStyle = "rgba(224,199,153,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 9);
  ctx.lineTo(x - 11, y + 15);
  ctx.moveTo(x + 8, y + 9);
  ctx.lineTo(x + 11, y + 15);
  ctx.stroke();
}

function drawGianna() {
  ctx.save();
  ctx.translate(944, 346);

  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 23, 24, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawRect(-16, 12, 32, 22, "#201b18", "#6c5b4a");
  drawRect(-19, 6, 38, 10, "#2c2621", "#8a7762");

  ctx.fillStyle = state.spokeGianna ? "#8ba4af" : "#695f57";
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3b302a";
  ctx.beginPath();
  ctx.ellipse(-11, 12, 6, 15, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11, 12, 6, 15, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c4ad92";
  ctx.beginPath();
  ctx.ellipse(0, -10, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2d211e";
  ctx.beginPath();
  ctx.ellipse(0, -14, 12, 8, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8, -12, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(244,236,220,0.42)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -8, 8, -0.2, 1.3);
  ctx.stroke();

  ctx.fillStyle = "#171514";
  ctx.beginPath();
  ctx.ellipse(-7, 31, 4, 9, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, 31, 4, 9, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  const stride = player.isWalking ? Math.sin(player.walkTime * 14) : 0;
  const coatSway = player.isWalking ? Math.sin(player.walkTime * 10) * 1.4 : 0;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(-4, 7, 21, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#191614";
  ctx.beginPath();
  ctx.ellipse(-9, 0, 15, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#95846f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-9, 0, 15, 20, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#473b31";
  ctx.beginPath();
  ctx.ellipse(-5, -8 + coatSway, 6, 12, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-5, 8 - coatSway, 6, 12, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(225,210,180,0.42)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.lineTo(-10, 14);
  ctx.stroke();

  ctx.fillStyle = "#151311";
  ctx.beginPath();
  ctx.ellipse(-18, -8 + stride * 2, 5, 8, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-18, 8 - stride * 2, 5, 8, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#cdbba2";
  ctx.beginPath();
  ctx.ellipse(8, 0, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2b211d";
  ctx.beginPath();
  ctx.ellipse(10, -3, 10, 7, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#0b0a09";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.lineTo(9, -17);
  ctx.stroke();

  ctx.fillStyle = "rgba(244,236,220,0.55)";
  ctx.beginPath();
  ctx.ellipse(13, 4, 2.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.hasTorch) {
    ctx.strokeStyle = "#1a1714";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(1, 10);
    ctx.lineTo(20, 13);
    ctx.stroke();

    ctx.strokeStyle = state.torchOn ? "#d9b871" : "#6b6054";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(17, 13);
    ctx.lineTo(34, 15);
    ctx.stroke();

    if (state.torchOn) {
      ctx.fillStyle = "rgba(217, 184, 113, 0.7)";
      ctx.beginPath();
      ctx.arc(36, 15, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(244, 236, 220, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(8, 0, 13, -0.85, 0.85);
  ctx.stroke();

  ctx.restore();
}

function drawLighting() {
  ctx.save();
  ctx.fillStyle = state.torchOn ? "rgba(0, 0, 0, 0.46)" : "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.globalCompositeOperation = "destination-out";

  const ambientRadius = state.torchOn ? 235 : 165;
  const gradient = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, ambientRadius);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.58, "rgba(0, 0, 0, 0.72)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.08)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(player.x, player.y, ambientRadius, 0, Math.PI * 2);
  ctx.fill();

  if (state.torchOn) {
    const length = 460;
    const spread = 0.56;
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.angle - spread) * length, player.y + Math.sin(player.angle - spread) * length);
    ctx.arc(player.x, player.y, length, player.angle - spread, player.angle + spread);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawTorchBeam() {
  if (!state.torchOn) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.globalCompositeOperation = "screen";

  const length = 420;
  const spread = 0.52;
  const beam = ctx.createRadialGradient(12, 0, 10, 12, 0, length);
  beam.addColorStop(0, "rgba(255, 232, 166, 0.38)");
  beam.addColorStop(0.34, "rgba(239, 199, 118, 0.2)");
  beam.addColorStop(0.72, "rgba(185, 143, 76, 0.08)");
  beam.addColorStop(1, "rgba(185, 143, 76, 0)");

  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(18, -16);
  ctx.lineTo(Math.cos(-spread) * length, Math.sin(-spread) * length);
  ctx.arc(0, 0, length, -spread, spread);
  ctx.lineTo(18, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 238, 190, 0.32)";
  ctx.beginPath();
  ctx.ellipse(58, 0, 48, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWindow(x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(155, 178, 189, 0.65)";
  ctx.shadowBlur = 16;
  drawRect(x, y, w, h, "#9bb2bd", "rgba(225, 239, 244, 0.8)");
  ctx.restore();

  ctx.strokeStyle = "rgba(225, 239, 244, 0.26)";
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 18) {
    ctx.beginPath();
    ctx.moveTo(x + i, y - 18);
    ctx.lineTo(x + i + 8, y + 24);
    ctx.stroke();
  }
}

function drawDoor(x, y, w, h, color) {
  drawRect(x, y, w, h, color, "rgba(224,199,153,0.28)");
}

function drawRect(x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
}

function roundedRectPath(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function gameLoop(time) {
  const delta = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(gameLoop);
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isControlKey(key) {
  return [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "w",
    "a",
    "s",
    "d",
    " ",
    "e",
    "f",
    "Escape",
    "Enter",
    "Backspace"
  ].includes(key);
}

function handleKeydown(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (isControlKey(key)) event.preventDefault();

  if (state.modalOpen) {
    handleModalKey(key);
    return;
  }

  if (key === "Escape") {
    if (state.messageOpen) closeMessage();
    return;
  }

  if (key === "e" || key === " ") {
    interact();
    return;
  }

  if (key === "f") {
    toggleTorch();
    return;
  }

  keys.add(key);
}

function handleKeyup(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
}

function handleModalKey(key) {
  if (key === "Escape") {
    closeKeypad();
    return;
  }

  if (key === "Enter") {
    submitKeypad();
    return;
  }

  if (key === "Backspace") {
    state.keypadValue = state.keypadValue.slice(0, -1);
    updateKeypad();
    return;
  }

  if (/^[0-9]$/.test(key)) {
    addKeypadDigit(key);
  }
}

function setupTouchControls() {
  document.querySelectorAll("[data-touch-dir]").forEach((button) => {
    const direction = button.dataset.touchDir;
    const start = (event) => {
      event.preventDefault();
      touchDirs.add(direction);
    };
    const end = (event) => {
      event.preventDefault();
      touchDirs.delete(direction);
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("pointerleave", end);
  });

  touchInteract.addEventListener("click", interact);
  touchTorch.addEventListener("click", toggleTorch);
}

function setupKeypad() {
  document.querySelectorAll("[data-keypad-digit]").forEach((button) => {
    button.addEventListener("click", () => addKeypadDigit(button.dataset.keypadDigit));
  });

  document.querySelector("[data-keypad-clear]").addEventListener("click", () => {
    if (state.keypadLocked) return;
    state.keypadValue = "";
    updateKeypad();
  });

  document.querySelector("[data-keypad-back]").addEventListener("click", () => {
    if (state.keypadLocked) return;
    state.keypadValue = state.keypadValue.slice(0, -1);
    updateKeypad();
  });

  keypadSubmit.addEventListener("click", submitKeypad);
  keypadLeave.addEventListener("click", () => {
    closeKeypad();
    showEnding("normal");
  });
  keypadClose.addEventListener("click", closeKeypad);
}

function initAudio() {
  if (audioContext) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext = new AudioContextClass();
  audioMaster = audioContext.createGain();
  audioMaster.gain.value = 0.045;
  audioMaster.connect(audioContext.destination);

  const bufferLength = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferLength; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.45;
  }

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 760;

  rainSource = audioContext.createBufferSource();
  rainSource.buffer = buffer;
  rainSource.loop = true;
  rainSource.connect(filter);
  filter.connect(audioMaster);
  rainSource.start();
}

function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  audioToggle.setAttribute("aria-pressed", String(state.audioEnabled));
  audioToggle.textContent = state.audioEnabled ? "Audio sì" : "Audio no";

  if (state.audioEnabled) {
    initAudio();
    if (audioContext && audioContext.state === "suspended") audioContext.resume();
    playTone("switch");
    return;
  }

  if (audioContext && audioContext.state === "running") audioContext.suspend();
}

function playTone(type) {
  if (!state.audioEnabled) return;
  initAudio();
  if (!audioContext || !audioMaster) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const settings = {
    switch: [420, 0.06, 0.06],
    door: [92, 0.22, 0.07],
    whisper: [160, 0.18, 0.045],
    tap: [260, 0.045, 0.04],
    wrong: [82, 0.18, 0.06],
    unlock: [520, 0.28, 0.07],
    step: [118, 0.045, 0.025]
  }[type] || [200, 0.08, 0.04];

  osc.type = type === "wrong" || type === "door" || type === "step" ? "sine" : "triangle";
  osc.frequency.setValueAtTime(settings[0], now);
  if (type === "unlock") {
    osc.frequency.exponentialRampToValueAtTime(760, now + settings[1]);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(settings[2], now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[1]);

  osc.connect(gain);
  gain.connect(audioMaster);
  osc.start(now);
  osc.stop(now + settings[1] + 0.03);
}

function maybePlayFootstep() {
  const now = performance.now();
  if (now - player.lastStep < 420) return;
  player.lastStep = now;
  playTone("step");
}

startButton.addEventListener("click", startGame);
messageClose.addEventListener("click", closeMessage);
audioToggle.addEventListener("click", toggleAudio);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("blur", () => {
  keys.clear();
  touchDirs.clear();
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

setupTouchControls();
setupKeypad();
updateHud();
roomLabel.textContent = state.lastRoom;
requestAnimationFrame(gameLoop);
