/* =========================================================
   RPG FORGE
   FINAL ENGINE
   ========================================================= */


/* =========================================================
   CONSTANTS
   ========================================================= */

const STORAGE_KEY =
  "rpgForgeProject";

const MIN_MAP_WIDTH = 5;
const MAX_MAP_WIDTH = 50;

const MIN_MAP_HEIGHT = 5;
const MAX_MAP_HEIGHT = 40;

const BLOCKED_TILES = new Set([
  "water",
  "wall",
  "tree"
]);


/* =========================================================
   DEFAULT PROJECT
   ========================================================= */

const DEFAULT_PROJECT = {

  version: 1,

  name: "My RPG",

  map: {

    width: 16,

    height: 12,

    tiles: []

  },

  player: {

    x: 2,

    y: 2,

    hp: 100,

    maxHp: 100,

    attack: 12,

    gold: 50

  },

  npcs: [],

  inventory: {

    "Health Potion": 3

  }

};


/* =========================================================
   ENGINE STATE
   ========================================================= */

let project =
  structuredClone(DEFAULT_PROJECT);

let selectedTool =
  "paint";

let selectedTile =
  "grass";

let selectedNpcId =
  null;

let zoom =
  32;

let playMode =
  false;

let combat =
  null;

let notificationTimer =
  null;

let lastInteractionTime =
  0;


/* =========================================================
   DOM
   ========================================================= */

const $ = selector =>
  document.querySelector(selector);

const $$ = selector =>
  document.querySelectorAll(selector);


const gameCanvas =
  $("#gameCanvas");

const playerSprite =
  $("#playerSprite");

const projectName =
  $("#projectName");

const mapWidth =
  $("#mapWidth");

const mapHeight =
  $("#mapHeight");

const npcEditor =
  $("#npcEditor");

const npcEmpty =
  $("#npcEmpty");

const npcName =
  $("#npcName");

const npcDialogue =
  $("#npcDialogue");

const npcIcon =
  $("#npcIcon");

const inventoryList =
  $("#inventoryList");

const notification =
  $("#notification");


/* =========================================================
   UTILITY
   ========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(max, value)
  );

}


function generateId() {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 9)
  );

}


function deepClone(object) {

  return JSON.parse(
    JSON.stringify(object)
  );

}


/* =========================================================
   MAP GENERATION
   ========================================================= */

function createDefaultMap() {

  project.map.tiles = [];


  for (
    let y = 0;
    y < project.map.height;
    y++
  ) {

    const row = [];


    for (
      let x = 0;
      x < project.map.width;
      x++
    ) {

      let tile = "grass";


      /*
       * Outer water border
       */

      if (
        x === 0 ||
        y === 0 ||
        x === project.map.width - 1 ||
        y === project.map.height - 1
      ) {

        tile = "water";

      }


      /*
       * Stone path
       */

      if (
        y === 5 &&
        x > 0 &&
        x < project.map.width - 1
      ) {

        tile = "stone";

      }


      /*
       * Sand area
       */

      if (
        x >= 10 &&
        x <= 13 &&
        y >= 7 &&
        y <= 9
      ) {

        tile = "sand";

      }


      /*
       * Small trees
       */

      if (
        (x === 4 && y === 3) ||
        (x === 5 && y === 3) ||
        (x === 4 && y === 4) ||
        (x === 13 && y === 3) ||
        (x === 14 && y === 3)
      ) {

        tile = "tree";

      }


      row.push(tile);

    }


    project.map.tiles.push(row);

  }

}


/* =========================================================
   DEFAULT NPCS
   ========================================================= */

function createDefaultNPCs() {

  project.npcs = [

    {

      id: generateId(),

      x: 7,

      y: 4,

      name: "Village Elder",

      dialogue:
        "Welcome, traveler. The ancient ruins lie beyond the forest.",

      icon: "[E]"

    },


    {

      id: generateId(),

      x: 11,

      y: 7,

      name: "Merchant",

      dialogue:
        "I have potions for those brave enough to explore the wilderness.",

      icon: "[M]"

    }

  ];

}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initialize() {

  createDefaultMap();

  createDefaultNPCs();

  updateAll();

  showNotification(
    "RPG Forge ready."
  );

}


initialize();


/* =========================================================
   RENDER MAP
   ========================================================= */

function renderMap() {

  gameCanvas.innerHTML = "";


  gameCanvas.style.gridTemplateColumns =
    `repeat(${project.map.width}, ${zoom}px)`;


  gameCanvas.style.gridTemplateRows =
    `repeat(${project.map.height}, ${zoom}px)`;


  gameCanvas.style.setProperty(
    "--tile-size",
    `${zoom}px`
  );


  for (
    let y = 0;
    y < project.map.height;
    y++
  ) {

    for (
      let x = 0;
      x < project.map.width;
      x++
    ) {

      const tile =
        document.createElement("div");


      tile.className =
        `map-tile ${project.map.tiles[y][x]}`;


      tile.dataset.x = x;
      tile.dataset.y = y;


      tile.addEventListener(
        "mouseenter",
        () => {

          $("#cursorPosition")
            .textContent =
            `X: ${x} Y: ${y}`;

        }
      );


      tile.addEventListener(
        "mousedown",
        event => {

          handleTileClick(
            x,
            y,
            event
          );

        }
      );


      /*
       * NPC
       */

      const npc =
        getNpcAt(x, y);


      if (npc) {

        const sprite =
          document.createElement("div");


        sprite.className =
          "npc-sprite";


        sprite.textContent =
          npc.icon;


        sprite.title =
          npc.name;


        tile.appendChild(
          sprite
        );

      }


      /*
       * Player start marker
       */

      if (
        !playMode &&
        project.player.x === x &&
        project.player.y === y
      ) {

        const marker =
          document.createElement("div");


        marker.className =
          "start-marker";


        tile.appendChild(
          marker
        );

      }


      gameCanvas.appendChild(
        tile
      );

    }

  }


  gameCanvas.appendChild(
    playerSprite
  );


  positionPlayer();

}


/* =========================================================
   TILE INTERACTION
   ========================================================= */

function handleTileClick(
  x,
  y,
  event
) {

  if (playMode) {

    return;

  }


  /*
   * NPC
   */

  if (
    selectedTool === "npc"
  ) {

    let npc =
      getNpcAt(x, y);


    if (!npc) {

      npc = {

        id: generateId(),

        x,

        y,

        name: "Villager",

        dialogue:
          "Hello, traveler!",

        icon: "[P]"

      };


      project.npcs.push(
        npc
      );

    }


    selectedNpcId =
      npc.id;


    updateNpcEditor();

    renderMap();

    updateEngineInfo();

    return;

  }


  /*
   * Player start
   */

  if (
    selectedTool === "start"
  ) {

    if (
      BLOCKED_TILES.has(
        project.map.tiles[y][x]
      )
    ) {

      showNotification(
        "Player start cannot be placed on blocked terrain."
      );

      return;

    }


    if (getNpcAt(x, y)) {

      showNotification(
        "Player start cannot overlap an NPC."
      );

      return;

    }


    project.player.x = x;

    project.player.y = y;


    renderMap();

    return;

  }


  /*
   * Erase
   */

  if (
    selectedTool === "erase"
  ) {

    project.map.tiles[y][x] =
      "grass";


    renderMap();

    return;

  }


  /*
   * Paint
   */

  if (
    selectedTool === "paint"
  ) {

    if (
      getNpcAt(x, y)
    ) {

      showNotification(
        "Remove the NPC before painting this tile."
      );

      return;

    }


    if (
      project.player.x === x &&
      project.player.y === y
    ) {

      showNotification(
        "Move the player start before changing this tile."
      );

      return;

    }


    project.map.tiles[y][x] =
      selectedTile;


    renderMap();

  }

}


/* =========================================================
   NPC LOOKUP
   ========================================================= */

function getNpcAt(x, y) {

  return project.npcs.find(
    npc =>
      npc.x === x &&
      npc.y === y
  );

}


function getSelectedNpc() {

  return project.npcs.find(
    npc =>
      npc.id === selectedNpcId
  );

}


/* =========================================================
   TOOLS
   ========================================================= */

$$(".tool-btn").forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        $$(".tool-btn")
          .forEach(
            btn =>
              btn.classList.remove(
                "active"
              )
          );


        button.classList.add(
          "active"
        );


        selectedTool =
          button.dataset.tool;


        $("#currentTool")
          .textContent =
          selectedTool.toUpperCase();


        if (
          selectedTool !== "npc"
        ) {

          selectedNpcId =
            null;

          updateNpcEditor();

        }

      }
    );

  }
);


/* =========================================================
   TILE PALETTE
   ========================================================= */

$$(".tile-option").forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        $$(".tile-option")
          .forEach(
            btn =>
              btn.classList.remove(
                "selected"
              )
          );


        button.classList.add(
          "selected"
        );


        selectedTile =
          button.dataset.tile;


        selectedTool =
          "paint";


        $$(".tool-btn")
          .forEach(
            btn =>
              btn.classList.remove(
                "active"
              )
          );


        $(
          '[data-tool="paint"]'
        ).classList.add(
          "active"
        );


        $("#currentTool")
          .textContent =
          "PAINT";

      }
    );

  }
);


/* =========================================================
   NPC INSPECTOR
   ========================================================= */

function updateNpcEditor() {

  const npc =
    getSelectedNpc();


  if (!npc) {

    npcEditor.hidden =
      true;

    npcEmpty.hidden =
      false;

    return;

  }


  npcEditor.hidden =
    false;

  npcEmpty.hidden =
    true;


  npcName.value =
    npc.name;

  npcDialogue.value =
    npc.dialogue;

  npcIcon.value =
    npc.icon;

}


/* =========================================================
   NPC NAME
   ========================================================= */

npcName.addEventListener(
  "input",
  () => {

    const npc =
      getSelectedNpc();


    if (!npc) return;


    npc.name =
      npcName.value;


    renderMap();

  }
);


/* =========================================================
   NPC DIALOGUE
   ========================================================= */

npcDialogue.addEventListener(
  "input",
  () => {

    const npc =
      getSelectedNpc();


    if (!npc) return;


    npc.dialogue =
      npcDialogue.value;

  }
);


/* =========================================================
   NPC ICON
   ========================================================= */

npcIcon.addEventListener(
  "change",
  () => {

    const npc =
      getSelectedNpc();


    if (!npc) return;


    npc.icon =
      npcIcon.value;


    renderMap();

  }
);


/* =========================================================
   DELETE NPC
   ========================================================= */

$("#deleteNpcBtn")
  .addEventListener(
    "click",
    () => {

      if (!selectedNpcId) {

        return;

      }


      project.npcs =
        project.npcs.filter(
          npc =>
            npc.id !==
            selectedNpcId
        );


      selectedNpcId =
        null;


      updateNpcEditor();

      renderMap();

      updateEngineInfo();

      showNotification(
        "NPC deleted."
      );

    }
  );


/* =========================================================
   MAP RESIZE
   ========================================================= */

$("#resizeMapBtn")
  .addEventListener(
    "click",
    resizeMap
  );


function resizeMap() {

  const width =
    clamp(
      parseInt(
        mapWidth.value,
        10
      ) || 16,
      MIN_MAP_WIDTH,
      MAX_MAP_WIDTH
    );


  const height =
    clamp(
      parseInt(
        mapHeight.value,
        10
      ) || 12,
      MIN_MAP_HEIGHT,
      MAX_MAP_HEIGHT
    );


  const oldTiles =
    project.map.tiles;


  const newTiles = [];


  for (
    let y = 0;
    y < height;
    y++
  ) {

    const row = [];


    for (
      let x = 0;
      x < width;
      x++
    ) {

      if (
        oldTiles[y] &&
        oldTiles[y][x]
      ) {

        row.push(
          oldTiles[y][x]
        );

      } else {

        row.push(
          "grass"
        );

      }

    }


    newTiles.push(
      row
    );

  }


  project.map.width =
    width;

  project.map.height =
    height;

  project.map.tiles =
    newTiles;


  project.player.x =
    clamp(
      project.player.x,
      0,
      width - 1
    );


  project.player.y =
    clamp(
      project.player.y,
      0,
      height - 1
    );


  /*
   * Remove NPCs outside map.
   */

  project.npcs =
    project.npcs.filter(
      npc =>
        npc.x < width &&
        npc.y < height
    );


  /*
   * Repair blocked player position.
   */

  if (
    BLOCKED_TILES.has(
      project.map.tiles[
        project.player.y
      ][
        project.player.x
      ]
    )
  ) {

    findValidPlayerPosition();

  }


  updateAll();

  showNotification(
    `Map resized to ${width} × ${height}.`
  );

}


/* =========================================================
   FIND VALID PLAYER POSITION
   ========================================================= */

function findValidPlayerPosition() {

  for (
    let y = 0;
    y < project.map.height;
    y++
  ) {

    for (
      let x = 0;
      x < project.map.width;
      x++
    ) {

      if (
        !BLOCKED_TILES.has(
          project.map.tiles[y][x]
        ) &&
        !getNpcAt(x, y)
      ) {

        project.player.x =
          x;

        project.player.y =
          y;

        return;

      }

    }

  }

}


/* =========================================================
   PROJECT NAME
   ========================================================= */

projectName.addEventListener(
  "input",
  () => {

    const name =
      projectName.value.trim();


    project.name =
      name || "Untitled RPG";


    $("#projectTitle")
      .textContent =
      project.name;

  }
);


/* =========================================================
   ZOOM
   ========================================================= */

$("#zoomIn")
  .addEventListener(
    "click",
    () => {

      zoom =
        clamp(
          zoom + 4,
          16,
          64
        );


      updateZoom();

    }
  );


$("#zoomOut")
  .addEventListener(
    "click",
    () => {

      zoom =
        clamp(
          zoom - 4,
          16,
          64
        );


      updateZoom();

    }
  );


function updateZoom() {

  $("#zoomValue")
    .textContent =
    `${zoom}px`;


  $("#tileInfo")
    .textContent =
    `${zoom}px`;


  renderMap();

}


/* =========================================================
   PLAYER POSITION
   ========================================================= */

function positionPlayer() {

  playerSprite.style.left =
    `${project.player.x * zoom}px`;

  playerSprite.style.top =
    `${project.player.y * zoom}px`;

}


/* =========================================================
   PLAYTEST MODE
   ========================================================= */

$("#playModeBtn")
  .addEventListener(
    "click",
    enterPlayMode
  );


$("#editModeBtn")
  .addEventListener(
    "click",
    enterEditMode
  );


function enterPlayMode() {

  if (combat) {

    showNotification(
      "Finish the current battle first."
    );

    return;

  }


  playMode =
    true;


  $("#playModeBtn")
    .classList.add(
      "active"
    );


  $("#editModeBtn")
    .classList.remove(
      "active"
    );


  $("#editorStatus")
    .textContent =
    "Playtest Mode";


  $("#bottomMode")
    .textContent =
    "PLAYTEST";


  $("#app")
    .classList.add(
      "play-mode"
    );


  renderMap();


  showNotification(
    "Playtest started — WASD / arrows to move."
  );

}


function enterEditMode() {

  playMode =
    false;


  $("#editModeBtn")
    .classList.add(
      "active"
    );


  $("#playModeBtn")
    .classList.remove(
      "active"
    );


  $("#editorStatus")
    .textContent =
    "Editor Mode";


  $("#bottomMode")
    .textContent =
    "EDITOR";


  $("#app")
    .classList.remove(
      "play-mode"
    );


  renderMap();

}


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (!playMode) {

      return;

    }


    if (
      event.repeat
    ) {

      return;

    }


    const key =
      event.key.toLowerCase();


    const movementKeys = [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright"
    ];


    if (
      movementKeys.includes(key)
    ) {

      event.preventDefault();

    }


    if (
      key === "w" ||
      key === "arrowup"
    ) {

      movePlayer(0, -1);

    }


    else if (
      key === "s" ||
      key === "arrowdown"
    ) {

      movePlayer(0, 1);

    }


    else if (
      key === "a" ||
      key === "arrowleft"
    ) {

      movePlayer(-1, 0);

    }


    else if (
      key === "d" ||
      key === "arrowright"
    ) {

      movePlayer(1, 0);

    }


    else if (
      key === " "
    ) {

      event.preventDefault();

      interactForward();

    }


  }
);


/* =========================================================
   PLAYER MOVEMENT
   ========================================================= */

function movePlayer(
  dx,
  dy
) {

  if (!playMode) return;

  if (combat) return;


  const nx =
    project.player.x + dx;

  const ny =
    project.player.y + dy;


  if (
    nx < 0 ||
    ny < 0 ||
    nx >= project.map.width ||
    ny >= project.map.height
  ) {

    return;

  }


  /*
   * NPC interaction
   */

  const npc =
    getNpcAt(nx, ny);


  if (npc) {

    interactWithNPC(npc);

    return;

  }


  /*
   * Terrain collision
   */

  const tile =
    project.map.tiles[ny][nx];


  if (
    BLOCKED_TILES.has(tile)
  ) {

    showNotification(
      "That terrain is impassable."
    );

    return;

  }


  project.player.x =
    nx;

  project.player.y =
    ny;


  positionPlayer();


  /*
   * Small encounter chance.
   */

  if (
    Math.random() < .06
  ) {

    startCombat();

  }

}


/* =========================================================
   SPACE INTERACTION
   ========================================================= */

function interactForward() {

  const adjacent = [

    [project.player.x + 1, project.player.y],

    [project.player.x - 1, project.player.y],

    [project.player.x, project.player.y + 1],

    [project.player.x, project.player.y - 1]

  ];


  for (
    const [x, y] of adjacent
  ) {

    const npc =
      getNpcAt(x, y);


    if (npc) {

      interactWithNPC(npc);

      return;

    }

  }


  showNotification(
    "Nothing to interact with."
  );

}


/* =========================================================
   NPC DIALOGUE
   ========================================================= */

function interactWithNPC(npc) {

  if (
    Date.now() -
    lastInteractionTime <
    300
  ) {

    return;

  }


  lastInteractionTime =
    Date.now();


  $("#dialogueName")
    .textContent =
    npc.name;


  $("#dialogueText")
    .textContent =
    npc.dialogue;


  $("#dialoguePortrait")
    .textContent =
    npc.icon;


  $("#dialogueOverlay")
    .classList.remove(
      "hidden"
    );

}


$("#dialogueClose")
  .addEventListener(
    "click",
    closeDialogue
  );


function closeDialogue() {

  $("#dialogueOverlay")
    .classList.add(
      "hidden"
    );

}


/* =========================================================
   ESC CLOSES WINDOWS
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      closeDialogue();

      if (combat) {

        /*
         * Combat deliberately
         * cannot be cancelled.
         */

        return;

      }

    }

  }
);


/* =========================================================
   COMBAT
   ========================================================= */

function startCombat() {

  if (combat) return;


  combat = {

    enemy: {

      name:
        "Forest Goblin",

      hp: 60,

      maxHp: 60,

      attack: 8

    }

  };


  $("#enemyName")
    .textContent =
    combat.enemy.name;


  $("#combatOverlay")
    .classList.remove(
      "hidden"
    );


  updateCombatUI();


  combatLog(
    "A Forest Goblin attacks!"
  );

}


/* =========================================================
   COMBAT UI
   ========================================================= */

function updateCombatUI() {

  if (!combat) return;


  const playerHp =
    project.player.hp;


  const enemyHp =
    combat.enemy.hp;


  $("#heroCombatHp")
    .textContent =
    `${playerHp} / ${project.player.maxHp}`;


  $("#enemyCombatHp")
    .textContent =
    `${enemyHp} / ${combat.enemy.maxHp}`;


  $("#heroHpBar")
    .style.width =
    `${
      Math.max(
        0,
        playerHp /
        project.player.maxHp *
        100
      )
    }%`;


  $("#enemyHpBar")
    .style.width =
    `${
      Math.max(
        0,
        enemyHp /
        combat.enemy.maxHp *
        100
      )
    }%`;

}


/* =========================================================
   COMBAT LOG
   ========================================================= */

function combatLog(message) {

  $("#combatLog")
    .textContent =
    message;

}


/* =========================================================
   PLAYER ATTACK
   ========================================================= */

$("#attackBtn")
  .addEventListener(
    "click",
    () => {

      if (!combat) return;


      const damage =
        Math.max(
          1,
          Math.floor(
            project.player.attack *
            (
              .8 +
              Math.random() * .4
            )
          )
        );


      combat.enemy.hp =
        Math.max(
          0,
          combat.enemy.hp -
          damage
        );


      combatLog(
        `You deal ${damage} damage!`
      );


      updateCombatUI();


      if (
        combat.enemy.hp <= 0
      ) {

        setTimeout(
          winCombat,
          500
        );

        return;

      }


      setTimeout(
        enemyAttack,
        600
      );

    }
  );


/* =========================================================
   ENEMY ATTACK
   ========================================================= */

function enemyAttack() {

  if (!combat) return;


  const damage =
    Math.max(
      1,
      Math.floor(
        combat.enemy.attack *
        (
          .8 +
          Math.random() * .4
        )
      )
    );


  project.player.hp =
    Math.max(
      0,
      project.player.hp -
      damage
    );


  combatLog(
    `${combat.enemy.name} deals ${damage} damage!`
  );


  updateCombatUI();

  updateUI();


  if (
    project.player.hp <= 0
  ) {

    setTimeout(
      playerDefeated,
      500
    );

  }

}


/* =========================================================
   WIN COMBAT
   ========================================================= */

function winCombat() {

  if (!combat) return;


  project.player.gold +=
    15;


  combatLog(
    "Enemy defeated! +15 gold."
  );


  setTimeout(
    () => {

      $("#combatOverlay")
        .classList.add(
          "hidden"
        );


      combat =
        null;


      updateUI();

      showNotification(
        "Victory! You gained 15 gold."
      );

    },
    900
  );

}


/* =========================================================
   DEFEAT
   ========================================================= */

function playerDefeated() {

  combat =
    null;


  $("#combatOverlay")
    .classList.add(
      "hidden"
    );


  project.player.hp =
    project.player.maxHp;


  updateUI();


  showNotification(
    "Defeated — HP restored."
  );

}


/* =========================================================
   RUN
   ========================================================= */

$("#runBtn")
  .addEventListener(
    "click",
    () => {

      if (!combat) return;


      if (
        Math.random() < .65
      ) {

        $("#combatOverlay")
          .classList.add(
            "hidden"
          );


        combat =
          null;


        showNotification(
          "You escaped."
        );


      } else {

        combatLog(
          "You failed to escape!"
        );


        setTimeout(
          enemyAttack,
          400
        );

      }

    }
  );


/* =========================================================
   POTION
   ========================================================= */

$("#potionBtn")
  .addEventListener(
    "click",
    usePotion
  );


function usePotion() {

  if (!combat) return;


  const quantity =
    project.inventory[
      "Health Potion"
    ] || 0;


  if (
    quantity <= 0
  ) {

    combatLog(
      "You have no Health Potions."
    );

    return;

  }


  if (
    project.player.hp >=
    project.player.maxHp
  ) {

    combatLog(
      "Your HP is already full."
    );

    return;

  }


  project.inventory[
    "Health Potion"
  ]--;


  const healed =
    Math.min(
      30,
      project.player.maxHp -
      project.player.hp
    );


  project.player.hp +=
    healed;


  combatLog(
    `You recover ${healed} HP.`
  );


  updateCombatUI();

  updateUI();


  setTimeout(
    enemyAttack,
    500
  );

}


/* =========================================================
   INVENTORY
   ========================================================= */

function renderInventory() {

  inventoryList.innerHTML =
    "";


  const entries =
    Object.entries(
      project.inventory
    );


  if (
    entries.length === 0
  ) {

    inventoryList.innerHTML = `
      <div class="inventory-item">
        <span>Empty</span>
        <span>—</span>
      </div>
    `;

    return;

  }


  entries.forEach(
    ([item, quantity]) => {

      const element =
        document.createElement(
          "div"
        );


      element.className =
        "inventory-item";


      element.innerHTML = `
        <span>
          ${getItemIcon(item)}
          ${escapeHtml(item)}
        </span>

        <span>
          ×${quantity}
        </span>
      `;


      inventoryList.appendChild(
        element
      );

    }
  );

}


function getItemIcon(item) {

  if (
    item === "Health Potion"
  ) {

    return "[P]";

  }


  return "[I]";

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   ADD POTION
   ========================================================= */

$("#addPotionBtn")
  .addEventListener(
    "click",
    () => {

      project.inventory[
        "Health Potion"
      ] =
        (
          project.inventory[
            "Health Potion"
          ] || 0
        ) + 1;


      renderInventory();


      showNotification(
        "Health Potion added."
      );

    }
  );


/* =========================================================
   SAVE
   ========================================================= */

$("#saveBtn")
  .addEventListener(
    "click",
    saveProject
  );


function saveProject() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        project
      )
    );


    showNotification(
      "Project saved locally."
    );


  } catch (error) {

    console.error(error);


    showNotification(
      "Could not save project."
    );

  }

}


/* =========================================================
   LOAD
   ========================================================= */

$("#loadBtn")
  .addEventListener(
    "click",
    loadProject
  );


function loadProject() {

  const saved =
    localStorage.getItem(
      STORAGE_KEY
    );


  if (!saved) {

    showNotification(
      "No saved project found."
    );

    return;

  }


  try {

    const loaded =
      JSON.parse(saved);


    if (
      !validateProject(
        loaded
      )
    ) {

      throw new Error(
        "Invalid project."
      );

    }


    project =
      normalizeProject(
        loaded
      );


    selectedNpcId =
      null;


    updateAll();


    showNotification(
      "Project loaded."
    );


  } catch (error) {

    console.error(error);


    showNotification(
      "Could not load project."
    );

  }

}


/* =========================================================
   NEW PROJECT
   ========================================================= */

$("#newProjectBtn")
  .addEventListener(
    "click",
    createNewProject
  );


function createNewProject() {

  const confirmed =
    confirm(
      "Create a new RPG project? Unsaved changes will be lost."
    );


  if (!confirmed) return;


  project =
    deepClone(
      DEFAULT_PROJECT
    );


  createDefaultMap();

  createDefaultNPCs();


  selectedNpcId =
    null;


  enterEditMode();

  updateAll();


  showNotification(
    "New RPG project created."
  );

}


/* =========================================================
   EXPORT
   ========================================================= */

$("#exportBtn")
  .addEventListener(
    "click",
    exportProject
  );


function exportProject() {

  const json =
    JSON.stringify(
      project,
      null,
      2
    );


  const blob =
    new Blob(
      [json],
      {
        type:
          "application/json"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  const filename =
    (
      project.name
        .trim()
        .replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        )
        .toLowerCase()
      ||
      "rpg-project"
    );


  link.href =
    url;

  link.download =
    `${filename}.json`;


  document.body.appendChild(
    link
  );

  link.click();

  link.remove();


  URL.revokeObjectURL(
    url
  );


  showNotification(
    "Project exported."
  );

}


/* =========================================================
   IMPORT
   ========================================================= */

$("#importInput")
  .addEventListener(
    "change",
    event => {

      const file =
        event.target.files[0];


      if (!file) return;


      const reader =
        new FileReader();


      reader.onload =
        result => {

          try {

            const imported =
              JSON.parse(
                result.target.result
              );


            if (
              !validateProject(
                imported
              )
            ) {

              throw new Error(
                "Invalid project."
              );

            }


            project =
              normalizeProject(
                imported
              );


            selectedNpcId =
              null;


            enterEditMode();

            updateAll();


            showNotification(
              "Project imported."
            );


          } catch (error) {

            console.error(error);


            showNotification(
              "Invalid RPG project file."
            );

          }


          event.target.value =
            "";

        };


      reader.readAsText(
        file
      );

    }
  );


/* =========================================================
   PROJECT VALIDATION
   ========================================================= */

function validateProject(
  data
) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    return false;

  }


  if (
    !data.map ||
    !Array.isArray(
      data.map.tiles
    )
  ) {

    return false;

  }


  if (
    !data.player ||
    typeof data.player !==
    "object"
  ) {

    return false;

  }


  return true;

}


/* =========================================================
   NORMALIZE PROJECT
   ========================================================= */

function normalizeProject(
  data
) {

  const normalized =
    deepClone(
      data
    );


  normalized.version =
    1;


  normalized.name =
    String(
      normalized.name ||
      "My RPG"
    );


  normalized.map.width =
    clamp(
      Number(
        normalized.map.width
      ) || 16,
      MIN_MAP_WIDTH,
      MAX_MAP_WIDTH
    );


  normalized.map.height =
    clamp(
      Number(
        normalized.map.height
      ) || 12,
      MIN_MAP_HEIGHT,
      MAX_MAP_HEIGHT
    );


  /*
   * Guarantee correct
   * tile matrix.
   */

  const oldTiles =
    normalized.map.tiles;


  normalized.map.tiles =
    [];


  for (
    let y = 0;
    y < normalized.map.height;
    y++
  ) {

    const row = [];


    for (
      let x = 0;
      x < normalized.map.width;
      x++
    ) {

      const value =
        oldTiles[y]?.[x];


      const validTiles = [
        "grass",
        "water",
        "sand",
        "stone",
        "wall",
        "tree"
      ];


      row.push(
        validTiles.includes(value)
          ? value
          : "grass"
      );

    }


    normalized.map.tiles.push(
      row
    );

  }


  normalized.npcs =
    Array.isArray(
      normalized.npcs
    )
      ? normalized.npcs
      : [];


  normalized.npcs =
    normalized.npcs.filter(
      npc =>
        Number.isInteger(
          npc.x
        ) &&
        Number.isInteger(
          npc.y
        ) &&
        npc.x >= 0 &&
        npc.y >= 0 &&
        npc.x <
          normalized.map.width &&
        npc.y <
          normalized.map.height
    );


  normalized.inventory =
    normalized.inventory &&
    typeof normalized.inventory ===
      "object"
      ? normalized.inventory
      : {
          "Health Potion": 3
        };


  normalized.player.maxHp =
    Number(
      normalized.player.maxHp
    ) || 100;


  normalized.player.hp =
    clamp(
      Number(
        normalized.player.hp
      ) || normalized.player.maxHp,
      0,
      normalized.player.maxHp
    );


  normalized.player.attack =
    Number(
      normalized.player.attack
    ) || 12;


  normalized.player.gold =
    Math.max(
      0,
      Number(
        normalized.player.gold
      ) || 0
    );


  normalized.player.x =
    clamp(
      Number(
        normalized.player.x
      ) || 0,
      0,
      normalized.map.width - 1
    );


  normalized.player.y =
    clamp(
      Number(
        normalized.player.y
      ) || 0,
      0,
      normalized.map.height - 1
    );


  return normalized;

}


/* =========================================================
   UI UPDATE
   ========================================================= */

function updateUI() {

  $("#projectTitle")
    .textContent =
    project.name;


  projectName.value =
    project.name;


  mapWidth.value =
    project.map.width;


  mapHeight.value =
    project.map.height;


  $("#playerHp")
    .textContent =
    `${project.player.hp} / ${project.player.maxHp}`;


  $("#playerAttack")
    .textContent =
    project.player.attack;


  $("#playerGold")
    .textContent =
    project.player.gold;


  renderInventory();

  updateEngineInfo();

}


/* =========================================================
   ENGINE INFO
   ========================================================= */

function updateEngineInfo() {

  $("#mapInfo")
    .textContent =
    `${project.map.width} × ${project.map.height}`;


  $("#npcCount")
    .textContent =
    project.npcs.length;


  $("#tileInfo")
    .textContent =
    `${zoom}px`;

}


/* =========================================================
   FULL UPDATE
   ========================================================= */

function updateAll() {

  updateNpcEditor();

  updateUI();

  renderMap();

}


/* =========================================================
   NOTIFICATION
   ========================================================= */

function showNotification(
  message
) {

  notification.textContent =
    message;


  notification.classList.add(
    "show"
  );


  clearTimeout(
    notificationTimer
  );


  notificationTimer =
    setTimeout(
      () => {

        notification.classList.remove(
          "show"
        );

      },
      2300
    );

}


/* =========================================================
   MOUSE BUTTON SAFETY
   ========================================================= */

document.addEventListener(
  "dragstart",
  event => {

    if (
      event.target.closest(
        ".map-tile"
      )
    ) {

      event.preventDefault();

    }

  }
);


/* =========================================================
   INITIAL DEFAULT STATE
   ========================================================= */

$("#tileInfo")
  .textContent =
  `${zoom}px`;