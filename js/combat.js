// Turn-based combat system.
(function (global) {
  let state = null;
  let onEnd = null;

  function start(player, enemyKind, options = {}) {
    const enemyData = Sprites.enemies[enemyKind];
    if (!enemyData) return;
    const enemy = {
      kind: enemyKind,
      name: enemyData.name,
      maxhp: enemyData.hp,
      hp: enemyData.hp,
      atk: enemyData.atk,
      def: enemyData.def,
      xp: enemyData.xp,
      gold: enemyData.gold,
      isBoss: !!options.boss,
    };
    state = {
      player,
      enemy,
      turn: 'player',
      log: [],
      defending: false,
      done: false,
      onEnd: options.onEnd,
      onWin: options.onWin,
      onLose: options.onLose,
      onFlee: options.onFlee,
    };
    log('s', 'A wild ' + enemy.name + ' appears!');
    UI.openCombat(state);
  }

  function log(cls, text) {
    if (!state) return;
    state.log.push({ cls, text });
    if (state.log.length > 30) state.log.shift();
    UI.renderCombat(state);
  }

  function playerAction(act) {
    if (!state || state.turn !== 'player' || state.done) return;
    const p = state.player;
    const e = state.enemy;
    state.defending = false;
    if (act === 'attack') {
      const dmg = Math.max(1, rollDamage(p.stats.atk, e.def));
      e.hp -= dmg;
      log('p', p.name + ' strikes ' + e.name + ' for ' + dmg + ' damage.');
      UI.flashCombatEnemy();
    } else if (act === 'magic') {
      if (p.mp < 3) { log('s', 'Not enough MP!'); UI.renderCombat(state); return; }
      p.mp -= 3;
      const dmg = Math.max(2, rollDamage(p.stats.mag * 1.6, Math.floor(e.def / 2)));
      e.hp -= dmg;
      log('p', p.name + ' casts Spark — ' + dmg + ' magic damage!');
      UI.flashCombatEnemy();
    } else if (act === 'defend') {
      state.defending = true;
      log('p', p.name + ' braces for impact.');
    } else if (act === 'flee') {
      if (state.enemy.isBoss) { log('s', 'You can\'t flee from this!'); UI.renderCombat(state); return; }
      const chance = 0.5 + p.stats.spd * 0.05;
      if (Math.random() < chance) {
        log('s', p.name + ' flees!');
        end('flee');
        return;
      } else {
        log('s', 'Couldn\'t escape!');
      }
    }
    if (e.hp <= 0) {
      e.hp = 0;
      log('s', e.name + ' is defeated!');
      grantRewards();
      end('win');
      return;
    }
    state.turn = 'enemy';
    UI.renderCombat(state);
    setTimeout(enemyAction, 700);
  }

  function enemyAction() {
    if (!state || state.done) return;
    const p = state.player;
    const e = state.enemy;
    let dmg = Math.max(1, rollDamage(e.atk, p.stats.def));
    if (state.defending) dmg = Math.max(1, Math.floor(dmg / 2));
    p.hp -= dmg;
    log('e', e.name + ' attacks ' + p.name + ' for ' + dmg + ' damage.');
    UI.flashCombatPlayer();
    if (p.hp <= 0) {
      p.hp = 0;
      log('s', p.name + ' has fallen…');
      end('lose');
      return;
    }
    state.turn = 'player';
    UI.renderCombat(state);
  }

  function rollDamage(atk, def) {
    const variance = 0.85 + Math.random() * 0.3;
    return Math.floor(atk * variance) - Math.floor(def * 0.6);
  }

  function grantRewards() {
    const p = state.player;
    const e = state.enemy;
    p.xp += e.xp;
    p.gold += e.gold;
    log('s', '+ ' + e.xp + ' XP, +' + e.gold + ' gold.');
    // Quests
    Quests.trackKill(p, e.kind);
    while (p.xp >= xpNeeded(p.level)) {
      p.xp -= xpNeeded(p.level);
      p.level += 1;
      p.maxhp += 6;
      p.maxmp += 2;
      p.hp = p.maxhp;
      p.mp = p.maxmp;
      p.stats.atk += 1;
      p.stats.mag += 1;
      p.stats.def += 1;
      log('s', '★ Level Up! Now Lv ' + p.level);
    }
  }

  function xpNeeded(level) {
    return Math.floor(10 * Math.pow(1.45, level - 1));
  }

  function end(outcome) {
    if (!state) return;
    state.done = true;
    UI.renderCombat(state);
    setTimeout(() => {
      const s = state;
      state = null;
      UI.closeCombat();
      if (outcome === 'win' && s.onWin) s.onWin();
      if (outcome === 'lose' && s.onLose) s.onLose();
      if (outcome === 'flee' && s.onFlee) s.onFlee();
      if (s.onEnd) s.onEnd(outcome);
    }, 800);
  }

  global.Combat = {
    start,
    playerAction,
    isActive: () => !!state,
    xpNeeded,
  };
})(window);
