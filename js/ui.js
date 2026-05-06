// UI: screens, dialog, hud, menus, character creator, combat overlay.
(function (global) {
  const $ = (id) => document.getElementById(id);

  // ----- Title screen -----
  function showTitle() {
    hideAll();
    $('title').classList.remove('hidden');
  }

  function hideAll() {
    ['title','creator','menu','combat','help'].forEach(id => $(id).classList.add('hidden'));
    closeDialog();
  }

  // ----- Character creator -----
  const SKINS = ['#f0c896','#e6b08a','#c98a5a','#8a5a35','#5e3a1c','#f3d4b6','#3b2415'];
  const HAIRS = ['#3a2418','#7a4f1c','#e0b95c','#a02020','#3a3a3a','#fff6c5','#7045b8','#1a1a1a','#ff8a3a'];
  const SHIRTS = ['#3a6dc1','#c1453a','#3aa657','#c1a13a','#7a3aa6','#3a6e6e','#a04a3a','#5b6dc1'];
  const PANTS = ['#2a2a3a','#4a3a2a','#3a2a2a','#2a3a4a','#3a4a2a','#1a1a1a'];
  const BOOTS = ['#1a1410','#3a2418','#5a3a26','#1a1a1a','#5e3020','#2a2a3a','#7a4f1c'];
  const HAIR_STYLE_LIST = ['short','long','spiky','ponytail','bald'];

  const CLASS_STATS = {
    warrior: { hp: 28, mp: 6,  atk: 6, def: 4, mag: 2, spd: 3 },
    mage:    { hp: 18, mp: 14, atk: 3, def: 2, mag: 7, spd: 4 },
    rogue:   { hp: 22, mp: 8,  atk: 5, def: 2, mag: 3, spd: 6 },
  };

  let creatorState = null;
  let _previewAnim = null;
  let _previewFrame = 0;
  let _previewDir = 'down';
  let _previewDirTimer = 0;
  const PREVIEW_DIRS = ['down','right','up','left'];

  function showCreator(onCreate) {
    hideAll();
    $('creator').classList.remove('hidden');
    creatorState = {
      name: 'Hero',
      class: 'warrior',
      hairStyle: 'short',
      skin: SKINS[0],
      hair: HAIRS[0],
      shirt: SHIRTS[0],
      pants: PANTS[0],
      boots: BOOTS[0],
    };
    $('cc-name').value = creatorState.name;
    $('cc-class').value = creatorState.class;
    $('cc-hairstyle').value = creatorState.hairStyle;
    buildSwatches('cc-skin', SKINS, 'skin');
    buildSwatches('cc-hair', HAIRS, 'hair');
    buildSwatches('cc-shirt', SHIRTS, 'shirt');
    buildSwatches('cc-pants', PANTS, 'pants');
    buildSwatches('cc-boots', BOOTS, 'boots');
    updateStatPreview();
    startPreviewAnimation();

    $('cc-name').oninput = () => { creatorState.name = $('cc-name').value || 'Hero'; };
    $('cc-class').onchange = () => { creatorState.class = $('cc-class').value; updateStatPreview(); };
    $('cc-hairstyle').onchange = () => { creatorState.hairStyle = $('cc-hairstyle').value; };
    $('cc-back').onclick = () => { stopPreviewAnimation(); showTitle(); };
    $('cc-start').onclick = () => { stopPreviewAnimation(); onCreate(creatorState); };
    $('cc-random').onclick = () => randomizeCreator();
  }

  function randomizeCreator() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    creatorState.class = pick(['warrior','mage','rogue']);
    creatorState.hairStyle = pick(HAIR_STYLE_LIST);
    creatorState.skin = pick(SKINS);
    creatorState.hair = pick(HAIRS);
    creatorState.shirt = pick(SHIRTS);
    creatorState.pants = pick(PANTS);
    creatorState.boots = pick(BOOTS);
    $('cc-class').value = creatorState.class;
    $('cc-hairstyle').value = creatorState.hairStyle;
    buildSwatches('cc-skin', SKINS, 'skin');
    buildSwatches('cc-hair', HAIRS, 'hair');
    buildSwatches('cc-shirt', SHIRTS, 'shirt');
    buildSwatches('cc-pants', PANTS, 'pants');
    buildSwatches('cc-boots', BOOTS, 'boots');
    updateStatPreview();
  }

  function updateStatPreview() {
    const s = CLASS_STATS[creatorState.class] || CLASS_STATS.warrior;
    $('cc-stats').innerHTML =
      '<div class="cc-stat-title">' + creatorState.class.toUpperCase() + '</div>' +
      '<div class="cc-stat-row"><span class="stat-hp">HP ' + s.hp + '</span><span class="stat-mp">MP ' + s.mp + '</span></div>' +
      '<div class="cc-stat-row"><span>ATK ' + s.atk + '</span><span>DEF ' + s.def + '</span></div>' +
      '<div class="cc-stat-row"><span>MAG ' + s.mag + '</span><span>SPD ' + s.spd + '</span></div>';
  }

  function startPreviewAnimation() {
    _previewFrame = 0;
    _previewDirTimer = 0;
    _previewDir = 'down';
    if (_previewAnim) clearInterval(_previewAnim);
    _previewAnim = setInterval(() => {
      _previewFrame = (_previewFrame + 1) % 4;
      _previewDirTimer++;
      if (_previewDirTimer >= 8) {
        _previewDirTimer = 0;
        const idx = PREVIEW_DIRS.indexOf(_previewDir);
        _previewDir = PREVIEW_DIRS[(idx + 1) % PREVIEW_DIRS.length];
      }
      redrawPreview();
    }, 180);
    redrawPreview();
  }

  function stopPreviewAnimation() {
    if (_previewAnim) { clearInterval(_previewAnim); _previewAnim = null; }
  }

  function buildSwatches(elId, colors, key) {
    const wrap = $(elId);
    wrap.innerHTML = '';
    colors.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'swatch' + (creatorState[key] === c ? ' active' : '');
      el.style.background = c;
      el.onclick = () => {
        creatorState[key] = c;
        Array.from(wrap.children).forEach(ch => ch.classList.remove('active'));
        el.classList.add('active');
        redrawPreview();
      };
      wrap.appendChild(el);
    });
  }

  function redrawPreview() {
    const c = $('char-preview');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle = '#1d2233';
    ctx.fillRect(0,0,c.width,c.height);
    for (let i=0;i<c.height;i+=4) {
      ctx.fillStyle = i%8===0 ? '#222a44' : '#1d2233';
      ctx.fillRect(0,i,c.width,2);
    }
    const off = document.createElement('canvas');
    off.width = 16; off.height = 16;
    const octx = off.getContext('2d');
    Sprites.drawChar(octx, 0, 0, {
      dir: _previewDir, frame: _previewFrame,
      hairStyle: creatorState.hairStyle,
      skin: creatorState.skin,
      hair: creatorState.hair,
      shirt: creatorState.shirt,
      pants: creatorState.pants,
      boots: creatorState.boots,
    });
    ctx.drawImage(off, (c.width-96)/2, 16, 96, 96);
  }

  // ----- Dialog -----
  let dialogQueue = [];
  let dialogActive = false;
  let onDialogEnd = null;
  function openDialog(name, lines, onEnd) {
    dialogQueue = lines.slice();
    dialogActive = true;
    onDialogEnd = onEnd;
    $('dialog-name').textContent = name || '';
    $('dialog').classList.remove('hidden');
    advanceDialog();
  }
  function advanceDialog() {
    if (dialogQueue.length === 0) {
      closeDialog();
      if (onDialogEnd) onDialogEnd();
      return;
    }
    $('dialog-text').textContent = dialogQueue.shift();
  }
  function closeDialog() {
    dialogActive = false;
    $('dialog').classList.add('hidden');
  }
  function isDialogActive() { return dialogActive; }

  // ----- HUD -----
  function updateHUD(p) {
    if (!p) return;
    $('hud-name').textContent = p.name;
    $('hud-class').textContent = p.cls;
    $('hud-lvl').textContent = 'Lv ' + p.level;
    $('hud-gold').textContent = p.gold + 'g';
    setBar('hp', p.hp, p.maxhp);
    setBar('mp', p.mp, p.maxmp);
    setBar('xp', p.xp, Combat.xpNeeded(p.level));
  }
  function setBar(k, val, max) {
    const pct = Math.max(0, Math.min(100, (val / max) * 100));
    $(k + '-bar').style.width = pct + '%';
    $(k + '-text').textContent = Math.max(0, Math.floor(val)) + '/' + max;
  }

  // ----- Quest toast -----
  let toastTimer = null;
  function toast(msg) {
    const el = $('quest-toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
  }

  // ----- Pause menu -----
  function openMenu(player) {
    hideAllOverlays();
    $('menu').classList.remove('hidden');
    const stats = $('menu-stats');
    stats.innerHTML = `
      <div><b>${player.name}</b> — ${player.cls}</div>
      <div>Level ${player.level} (XP ${player.xp}/${Combat.xpNeeded(player.level)})</div>
      <div>HP ${Math.floor(player.hp)}/${player.maxhp} · MP ${Math.floor(player.mp)}/${player.maxmp}</div>
      <div>ATK ${player.stats.atk} · DEF ${player.stats.def} · MAG ${player.stats.mag} · SPD ${player.stats.spd}</div>
      <div>Gold: ${player.gold}</div>
    `;
    const ql = $('menu-quests');
    ql.innerHTML = '';
    const active = Object.entries(player.quests.active);
    if (active.length === 0) {
      ql.innerHTML = '<li><em>No active quests.</em></li>';
    } else {
      active.forEach(([id, p]) => {
        const q = Quests.QUESTS[id];
        let prog = '';
        if (q.goal.kill) prog = ` (${p.progress||0}/${q.goal.count})`;
        const li = document.createElement('li');
        li.innerHTML = `<b>${q.title}</b>${prog}<br><small>${q.desc}</small>`;
        ql.appendChild(li);
      });
    }
    Object.keys(player.quests.complete).forEach(id => {
      const q = Quests.QUESTS[id];
      if (!q) return;
      const li = document.createElement('li');
      li.className = 'done';
      li.innerHTML = `<b>${q.title}</b><br><small>Complete</small>`;
      ql.appendChild(li);
    });
    const inv = $('menu-inventory');
    inv.innerHTML = '';
    if (!player.inventory.length) inv.innerHTML = '<li><em>Empty.</em></li>';
    player.inventory.forEach(it => {
      const li = document.createElement('li');
      li.textContent = '• ' + it;
      inv.appendChild(li);
    });
  }
  function closeMenu() { $('menu').classList.add('hidden'); }

  // ----- Combat overlay -----
  function openCombat(state) {
    hideAllOverlays();
    $('combat').classList.remove('hidden');
    renderCombat(state);
    startCombatAnimation(state);
  }
  function closeCombat() { stopCombatAnimation(); $('combat').classList.add('hidden'); }
  let _combatAnimFrame = 0;
  let _combatAnimId = null;
  let _combatPlayerFlash = 0;
  let _combatEnemyFlash = 0;

  function drawCombatActors(state) {
    const pc = $('combat-player');
    const pctx = pc.getContext('2d');
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0,0,pc.width,pc.height);

    const pFrame = Math.floor(_combatAnimFrame / 2) % 4;
    const off1 = document.createElement('canvas');
    off1.width = 16; off1.height = 16;
    Sprites.drawChar(off1.getContext('2d'), 0, 0, {
      dir: 'right', frame: pFrame,
      hairStyle: state.player.hairStyle || 'short',
      skin: state.player.skin, hair: state.player.hair,
      shirt: state.player.shirt, pants: state.player.pants,
      boots: state.player.boots,
    });
    const pShake = _combatPlayerFlash > 0 ? (Math.random() * 4 - 2) : 0;
    pctx.drawImage(off1, pShake, 0, 64, 64);

    if (_combatPlayerFlash > 0) {
      pctx.fillStyle = 'rgba(255,100,100,0.35)';
      pctx.fillRect(0, 0, pc.width, pc.height);
    }

    const ec = $('combat-enemy');
    const ectx = ec.getContext('2d');
    ectx.imageSmoothingEnabled = false;
    ectx.clearRect(0,0,ec.width,ec.height);
    const off2 = document.createElement('canvas');
    off2.width = 16; off2.height = 16;
    Sprites.drawEnemy(off2.getContext('2d'), 0, 0, state.enemy.kind);
    const eBob = Math.sin(_combatAnimFrame * 0.15) * 2;
    const eShake = _combatEnemyFlash > 0 ? (Math.random() * 4 - 2) : 0;
    ectx.drawImage(off2, eShake, eBob, 64, 64);

    if (_combatEnemyFlash > 0) {
      ectx.fillStyle = 'rgba(255,255,255,0.4)';
      ectx.fillRect(0, 0, ec.width, ec.height);
    }
  }

  function startCombatAnimation(state) {
    _combatAnimFrame = 0;
    if (_combatAnimId) cancelAnimationFrame(_combatAnimId);
    function tick() {
      _combatAnimFrame++;
      if (_combatPlayerFlash > 0) _combatPlayerFlash--;
      if (_combatEnemyFlash > 0) _combatEnemyFlash--;
      drawCombatActors(state);
      _combatAnimId = requestAnimationFrame(tick);
    }
    _combatAnimId = requestAnimationFrame(tick);
  }

  function stopCombatAnimation() {
    if (_combatAnimId) { cancelAnimationFrame(_combatAnimId); _combatAnimId = null; }
  }

  function flashCombatPlayer() { _combatPlayerFlash = 8; }
  function flashCombatEnemy() { _combatEnemyFlash = 8; }
  function renderCombat(state) {
    if (!state) return;
    const p = state.player;
    const e = state.enemy;
    $('cp-name').textContent = p.name + ' (Lv ' + p.level + ')';
    $('ce-name').textContent = e.name;
    $('cp-hp').style.width = Math.max(0, p.hp/p.maxhp*100) + '%';
    $('cp-mp').style.width = Math.max(0, p.mp/p.maxmp*100) + '%';
    $('ce-hp').style.width = Math.max(0, e.hp/e.maxhp*100) + '%';
    const log = $('combat-log');
    log.innerHTML = state.log.map(l => `<div class="${l.cls}">${l.text}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  function hideAllOverlays() {
    ['title','creator','menu','help','combat'].forEach(id => $(id).classList.add('hidden'));
  }

  global.UI = {
    showTitle, hideAll, hideAllOverlays,
    showCreator,
    openDialog, advanceDialog, closeDialog, isDialogActive,
    updateHUD, toast,
    openMenu, closeMenu,
    openCombat, closeCombat, renderCombat, drawCombatActors,
    flashCombatPlayer, flashCombatEnemy,
    showHelp: () => { hideAllOverlays(); $('help').classList.remove('hidden'); },
    hideHelp: () => $('help').classList.add('hidden'),
  };
})(window);
