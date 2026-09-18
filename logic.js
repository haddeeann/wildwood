import { createApp, computed, ref } from 'vue/dist/vue.esm-bundler.js';

const BIOMES = {
  forest: { label: 'Forest', icon: '♠' },
  meadow: { label: 'Meadow', icon: '✿' },
  river: { label: 'River', icon: '≈' },
  wetland: { label: 'Wetland', icon: '≋' }
};

const WILDLIFE = {
  fox: { name: 'Fox Sanctuary', icon: '🦊', biome: 'meadow', detail: 'Meadow beside Forest' },
  heron: { name: 'Great Heron', icon: '🪶', biome: 'river', detail: 'Continuous River chain' },
  bear: { name: 'Ursine Solitude', icon: '🐻', biome: 'forest', detail: 'Isolated Forest cluster' },
  salmon: { name: 'Salmon Run', icon: '🐟', biome: 'wetland', detail: 'Wetland–River loop' }
};

const EDICTS = [
  { name: 'Forest Awakening', copy: 'Grow a connected grove of 3 Forests.', biome: 'forest', target: 3, icon: '🌱' },
  { name: 'River Chorus', copy: 'Join 4 River hexes into one chain.', biome: 'river', target: 4, icon: '☀️' },
  { name: 'Autumn Migration', copy: 'Connect 4 Wetlands before Winter.', biome: 'wetland', target: 4, icon: '🍂' },
  { name: 'Hearth Keepers', copy: 'Gather 4 Meadows for the long winter.', biome: 'meadow', target: 4, icon: '🔥' }
];

const BOARD_COORDS = [
  [0,0],[1,0],[2,0],[3,0], [-1,1],[0,1],[1,1],[2,1],[3,1],
  [-1,2],[0,2],[1,2],[2,2],[3,2],[4,2], [-1,3],[0,3],[1,3],[2,3],[3,3],
  [0,4],[1,4],[2,4],[3,4]
];
const EDGE_KEYS = new Set(['0,0','1,0','2,0']);
const BOARD_KEYS = new Set(BOARD_COORDS.map(([q,r]) => `${q},${r}`));
const key = (q, r) => `${q},${r}`;
const neighbors = (q, r) => [[q+1,r],[q-1,r],[q,r+1],[q,r-1],[q+1,r-1],[q-1,r+1]];
const rotateCoord = ([q, r]) => [-r, q + r];

const PIECES = [
  { shape: 'Free Draft', cells: [[0,0,'forest']] },
  { shape: '3-Hex Line', cells: [[0,0,'river'],[1,0,'river'],[2,0,'wetland']], wildlife: 'heron' },
  { shape: '3-Hex L', cells: [[0,0,'meadow'],[1,0,'forest'],[0,1,'meadow']], wildlife: 'fox' },
  { shape: '4-Hex Clump', cells: [[0,0,'forest'],[1,0,'forest'],[0,1,'wetland'],[1,1,'river']], wildlife: 'bear' },
  { shape: '3-Hex Line', cells: [[0,0,'meadow'],[1,0,'meadow'],[2,0,'forest']] },
  { shape: '3-Hex L', cells: [[0,0,'wetland'],[1,0,'river'],[1,-1,'river']], wildlife: 'salmon' },
  { shape: '4-Hex Clump', cells: [[0,0,'meadow'],[1,0,'forest'],[0,1,'forest'],[-1,1,'wetland']] },
  { shape: '3-Hex L', cells: [[0,0,'forest'],[1,0,'wetland'],[0,1,'river']] },
  { shape: 'Free Draft', cells: [[0,0,'meadow']], wildlife: 'fox' },
  { shape: '4-Hex Clump', cells: [[0,0,'river'],[1,0,'river'],[0,1,'wetland'],[1,-1,'wetland']], wildlife: 'salmon' }
];
const clonePiece = (p, id) => ({ ...p, id, cells: p.cells.map(c => [...c]) });

createApp({
  setup() {
    const players = ref([
      { name: 'Rowan', initials: 'RW', score: 0, board: {}, edicts: 0 },
      { name: 'Lyra', initials: 'LY', score: 0, board: {}, edicts: 0 }
    ]);
    const shelf = ref(PIECES.slice(0, 4).map((p, i) => clonePiece(p, i)));
    const bagIndex = ref(4);
    const selectedSlot = ref(null);
    const rotation = ref(0);
    const previewAnchor = ref(null);
    const currentPlayer = ref(0);
    const round = ref(1);
    const showRules = ref(false);
    const showGameOver = ref(false);
    const toast = ref('Choose a clump from the Canopy Draft Shelf.');
    const history = ref([]);

    const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const season = computed(() => seasonNames[Math.min(3, Math.floor((round.value - 1) / 2))]);
    const edict = computed(() => EDICTS[Math.min(3, Math.floor((round.value - 1) / 2))]);
    const turnLabel = computed(() => players.value[currentPlayer.value].name);
    const activeBoard = computed(() => players.value[currentPlayer.value].board);
    const selectedPiece = computed(() => selectedSlot.value === null ? null : shelf.value[selectedSlot.value]);
    const tilesLeft = computed(() => Math.max(0, 42 - history.value.reduce((n, h) => n + h.size, 0)));
    const boardCells = computed(() => BOARD_COORDS.map(([q,r]) => ({ q, r, key: key(q,r), edge: EDGE_KEYS.has(key(q,r)), value: activeBoard.value[key(q,r)] || null })));
    const orientedCells = computed(() => {
      if (!selectedPiece.value) return [];
      return selectedPiece.value.cells.map(([q,r,biome]) => {
        let coord = [q,r];
        for (let i=0; i<rotation.value; i++) coord = rotateCoord(coord);
        return [...coord, biome];
      });
    });
    const previewKeys = computed(() => {
      if (!previewAnchor.value) return new Set();
      const [aq, ar] = previewAnchor.value;
      return new Set(orientedCells.value.map(([q,r]) => key(aq+q, ar+r)));
    });
    const isValidPreview = computed(() => {
      if (!selectedPiece.value || !previewAnchor.value) return false;
      const valid = new Set(BOARD_COORDS.map(([q,r]) => key(q,r)));
      return [...previewKeys.value].every(k => valid.has(k) && !activeBoard.value[k]);
    });

    function selectPiece(index) {
      selectedSlot.value = index; rotation.value = 0; previewAnchor.value = null;
      toast.value = `${shelf.value[index].shape} selected. Choose an open hex to place it.`;
    }
    function rotatePiece() {
      if (!selectedPiece.value) return;
      rotation.value = (rotation.value + 1) % 6; previewAnchor.value = null;
      toast.value = 'Clump rotated 60°. Chirality preserved.';
    }
    function cellClick(cell) {
      if (!selectedPiece.value || cell.value) return;
      previewAnchor.value = [cell.q, cell.r];
      toast.value = isValidPreview.value ? 'A lovely fit. Confirm when ready.' : 'That clump spills outside the sanctuary or overlaps a habitat.';
    }
    function previewBiome(cell) {
      if (!previewKeys.value.has(cell.key) || !previewAnchor.value) return null;
      const [aq, ar] = previewAnchor.value;
      return orientedCells.value.find(([q,r]) => key(aq+q, ar+r) === cell.key)?.[2] || null;
    }
    function confirmPlacement() {
      if (!isValidPreview.value) return;
      const player = players.value[currentPlayer.value];
      const [aq, ar] = previewAnchor.value;
      const piece = selectedPiece.value;
      const wildlifeBiome = piece.wildlife ? WILDLIFE[piece.wildlife].biome : null;
      let tokenPlaced = false;
      orientedCells.value.forEach(([q,r,biome]) => {
        player.board[key(aq+q, ar+r)] = { biome, wildlife: !tokenPlaced && biome === wildlifeBiome ? piece.wildlife : null };
        if (!tokenPlaced && biome === wildlifeBiome) tokenPlaced = true;
      });
      history.value.push({ player: currentPlayer.value, size: orientedCells.value.length });
      refillShelf(selectedSlot.value);
      selectedSlot.value = null; previewAnchor.value = null; rotation.value = 0;
      updateScores();
      if (Object.keys(player.board).length === BOARD_COORDS.length) return endGame();
      advanceTurn();
    }
    function refillShelf(slot) {
      shelf.value[slot] = clonePiece(PIECES[bagIndex.value % PIECES.length], bagIndex.value);
      bagIndex.value++;
    }
    function advanceTurn() {
      if (currentPlayer.value === 0) currentPlayer.value = 1;
      else {
        currentPlayer.value = 0;
        if (round.value % 2 === 0) scoreSeason(Math.floor((round.value - 1) / 2));
        if (round.value === 8) return endGame();
        round.value++;
      }
      toast.value = `${turnLabel.value}'s turn — choose a clump.`;
    }
    function biomeClusters(board, biome) {
      const candidates = new Set(Object.entries(board).filter(([,v]) => v.biome === biome).map(([k]) => k));
      const clusters = [];
      while (candidates.size) {
        const start = candidates.values().next().value;
        const stack = [start]; candidates.delete(start); let size = 0;
        while (stack.length) {
          const current = stack.pop(); size++;
          const [q,r] = current.split(',').map(Number);
          neighbors(q,r).map(([nq,nr]) => key(nq,nr)).forEach(nk => { if (candidates.has(nk)) { candidates.delete(nk); stack.push(nk); } });
        }
        clusters.push(size);
      }
      return clusters;
    }
    function groveScore(board) {
      const table = [0,1,3,6,10,15,21];
      return Object.keys(BIOMES).reduce((sum, biome) => sum + table[Math.min(Math.max(0, ...biomeClusters(board, biome)), 6)], 0);
    }
    function wildlifeProgress(board, type) {
      const tokenCells = Object.entries(board).filter(([,v]) => v.wildlife === type);
      if (!tokenCells.length) return { score: 0, text: 'Not drafted' };
      if (type === 'fox') {
        let pairs = 0;
        Object.entries(board).filter(([,v]) => v.biome === 'meadow').forEach(([k]) => {
          const [q,r] = k.split(',').map(Number);
          if (neighbors(q,r).some(([nq,nr]) => board[key(nq,nr)]?.biome === 'forest')) pairs++;
        });
        pairs = Math.min(3, pairs); return { score: Math.floor(pairs * 3.5), text: `${pairs}/3 paired` };
      }
      if (type === 'heron') {
        const chains = tokenCells.map(([start]) => connectedKeys(board, start, value => value?.biome === 'river').size);
        const longest = Math.min(5, Math.max(0, ...chains));
        return { score: chains.reduce((sum, size) => sum + Math.min(5, size), 0), text: `${longest}/5 river` };
      }
      if (type === 'bear') {
        const done = tokenCells.some(([start]) => {
          const grove = connectedKeys(board, start, value => value?.biome === 'forest');
          return [...grove].every(cellKey => {
            const [q,r] = cellKey.split(',').map(Number);
            return neighbors(q,r).every(([nq,nr]) => {
              const next = key(nq,nr);
              return !BOARD_KEYS.has(next) || grove.has(next) || (board[next] && board[next].biome !== 'forest');
            });
          });
        });
        return { score: done ? 12 : 0, text: done ? 'Completed' : 'Open boundary' };
      }
      const loops = tokenCells.filter(([start]) => {
        const component = connectedKeys(board, start, value => ['river','wetland'].includes(value?.biome));
        const reachesEdge = [...EDGE_KEYS].some(k => component.has(k) && board[k]?.biome === 'river');
        const edges = [...component].reduce((count, cellKey) => {
          const [q,r] = cellKey.split(',').map(Number);
          return count + neighbors(q,r).filter(([nq,nr]) => component.has(key(nq,nr))).length;
        }, 0) / 2;
        return reachesEdge && edges >= component.size;
      }).length;
      return { score: loops * 4, text: `${loops} loops` };
    }
    function connectedKeys(board, start, accepts) {
      if (!accepts(board[start])) return new Set();
      const found = new Set([start]); const stack = [start];
      while (stack.length) {
        const current = stack.pop(); const [q,r] = current.split(',').map(Number);
        neighbors(q,r).forEach(([nq,nr]) => {
          const next = key(nq,nr);
          if (!found.has(next) && accepts(board[next])) { found.add(next); stack.push(next); }
        });
      }
      return found;
    }
    function scoreFor(player) { return groveScore(player.board) + Object.keys(WILDLIFE).reduce((s,t) => s + wildlifeProgress(player.board,t).score, 0) + player.edicts; }
    function updateScores() { players.value.forEach(p => { p.score = scoreFor(p); }); }
    function scoreSeason(index) {
      const goal = EDICTS[index];
      players.value.forEach(p => { if (Math.max(0, ...biomeClusters(p.board, goal.biome)) >= goal.target) p.edicts += 8; });
      updateScores();
    }
    function largestCluster(biome) { return Math.max(0, ...biomeClusters(activeBoard.value, biome)); }
    const wildlifeRows = computed(() => Object.entries(WILDLIFE).map(([type, data]) => ({ type, ...data, ...wildlifeProgress(activeBoard.value, type) })));
    const edictProgress = computed(() => Math.min(edict.value.target, Math.max(0, ...biomeClusters(activeBoard.value, edict.value.biome))));
    function endGame() { updateScores(); showGameOver.value = true; toast.value = 'The sanctuary is complete.'; }
    function resetGame() {
      players.value.forEach(p => { p.board = {}; p.score = 0; p.edicts = 0; });
      shelf.value = PIECES.slice(0,4).map((p,i) => clonePiece(p,i)); bagIndex.value = 4;
      currentPlayer.value = 0; round.value = 1; selectedSlot.value = null; previewAnchor.value = null; history.value = [];
      showGameOver.value = false; toast.value = 'Choose a clump from the Canopy Draft Shelf.';
    }
    return { BIOMES, WILDLIFE, players, shelf, selectedSlot, selectedPiece, currentPlayer, round, season, edict, boardCells,
      previewKeys, isValidPreview, showRules, showGameOver, toast, tilesLeft, wildlifeRows, edictProgress,
      selectPiece, rotatePiece, cellClick, previewBiome, confirmPlacement, largestCluster, resetGame };
  },
  template: `
    <div class="game-shell">
      <header class="topbar">
        <div class="brand"><div class="brand-mark"><span>♠</span></div><div><h1>Wildwood</h1><p>Habitat & Hearth</p></div></div>
        <nav class="season-track" aria-label="Season progress">
          <div v-for="(name, i) in ['Spring','Summer','Autumn','Winter']" :class="['season-step', {active: season === name, passed: Math.floor((round-1)/2) > i}]"><span>{{ ['✿','☀','❦','❄'][i] }}</span><small>{{ name }}</small></div>
        </nav>
        <div class="top-actions"><div class="round-pill"><span>Round</span><strong>{{ round }}</strong><span>/ 8</span></div><button class="soft-button" @click="showRules = true">? <span>How to play</span></button></div>
      </header>

      <main class="tabletop">
        <section class="draft-panel panel">
          <div class="section-heading"><div><span class="eyebrow">Choose your habitat</span><h2>Canopy Draft Shelf</h2></div><div class="draft-tools"><span>4 clumps available</span><button @click="rotatePiece" :disabled="!selectedPiece">↻ Rotate <kbd>R</kbd></button></div></div>
          <div class="shelf">
            <button v-for="(piece, index) in shelf" :key="piece.id" :class="['draft-card', {selected: selectedSlot === index}]" @click="selectPiece(index)">
              <div class="card-top"><span>{{ piece.shape }}</span><em v-if="piece.wildlife">{{ WILDLIFE[piece.wildlife].icon }} {{ WILDLIFE[piece.wildlife].name.split(' ')[0] }}</em><em v-else>Free draft</em></div>
              <div class="mini-piece"><span v-for="([q,r,biome], ci) in piece.cells" :key="ci" :class="['mini-hex', biome]" :style="{transform: 'translate(' + (q*31-r*15) + 'px,' + (r*27) + 'px)'}">{{ BIOMES[biome].icon }}</span></div>
              <div class="card-action">{{ selectedSlot === index ? 'Ready to place' : 'Select clump' }} <b>→</b></div>
            </button>
          </div>
        </section>

        <section class="play-area">
          <div class="board-panel panel">
            <div class="section-heading board-heading"><div><span class="eyebrow">{{ players[currentPlayer].name }}'s sanctuary</span><h2>Whispering Vale Peninsula</h2></div><div class="player-switcher"><div v-for="(player, i) in players" :class="['player-chip', {active: i === currentPlayer}]"><span class="avatar">{{ player.initials }}</span><div><small>{{ player.name }}</small><strong>{{ player.score }} pts</strong></div></div></div></div>
            <div class="board-wrap"><div class="river-edge-label">⌁ Northern river edge</div><div class="hex-board" aria-label="Sanctuary board">
              <button v-for="cell in boardCells" :key="cell.key" :class="['hex', cell.value?.biome || 'empty', {edge: cell.edge, preview: previewKeys.has(cell.key), invalid: previewKeys.has(cell.key) && !isValidPreview}]" :style="{ '--q': cell.q, '--r': cell.r }" @click="cellClick(cell)">
                <span class="habitat-icon">{{ cell.value ? BIOMES[cell.value.biome].icon : (previewBiome(cell) ? BIOMES[previewBiome(cell)].icon : '+') }}</span><span v-if="cell.value?.wildlife" class="token">{{ WILDLIFE[cell.value.wildlife].icon }}</span>
              </button>
            </div></div>
            <div class="board-footer"><div class="legend"><span v-for="(bio,key) in BIOMES"><i :class="key"></i>{{ bio.label }} <b>{{ largestCluster(key) }}</b></span></div><div class="turn-hint"><i></i>{{ toast }}</div></div>
          </div>

          <aside class="ledger panel"><div class="ledger-tab"></div>
            <div class="ledger-heading"><div><span class="eyebrow">Live score</span><h2>Wildwood Ledger</h2></div><div class="score-total"><strong>{{ players[currentPlayer].score }}</strong><span>pts</span></div></div>
            <div class="score-breakdown"><div><small>Grove bonus</small><strong>+{{ ['forest','meadow','river','wetland'].reduce((s,b) => s + ([0,1,3,6,10,15,21][Math.min(largestCluster(b),6)]), 0) }}</strong></div><div><small>Wildlife</small><strong>+{{ wildlifeRows.reduce((s,w) => s+w.score, 0) }}</strong></div><div><small>Edicts</small><strong>+{{ players[currentPlayer].edicts }}</strong></div></div>
            <h3>Wildlife tokens</h3><div class="wildlife-list"><div v-for="item in wildlifeRows" class="wildlife-row"><span :class="['animal-icon', item.type]">{{ item.icon }}</span><div><strong>{{ item.name }}</strong><small>{{ item.detail }}</small></div><div class="wild-score"><b>+{{ item.score }}</b><small>{{ item.text }}</small></div></div></div>
            <div class="edict-card"><div class="edict-art">{{ edict.icon }}</div><div><span>Seasonal edict · {{ season }}</span><h3>{{ edict.name }}</h3><p>{{ edict.copy }}</p><div class="progress"><i :style="{width: (edictProgress/edict.target*100)+'%'}"></i></div><small>{{ edictProgress }} / {{ edict.target }} connected</small></div><b>+8</b></div>
            <button class="confirm-button" :disabled="!isValidPreview" @click="confirmPlacement"><span>✓</span> Confirm & place clump</button><p class="confirm-help" v-if="!selectedPiece">Select a shelf clump to begin</p><p class="confirm-help" v-else-if="!isValidPreview">Choose a valid board position</p>
          </aside>
        </section>

        <footer class="bag-panel panel"><div class="bag-icon">◌</div><div><span class="eyebrow">Finite habitat supply</span><h3>Embroidered Tile Bag</h3></div><div class="bag-count"><strong>{{ tilesLeft }}</strong><span>hexes left</span></div><div class="bag-biomes"><span v-for="(bio,key) in BIOMES"><i :class="key"></i>{{ bio.label }}</span></div><div class="up-next"><small>Coming up</small><span class="forest"></span><span class="river"></span><span class="meadow"></span><span class="wetland"></span></div></footer>
      </main>

      <div v-if="showRules" class="modal-backdrop" @click.self="showRules = false"><section class="rules-modal"><button class="modal-close" @click="showRules = false">×</button><span class="eyebrow">Field guide</span><h2>How to play Wildwood</h2><div class="rule-steps"><div><b>1</b><h3>Draft</h3><p>Choose one of four habitat clumps. Any wildlife shown comes with it.</p></div><div><b>2</b><h3>Orient</h3><p>Rotate in 60° turns. Clumps cannot flip, so every bend matters.</p></div><div><b>3</b><h3>Place</h3><p>Fit every hex on open spaces, then confirm to pass the turn.</p></div></div><h3>Scoring the sanctuary</h3><p>Score the largest connected cluster of each habitat (1, 3, 6, 10, 15, or 21 points), plus completed wildlife goals and seasonal edicts. After round 8, the highest score wins.</p><button class="confirm-button" @click="showRules = false">Return to the table</button></section></div>
      <div v-if="showGameOver" class="modal-backdrop"><section class="rules-modal game-over"><span class="eyebrow">The winter bell rings</span><h2>{{ players[0].score === players[1].score ? 'A shared sanctuary!' : (players[0].score > players[1].score ? players[0].name : players[1].name) + ' wins!' }}</h2><div class="final-scores"><div v-for="p in players"><span class="avatar">{{p.initials}}</span><h3>{{p.name}}</h3><strong>{{p.score}} pts</strong></div></div><button class="confirm-button" @click="resetGame">Play another game</button></section></div>
    </div>`
}).mount('#app');
