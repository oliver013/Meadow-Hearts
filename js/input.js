// Tracks pressed keys and emits actions used by the game.
(function (global) {
  const state = {
    keys: new Set(),
    pressed: new Set(),
    lastDir: 'down',
  };

  const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right',
    KeyE: 'interact', Space: 'interact',
    Tab: 'menu',
    KeyJ: 'attack', KeyK: 'magic', KeyL: 'defend', KeyF: 'flee',
    Escape: 'cancel',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEY_MAP[e.code];
    if (action) {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!state.keys.has(action)) state.pressed.add(action);
      state.keys.add(action);
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEY_MAP[e.code];
    if (action) state.keys.delete(action);
  });
  window.addEventListener('blur', () => state.keys.clear());

  global.Input = {
    isDown: (a) => state.keys.has(a),
    consumePressed: (a) => {
      if (state.pressed.has(a)) {
        state.pressed.delete(a);
        return true;
      }
      return false;
    },
    clear: () => {
      state.keys.clear();
      state.pressed.clear();
    },
    state,
  };
})(window);
