// Main game module - boot, loop, rendering, world interaction.
(function () {
  const TILE = Sprites.TILE;
  const VIEW_W = 320, VIEW_H = 240;
  const VIEW_TILES_X = VIEW_W / TILE;
  const VIEW_TILES_Y = VIEW_H / TILE;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---- Map cache (pre-rendered base + deco) ----
  const mapCache = {};
  function getMapCanvas(map) {
    if (mapCache[map.id]) return mapCache[map.id];
    const c = document.createElement('canvas');
    c.width = map.cols * TILE;
    c.height = map.rows * TILE;
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    // Base tiles
    for (let r = 0; r < map.rows; r++) {
      for (let cc = 0; cc < map.cols; cc++) {
        Sprites.drawTile(cctx, map.tiles[r][cc], cc * TILE, r * TILE);
      }
    }
    // Decoration overlay
    for (let r = 0; r < map.rows; r++) {
      for (let cc = 0; cc < map.cols; cc++) {
        const sym = map.deco[r] && map.deco[r][cc];
        if (!sym) continue;
        Sprites.drawDeco(cctx, sym, cc * TILE, r * TILE);
      }
    }
    // Houses
    if (map.houses && map.houses.length) {
      for (const h of map.houses) {
        Sprites.drawHouse(cctx, h.x, h.y);
      }
    }
    // Static objects (signs, chests, sign-posts)
    for (const obj of map.objects) {
      if (obj.type === 'sign') {
        Sprites.drawDeco(cctx, 'sign', obj.x * TILE, obj.y * TILE);
      } else if (obj.type === 'chest' && !obj._opened) {
        Sprites.drawDeco(cctx, 'chest', obj.x * TILE, obj.y * TILE);
      }
    }
    mapCache[map.id] = c;
    return c;
  }
  function invalidateMap(id) { delete mapCache[id]; }

  // ---- Player ----
  function createPlayer(opts) {
    const cls = opts.class || 'warrior';
    const base = {
      warrior: { hp: 28, mp: 6,  atk: 6, def: 4, mag: 2, spd: 3 },
      mage:    { hp: 18, mp: 14, atk: 3, def: 2, mag: 7, spd: 4 },
      rogue:   { hp: 22, mp: 8,  atk: 5, def: 2, mag: 3, spd: 6 },
    }[cls];
    return {
      name: opts.name || 'Hero',
      cls,
      skin: opts.skin, hair: opts.hair, shirt: opts.shirt, pants: opts.pants,
      x: 16 * TILE, y: 10 * TILE, // pixel position (top-left of 16x16 sprite)
      dir: 'down', frame: 0, walkAnim: 0,
      level: 1,
      xp: 0,
      gold: 0,
      hp: base.hp, maxhp: base.hp,
      mp: base.mp, maxmp: base.mp,
      stats: { atk: base.atk, def: base.def, mag: base.mag, spd: base.spd },
      inventory: [],
      quests: Quests.newQuestLog(),
      mapId: 'overworld',
      flags: {}, // arbitrary flags (e.g., for unlocking dungeon2)
      _returnTo: null,
    };
  }

  // ---- Game state ----
  const G = {
    player: null,
    map: null,
    paused: false,
    interactCooldown: 0,
    npcs: [],          // dynamic NPC instances (just for animation)
    enemies: [],       // dynamic enemies (entities)
    chests: [],        // dynamic chest entities
    portals: [],       // doors / area transitions
    healer: null,
    encounterTimer: 1.5,
    lastTime: 0,
    cameraX: 0, cameraY: 0,
  };

  // ---- Boot ----
  document.getElementById('btn-new').onclick = () => UI.showCreator((opts) => beginGame(opts));
  document.getElementById('btn-continue').onclick = () => loadGame();
  document.getElementById('btn-help').onclick = () => UI.showHelp();
  document.getElementById('help-back').onclick = () => UI.showTitle();

  document.getElementById('menu-resume').onclick = () => { UI.closeMenu(); G.paused = false; };
  document.getElementById('menu-save').onclick = () => { saveGame(); UI.toast('Game saved.'); };
  document.getElementById('menu-quit').onclick = () => { saveGame(); G.paused = false; G.player = null; UI.hideAllOverlays(); UI.showTitle(); };

  document.querySelectorAll('#combat .combat-actions button').forEach(btn => {
    btn.onclick = () => Combat.playerAction(btn.dataset.act);
  });

  UI.showTitle();

  function beginGame(opts) {
    G.player = createPlayer(opts);
    Quests.startQuest(G.player, 'qBoss');
    loadMap('overworld');
    UI.hideAll();
    UI.updateHUD(G.player);
    UI.toast('Adventure begins!');
    startLoop();
  }

  let _loopStarted = false;
  function startLoop() {
    if (_loopStarted) return;
    _loopStarted = true;
    requestAnimationFrame(loop);
  }

  function loadMap(id, tx, ty) {
    const map = Maps[id];
    if (!map) { console.warn('No map', id); return; }
    G.map = map;
    G.player.mapId = id;
    if (typeof tx === 'number' && typeof ty === 'number') {
      G.player.x = tx * TILE;
      G.player.y = ty * TILE;
    }
    // Build dynamic objects from map
    G.npcs = [];
    G.enemies = [];
    G.chests = [];
    G.portals = [];
    G.healer = null;
    for (const obj of map.objects) {
      if (obj.type === 'npc') {
        G.npcs.push({ ...obj });
      } else if (obj.type === 'enemy') {
        // Skip if previously defeated (track via player.flags)
        const key = id + ':' + obj.x + ',' + obj.y;
        if (G.player.flags['defeated:' + key]) continue;
        G.enemies.push({ ...obj, _key: key });
      } else if (obj.type === 'chest') {
        const key = id + ':' + obj.x + ',' + obj.y;
        const opened = !!G.player.flags['chest:' + key];
        G.chests.push({ ...obj, _key: key, _opened: opened });
      } else if (obj.type === 'portal' || obj.type === 'door') {
        G.portals.push({ ...obj });
      } else if (obj.type === 'sign') {
        G.portals.push({ ...obj }); // signs handled in interact path; reused for tile lookup
      } else if (obj.type === 'healer') {
        G.healer = { ...obj };
      }
    }
    invalidateMap(id);
  }

  // ---- Collision ----
  function isSolid(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return true;
    return !!(map.solid[ty] && map.solid[ty][tx]);
  }

  function tilesAtRect(x, y, w, h) {
    const t = [];
    const x0 = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) t.push([tx, ty]);
    return t;
  }

  function tryMove(p, dx, dy) {
    // Smaller hitbox: 10 wide x 6 tall, anchored at the feet of the 16x16 sprite
    const HBX = 3, HBY = 9;
    const HBW = 10, HBH = 6;
    const nx = p.x + dx;
    const ny = p.y + dy;
    // X axis
    let testX = nx + HBX;
    let testY = p.y + HBY;
    let blocked = false;
    for (const [tx, ty] of tilesAtRect(testX, testY, HBW, HBH)) {
      if (isSolid(G.map, tx, ty)) { blocked = true; break; }
      // Solid entities
      if (entityAt(tx, ty, true)) { blocked = true; break; }
    }
    if (!blocked) p.x = nx;

    testX = p.x + HBX;
    testY = ny + HBY;
    blocked = false;
    for (const [tx, ty] of tilesAtRect(testX, testY, HBW, HBH)) {
      if (isSolid(G.map, tx, ty)) { blocked = true; break; }
      if (entityAt(tx, ty, true)) { blocked = true; break; }
    }
    if (!blocked) p.y = ny;
  }

  function entityAt(tx, ty, solidOnly) {
    for (const n of G.npcs) if (n.x === tx && n.y === ty) return n;
    for (const c of G.chests) if (c.x === tx && c.y === ty && !c._opened) return c;
    return null;
  }

  function nearestInteractable() {
    const p = G.player;
    const px = Math.floor((p.x + 8) / TILE);
    const py = Math.floor((p.y + 12) / TILE);
    // Direction-based facing tile
    const facings = {
      down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0],
    };
    const [dx, dy] = facings[p.dir] || [0, 1];
    const fx = px + dx, fy = py + dy;
    const tries = [[fx, fy], [px, py]];
    for (const [tx, ty] of tries) {
      // NPC
      for (const n of G.npcs) if (n.x === tx && n.y === ty) return { kind: 'npc', obj: n };
      // Enemy (touching enemy triggers combat already)
      for (const e of G.enemies) if (e.x === tx && e.y === ty) return { kind: 'enemy', obj: e };
      // Chest
      for (const c of G.chests) if (c.x === tx && c.y === ty && !c._opened) return { kind: 'chest', obj: c };
      // Portal/door/sign
      for (const o of G.portals) if (o.x === tx && o.y === ty) return { kind: o.type, obj: o };
      // Healer
      if (G.healer && G.healer.x === tx && G.healer.y === ty) return { kind: 'healer', obj: G.healer };
    }
    return null;
  }

  function interact() {
    const tgt = nearestInteractable();
    if (!tgt) return;
    if (tgt.kind === 'npc') {
      const n = tgt.obj;
      UI.openDialog(n.name, n.dialog, () => {
        if (n.questId) {
          if (n.questId === 'q5_complete') {
            Quests.trackEvent(G.player, 'q5_complete');
            const done = Quests.checkComplete(G.player);
            done.forEach(applyQuestReward);
          } else {
            const started = Quests.startQuest(G.player, n.questId);
            if (started) UI.toast('New Quest: ' + Quests.QUESTS[n.questId].title);
          }
          UI.updateHUD(G.player);
        }
      });
    } else if (tgt.kind === 'sign') {
      UI.openDialog('Sign', [tgt.obj.text]);
    } else if (tgt.kind === 'chest') {
      const c = tgt.obj;
      c._opened = true;
      G.player.flags['chest:' + c._key] = true;
      const lines = [];
      if (c.item) {
        G.player.inventory.push(c.item);
        lines.push('You found a ' + c.item + '!');
        Quests.trackCollect(G.player, c.item);
      }
      if (c.gold) {
        G.player.gold += c.gold;
        lines.push('You picked up ' + c.gold + ' gold.');
      }
      UI.openDialog('Chest', lines, () => {
        const done = Quests.checkComplete(G.player);
        done.forEach(applyQuestReward);
        UI.updateHUD(G.player);
      });
      invalidateMap(G.map.id);
    } else if (tgt.kind === 'portal' || tgt.kind === 'door') {
      interactPortal(tgt.obj);
    } else if (tgt.kind === 'healer') {
      const free = !G.player.flags['heal:firstFree'];
      const cost = free ? 0 : 5;
      if (G.player.gold < cost) {
        UI.openDialog('Healer Mira', ['You need 5 gold to be healed.']);
        return;
      }
      G.player.gold -= cost;
      G.player.hp = G.player.maxhp;
      G.player.mp = G.player.maxmp;
      G.player.flags['heal:firstFree'] = true;
      UI.openDialog('Healer Mira', [free ? 'On the house, dear.' : 'Five gold, please.', 'You are fully healed!']);
      UI.updateHUD(G.player);
    } else if (tgt.kind === 'enemy') {
      startCombatWith(tgt.obj);
    }
  }

  function interactPortal(o) {
    if (o.gated && !G.player.flags['unlock:' + o.target]) {
      UI.openDialog('Locked', ['A magical seal blocks the entrance.', 'Complete the Mayor\'s quest to break the seal.']);
      return;
    }
    if (o.useReturn && G.player._returnTo) {
      const ret = G.player._returnTo;
      G.player._returnTo = null;
      loadMap(ret.id, ret.tx, ret.ty);
    } else {
      if (Maps[o.target] && o.target.startsWith('house_')) {
        G.player._returnTo = { id: G.map.id, tx: o.x, ty: o.y + 1 };
      }
      loadMap(o.target, o.tx, o.ty);
    }
    G.interactCooldown = 0.6;
    UI.toast(o.text || 'You enter a new place.');
  }

  function startCombatWith(enemy) {
    const isBoss = !!enemy.boss;
    Combat.start(G.player, enemy.kind, {
      boss: isBoss,
      onWin: () => {
        // Mark this enemy defeated so it doesn't respawn
        G.player.flags['defeated:' + enemy._key] = true;
        G.enemies = G.enemies.filter(e => e._key !== enemy._key);
        // Quest completion handled by combat.grantRewards via Quests.trackKill
        const done = Quests.checkComplete(G.player);
        done.forEach(applyQuestReward);
        UI.updateHUD(G.player);
      },
      onLose: () => {
        // Respawn at village; lose half gold
        G.player.gold = Math.floor(G.player.gold / 2);
        G.player.hp = G.player.maxhp;
        G.player.mp = G.player.maxmp;
        loadMap('village', 12, 13);
        UI.toast('You collapsed... awoke in the village.');
        UI.updateHUD(G.player);
      },
      onFlee: () => {
        // Push player back one tile
        const back = { down: [0, -1], up: [0, 1], left: [1, 0], right: [-1, 0] }[G.player.dir];
        if (back) { G.player.x += back[0] * TILE; G.player.y += back[1] * TILE; }
      },
    });
  }

  function applyQuestReward(q) {
    UI.openDialog(q.giver || 'Quest', [q.complete || 'Quest complete!', q.title + ' completed!']);
    if (q.reward) {
      if (q.reward.xp) G.player.xp += q.reward.xp;
      if (q.reward.gold) G.player.gold += q.reward.gold;
      if (q.reward.item) G.player.inventory.push(q.reward.item);
    }
    if (q.unlocks) {
      G.player.flags['unlock:' + q.unlocks] = true;
      UI.toast('Unlocked: ' + q.unlocks);
    }
    UI.toast('Quest Complete: ' + q.title);
  }

  // ---- Saving ----
  function saveGame() {
    if (!G.player) return;
    localStorage.setItem('pixelrealm_save', JSON.stringify({
      player: G.player,
      v: 1,
    }));
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem('pixelrealm_save');
      if (!raw) { UI.toast('No save found'); return; }
      const data = JSON.parse(raw);
      G.player = data.player;
      // ensure quests exist in case schema changed
      if (!G.player.quests) G.player.quests = Quests.newQuestLog();
      loadMap(G.player.mapId || 'overworld');
      UI.hideAll();
      UI.updateHUD(G.player);
      UI.toast('Welcome back, ' + G.player.name);
      startLoop();
    } catch (e) {
      console.error(e);
      UI.toast('Save corrupt');
    }
  }

  // ---- Loop ----
  function loop(t) {
    const dt = Math.min(0.05, (t - G.lastTime) / 1000 || 0);
    G.lastTime = t;
    if (G.player) {
      update(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (Combat.isActive()) return;

    // Tab toggles menu
    if (Input.consumePressed('menu')) {
      if (G.paused) { UI.closeMenu(); G.paused = false; }
      else { UI.openMenu(G.player); G.paused = true; }
    }
    if (G.paused) return;

    if (UI.isDialogActive()) {
      if (Input.consumePressed('interact')) UI.advanceDialog();
      return;
    }

    // Movement
    const p = G.player;
    const speed = (50 + p.stats.spd * 4); // pixels/sec
    let mvx = 0, mvy = 0;
    if (Input.isDown('up')) { mvy -= 1; p.dir = 'up'; }
    else if (Input.isDown('down')) { mvy += 1; p.dir = 'down'; }
    if (Input.isDown('left')) { mvx -= 1; p.dir = 'left'; }
    else if (Input.isDown('right')) { mvx += 1; p.dir = 'right'; }

    if (mvx || mvy) {
      const len = Math.hypot(mvx, mvy) || 1;
      tryMove(p, mvx / len * speed * dt, mvy / len * speed * dt);
      p.walkAnim += dt * 8;
      p.frame = Math.floor(p.walkAnim) % 2;
    } else {
      p.walkAnim = 0;
      p.frame = 0;
    }

    // Interaction key
    if (Input.consumePressed('interact')) {
      interact();
    }

    // Auto-encounter: bumping into enemies starts combat
    const px = Math.floor((p.x + 8) / TILE);
    const py = Math.floor((p.y + 12) / TILE);
    for (const e of G.enemies) {
      if (e.x === px && e.y === py) {
        startCombatWith(e);
        return;
      }
    }

    // Auto-step portals: stepping onto a portal tile (not house doors)
    // triggers it after a short cooldown.
    if (G.interactCooldown > 0) {
      G.interactCooldown -= dt;
    } else {
      for (const o of G.portals) {
        if (o.type !== 'portal') continue; // doors require pressing E
        if (o.x === px && o.y === py) {
          G.interactCooldown = 0.6;
          interactPortal(o);
          return;
        }
      }
    }

    // Camera follows player
    G.cameraX = Math.max(0, Math.min(G.map.cols * TILE - VIEW_W, p.x - VIEW_W / 2));
    G.cameraY = Math.max(0, Math.min(G.map.rows * TILE - VIEW_H, p.y - VIEW_H / 2));

    UI.updateHUD(G.player);
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const mapImg = getMapCanvas(G.map);
    ctx.drawImage(mapImg, -G.cameraX, -G.cameraY);

    // Render dynamic entities
    // Sort by y to fake depth
    const ents = [];
    for (const n of G.npcs) ents.push({ kind: 'npc', x: n.x * TILE, y: n.y * TILE, obj: n });
    for (const e of G.enemies) ents.push({ kind: 'enemy', x: e.x * TILE, y: e.y * TILE, obj: e });
    ents.push({ kind: 'player', x: G.player.x, y: G.player.y, obj: G.player });
    ents.sort((a, b) => a.y - b.y);

    for (const ent of ents) {
      const drawX = ent.x - G.cameraX;
      const drawY = ent.y - G.cameraY;
      if (drawX < -16 || drawY < -16 || drawX > VIEW_W || drawY > VIEW_H) continue;
      if (ent.kind === 'player') {
        const p = ent.obj;
        Sprites.drawChar(ctx, drawX, drawY, {
          dir: p.dir, frame: p.frame,
          skin: p.skin, hair: p.hair, shirt: p.shirt, pants: p.pants,
        });
      } else if (ent.kind === 'npc') {
        // simple NPC: random color appearance derived from name
        const seed = ent.obj.name.charCodeAt(0) || 1;
        Sprites.drawChar(ctx, drawX, drawY, {
          dir: 'down', frame: 0,
          skin: '#f0c896',
          hair: ['#3a2418', '#a02020', '#e0b95c', '#6045b8'][seed % 4],
          shirt: ['#3a6dc1', '#3aa657', '#c1453a', '#7a3aa6'][seed % 4],
          pants: '#2a2a3a',
        });
      } else if (ent.kind === 'enemy') {
        Sprites.drawEnemy(ctx, drawX, drawY, ent.obj.kind);
      }
    }

    // Interactable hint
    const tgt = nearestInteractable();
    if (tgt) {
      let hintTxt = '';
      if (tgt.kind === 'npc') hintTxt = 'Talk to ' + tgt.obj.name;
      else if (tgt.kind === 'sign') hintTxt = 'Read sign';
      else if (tgt.kind === 'chest') hintTxt = 'Open chest';
      else if (tgt.kind === 'portal' || tgt.kind === 'door') hintTxt = tgt.obj.text || 'Enter';
      else if (tgt.kind === 'healer') hintTxt = 'Heal up';
      else if (tgt.kind === 'enemy') hintTxt = 'Fight!';
      if (hintTxt) {
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        const w = ctx.measureText(hintTxt).width + 16;
        ctx.fillRect(VIEW_W/2 - w/2, VIEW_H - 28, w, 18);
        ctx.fillStyle = '#ffce5c';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[E] ' + hintTxt, VIEW_W/2, VIEW_H - 14);
      }
    }
  }
})();
