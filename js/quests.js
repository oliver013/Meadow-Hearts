// Quests / missions.
(function (global) {
  const QUESTS = {
    q1: {
      id: 'q1',
      title: 'Sage\'s Trial',
      desc: 'Slay 3 slimes in the Crypt.',
      goal: { kill: 'slime', count: 3 },
      reward: { xp: 30, gold: 25 },
      giver: 'Sage Eolan',
      complete: 'You have proven your courage.',
    },
    q2: {
      id: 'q2',
      title: 'Goblins of the Crypt',
      desc: 'Defeat 3 goblins in the dungeons.',
      goal: { kill: 'goblin', count: 3 },
      reward: { xp: 60, gold: 50 },
      giver: 'Mayor Aldwin',
      unlocks: 'dungeon2',
      complete: 'Excellent! The Spire portal is now open.',
    },
    q3: {
      id: 'q3',
      title: 'Mira\'s Errand',
      desc: 'Visit the chest in Mira\'s home.',
      goal: { collect: 'Health Potion' },
      reward: { xp: 10, gold: 5 },
      giver: 'Healer Mira',
      complete: 'Thank you for the help, dear.',
    },
    q4: {
      id: 'q4',
      title: 'Ore for the Smith',
      desc: 'Bring 5 Spire Ore from the Dark Spire.',
      goal: { collect: 'Spire Ore x5' },
      reward: { xp: 50, gold: 40, item: 'Steel Sword' },
      giver: 'Smith Bron',
      complete: 'Magnificent. Your blade is ready.',
    },
    q5: {
      id: 'q5',
      title: 'The Lost Kitten',
      desc: 'Find Granny\'s kitten in the Crypt.',
      goal: { event: 'q5_complete' },
      reward: { xp: 20, gold: 15, item: 'Lucky Charm' },
      giver: 'Granny Lin',
      complete: 'Mew~ The kitten is home!',
    },
    qBoss: {
      id: 'qBoss',
      title: 'Slay the Dark Lord',
      desc: 'Climb the Dark Spire and defeat the Dark Lord.',
      goal: { kill: 'boss', count: 1 },
      reward: { xp: 200, gold: 200, item: 'Crown of Light' },
      giver: 'Destiny',
      complete: 'The realm is saved! You are a true hero.',
      autoStart: true,
    },
  };

  function newQuestLog() {
    return { active: {}, complete: {} };
  }

  function startQuest(player, id) {
    if (!QUESTS[id]) return false;
    if (player.quests.complete[id]) return false;
    if (player.quests.active[id]) return false;
    player.quests.active[id] = { progress: 0 };
    return true;
  }

  function trackKill(player, kind) {
    let any = false;
    for (const [qid, prog] of Object.entries(player.quests.active)) {
      const q = QUESTS[qid];
      if (q.goal.kill === kind) {
        prog.progress = (prog.progress || 0) + 1;
        any = true;
      }
    }
    return any;
  }

  function trackEvent(player, eventId) {
    let any = false;
    for (const [qid, prog] of Object.entries(player.quests.active)) {
      const q = QUESTS[qid];
      if (q.goal.event === eventId) {
        prog.progress = q.goal.count || 1;
        any = true;
      }
    }
    return any;
  }

  function trackCollect(player, itemName) {
    let any = false;
    for (const [qid, prog] of Object.entries(player.quests.active)) {
      const q = QUESTS[qid];
      if (q.goal.collect === itemName) {
        prog.progress = 1;
        any = true;
      }
    }
    return any;
  }

  function checkComplete(player) {
    const completed = [];
    for (const [qid, prog] of Object.entries(player.quests.active)) {
      const q = QUESTS[qid];
      let done = false;
      if (q.goal.kill) done = (prog.progress || 0) >= q.goal.count;
      if (q.goal.event) done = (prog.progress || 0) >= 1;
      if (q.goal.collect) done = (prog.progress || 0) >= 1;
      if (done) {
        delete player.quests.active[qid];
        player.quests.complete[qid] = true;
        completed.push(q);
      }
    }
    return completed;
  }

  global.Quests = {
    QUESTS, newQuestLog,
    startQuest, trackKill, trackEvent, trackCollect, checkComplete,
  };
})(window);
