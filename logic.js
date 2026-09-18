import { computed, ref } from 'vue';

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

export const gameOptions = {
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
    const round = ref(1);
    const showRules = ref(false);
    const showGameOver = ref(false);
    const toast = ref('Choose a clump from the Canopy Draft Shelf.');
    const history = ref([]);

    const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const season = computed(() => seasonNames[Math.min(3, Math.floor((round.value - 1) / 2))]);
    const edict = computed(() => EDICTS[Math.min(3, Math.floor((round.value - 1) / 2))]);
    const activeBoard = computed(() => players.value[0].board);
    const selectedPiece = computed(() => selectedSlot.value === null ? null : shelf.value[selectedSlot.value]);
    const tilesLeft = computed(() => Math.max(0, 42 - history.value.reduce((n, h) => n + h.size, 0)));
    const playerBoardCells = computed(() => boardCellsFor(0));
    const botBoardCells = computed(() => boardCellsFor(1));
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
      selectedSlot.value = index; rotation.value = 0;
      snapPreview();
      toast.value = previewAnchor.value ? `${shelf.value[index].shape} snapped into place. Move it or confirm.` : 'No open space fits this clump.';
    }
    function rotatePiece() {
      if (!selectedPiece.value) return;
      rotation.value = (rotation.value + 1) % 6;
      snapPreview();
      toast.value = previewAnchor.value ? 'Clump rotated and snapped to the nearest valid space.' : 'That orientation has no valid space.';
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
      const piece = selectedPiece.value;
      placePiece(0, piece, orientedCells.value, previewAnchor.value);
      history.value.push({ player: 0, size: orientedCells.value.length });
      refillShelf(selectedSlot.value);
      selectedSlot.value = null; previewAnchor.value = null; rotation.value = 0;
      updateScores();
      if (Object.keys(players.value[0].board).length === BOARD_COORDS.length) return endGame();
      botTurn();
    }
    function refillShelf(slot) {
      shelf.value[slot] = clonePiece(PIECES[bagIndex.value % PIECES.length], bagIndex.value);
      bagIndex.value++;
    }
    function boardCellsFor(playerIndex) {
      const board = players.value[playerIndex].board;
      return BOARD_COORDS.map(([q,r]) => ({ q, r, key: key(q,r), edge: EDGE_KEYS.has(key(q,r)), value: board[key(q,r)] || null }));
    }
    function validAt(board, cells, anchor) {
      const [aq, ar] = anchor;
      return cells.every(([q,r]) => BOARD_KEYS.has(key(aq+q, ar+r)) && !board[key(aq+q, ar+r)]);
    }
    function snapPreview() {
      previewAnchor.value = BOARD_COORDS
        .filter(anchor => validAt(activeBoard.value, orientedCells.value, anchor))
        .sort(([aq,ar],[bq,br]) => ((aq-1.25)**2+(ar-2)**2) - ((bq-1.25)**2+(br-2)**2))[0] || null;
    }
    function placePiece(playerIndex, piece, cells, anchor) {
      const board = players.value[playerIndex].board;
      const [aq, ar] = anchor;
      const wildlifeBiome = piece.wildlife ? WILDLIFE[piece.wildlife].biome : null;
      let tokenPlaced = false;
      cells.forEach(([q,r,biome]) => {
        board[key(aq+q, ar+r)] = { biome, wildlife: !tokenPlaced && biome === wildlifeBiome ? piece.wildlife : null };
        if (!tokenPlaced && biome === wildlifeBiome) tokenPlaced = true;
      });
    }
    function botTurn() {
      const board = players.value[1].board;
      let choice = null;
      shelf.value.forEach((piece, slot) => {
        for (let turn = 0; turn < 6; turn++) {
          const cells = piece.cells.map(([q,r,biome]) => {
            let coord = [q,r]; for (let i=0; i<turn; i++) coord = rotateCoord(coord);
            return [...coord, biome];
          });
          BOARD_COORDS.forEach(anchor => {
            if (!validAt(board, cells, anchor)) return;
            const testBoard = { ...board };
            const [aq,ar] = anchor;
            cells.forEach(([q,r,biome]) => { testBoard[key(aq+q,ar+r)] = { biome, wildlife: null }; });
            const value = groveScore(testBoard) + cells.length;
            if (!choice || value > choice.value) choice = { piece, slot, cells, anchor, value };
          });
        }
      });
      if (choice) {
        placePiece(1, choice.piece, choice.cells, choice.anchor);
        history.value.push({ player: 1, size: choice.cells.length });
        refillShelf(choice.slot);
      }
      updateScores();
      if (Object.keys(players.value[1].board).length === BOARD_COORDS.length) return endGame();
      if (round.value % 2 === 0) scoreSeason(Math.floor((round.value - 1) / 2));
      if (round.value === 8) return endGame();
      round.value++;
      toast.value = 'Your turn — choose a clump. Lyra has finished her move.';
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
    function largestCluster(biome, playerIndex = 0) { return Math.max(0, ...biomeClusters(players.value[playerIndex].board, biome)); }
    const wildlifeRows = computed(() => Object.entries(WILDLIFE).map(([type, data]) => ({ type, ...data, ...wildlifeProgress(activeBoard.value, type) })));
    const edictProgress = computed(() => Math.min(edict.value.target, Math.max(0, ...biomeClusters(activeBoard.value, edict.value.biome))));
    function endGame() { updateScores(); showGameOver.value = true; toast.value = 'The sanctuary is complete.'; }
    function resetGame() {
      players.value.forEach(p => { p.board = {}; p.score = 0; p.edicts = 0; });
      shelf.value = PIECES.slice(0,4).map((p,i) => clonePiece(p,i)); bagIndex.value = 4;
      round.value = 1; selectedSlot.value = null; previewAnchor.value = null; history.value = [];
      showGameOver.value = false; toast.value = 'Choose a clump from the Canopy Draft Shelf.';
    }
    return { BIOMES, WILDLIFE, players, shelf, selectedSlot, selectedPiece, round, season, edict, playerBoardCells, botBoardCells,
      previewKeys, isValidPreview, showRules, showGameOver, toast, tilesLeft, wildlifeRows, edictProgress,
      selectPiece, rotatePiece, cellClick, previewBiome, confirmPlacement, largestCluster, resetGame };
  }
};
