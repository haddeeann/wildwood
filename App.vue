<script>
import { gameOptions } from './logic.js';

export default {
  name: 'WildwoodGame',
  setup: gameOptions.setup
};
</script>

<template>
  <div class="game-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark"><span>♠</span></div>
        <div><h1>Wildwood</h1><p>Habitat &amp; Hearth</p></div>
      </div>
      <nav class="season-track" aria-label="Season progress">
        <div v-for="(name, i) in ['Spring','Summer','Autumn','Winter']" :key="name" :class="['season-step', {active: season === name, passed: Math.floor((round-1)/2) > i}]">
          <span>{{ ['✿','☀','❦','❄'][i] }}</span><small>{{ name }}</small>
        </div>
      </nav>
      <div class="top-actions">
        <p class="win-note">Highest score after Round 8 wins.</p>
        <div class="round-pill"><span>Round</span><strong>{{ round }}</strong><span>/ 8</span></div>
        <button class="soft-button" @click="showRules = true">? <span>How to play</span></button>
      </div>
    </header>

    <main class="tabletop">
      <section class="draft-panel panel">
        <div class="section-heading">
          <div><span class="eyebrow">Choose your habitat</span><h2>Canopy Draft Shelf</h2></div>
          <div class="draft-tools"><span>4 clumps available</span><button :disabled="!selectedPiece" @click="rotatePiece">↻ Rotate <kbd>R</kbd></button></div>
        </div>
        <div class="shelf">
          <button v-for="(piece, index) in shelf" :key="piece.id" :class="['draft-card', {selected: selectedSlot === index}]" @click="selectPiece(index)">
            <div class="card-top"><span>{{ piece.shape }}</span><em v-if="piece.wildlife">{{ WILDLIFE[piece.wildlife].icon }} {{ WILDLIFE[piece.wildlife].name.split(' ')[0] }}</em><em v-else>Free draft</em></div>
            <div class="mini-piece"><span v-for="([q,r,biome], ci) in piece.cells" :key="ci" :class="['mini-hex', biome]" :style="{transform: 'translate(' + (q*31-r*15) + 'px,' + (r*27) + 'px)'}">{{ BIOMES[biome].icon }}</span></div>
            <div class="card-action">{{ selectedSlot === index ? 'Ready to place' : 'Select clump' }} <b>→</b></div>
          </button>
        </div>
      </section>

      <section class="play-area">
        <div class="boards-pair">
          <article class="board-panel player-board panel">
            <div class="section-heading board-heading">
              <div><span class="eyebrow">Your sanctuary</span><h2>Whispering Vale Peninsula</h2></div>
              <div class="player-chip active"><span class="avatar">{{ players[0].initials }}</span><div><small>{{ players[0].name }}</small><strong>{{ players[0].score }} pts</strong></div></div>
            </div>
            <div class="board-wrap"><div class="river-edge-label">⌁ Northern river edge</div><div class="hex-board" aria-label="Your Whispering Vale Peninsula">
              <button v-for="cell in playerBoardCells" :key="cell.key" :class="['hex', cell.value?.biome || previewBiome(cell) || 'empty', {edge: cell.edge, preview: previewKeys.has(cell.key), invalid: previewKeys.has(cell.key) && !isValidPreview}]" :style="{ '--q': cell.q, '--r': cell.r }" @click="cellClick(cell)">
                <span class="habitat-icon">{{ cell.value ? BIOMES[cell.value.biome].icon : (previewBiome(cell) ? BIOMES[previewBiome(cell)].icon : '+') }}</span><span v-if="cell.value?.wildlife" class="token">{{ WILDLIFE[cell.value.wildlife].icon }}</span>
              </button>
            </div></div>
            <div class="board-footer"><div class="legend"><span v-for="(bio,key) in BIOMES" :key="key"><i :class="key"></i>{{ bio.label }} <b>{{ largestCluster(key, 0) }}</b></span></div><div class="turn-hint"><i></i>{{ toast }}</div></div>
            <div class="board-actions"><button class="confirm-button" :disabled="!isValidPreview" @click="confirmPlacement"><span>✓</span> Confirm &amp; place clump</button><p v-if="!selectedPiece" class="confirm-help">Select a shelf clump to see its placement</p><p v-else-if="!isValidPreview" class="confirm-help">Choose another position or rotation</p></div>
          </article>

          <article class="board-panel opponent-board panel">
            <div class="section-heading board-heading">
              <div><span class="eyebrow">Bot sanctuary</span><h2>Lyra's Mosslight Reach</h2></div>
              <div class="player-chip active"><span class="avatar">{{ players[1].initials }}</span><div><small>{{ players[1].name }} · Bot</small><strong>{{ players[1].score }} pts</strong></div></div>
            </div>
            <div class="board-wrap"><div class="river-edge-label">Northern river edge ⌁</div><div class="hex-board" aria-label="Lyra's sanctuary">
              <div v-for="cell in botBoardCells" :key="cell.key" :class="['hex', cell.value?.biome || 'empty', {edge: cell.edge}]" :style="{ '--q': cell.q, '--r': cell.r }">
                <span class="habitat-icon">{{ cell.value ? BIOMES[cell.value.biome].icon : '+' }}</span><span v-if="cell.value?.wildlife" class="token">{{ WILDLIFE[cell.value.wildlife].icon }}</span>
              </div>
            </div></div>
            <div class="board-footer"><div class="legend"><span v-for="(bio,key) in BIOMES" :key="key"><i :class="key"></i>{{ bio.label }} <b>{{ largestCluster(key, 1) }}</b></span></div><div class="bot-status"><i></i>Updates automatically after your move</div></div>
          </article>
        </div>

        <p class="end-note">Game ends at Round 8, or sooner if a board fills completely — score is what matters, not filling it.</p>

        <aside class="ledger panel"><div class="ledger-tab"></div>
          <div class="ledger-heading"><div><span class="eyebrow">Your live score</span><h2>Wildwood Ledger</h2></div><div class="score-total"><strong>{{ players[0].score }}</strong><span>pts</span></div></div>
          <div class="score-breakdown">
            <div><small>Biggest habitat patch</small><strong>+{{ ['forest','meadow','river','wetland'].reduce((s,b) => s + ([0,1,3,6,10,15,21][Math.min(largestCluster(b,0),6)]), 0) }}</strong><p>Only your largest connected patch of each habitat scores.</p></div>
            <div><small>Animal bonuses</small><strong>+{{ wildlifeRows.reduce((s,w) => s+w.score, 0) }}</strong><p>Drafted animals reward specific habitat patterns.</p></div>
            <div><small>Season goal</small><strong>+{{ players[0].edicts }}</strong><p>Complete the current two-round goal for eight points.</p></div>
          </div>
          <div class="ledger-details"><div><h3>Wildlife tokens</h3><div class="wildlife-list"><div v-for="item in wildlifeRows" :key="item.type" class="wildlife-row"><span :class="['animal-icon', item.type]">{{ item.icon }}</span><div><strong>{{ item.name }}</strong><small>{{ item.detail }}</small></div><div class="wild-score"><b>+{{ item.score }}</b><small>{{ item.text }}</small></div></div></div></div>
          <div class="edict-card"><div class="edict-art">{{ edict.icon }}</div><div><span>Seasonal edict · {{ season }}</span><h3>{{ edict.name }}</h3><p>{{ edict.copy }}</p><div class="progress"><i :style="{width: (edictProgress/edict.target*100)+'%'}"></i></div><small>{{ edictProgress }} / {{ edict.target }} connected</small></div><b>+8</b></div></div>
        </aside>
      </section>

      <footer class="bag-panel panel"><div class="bag-icon">◌</div><div><span class="eyebrow">Finite habitat supply</span><h3>Embroidered Tile Bag</h3></div><div class="bag-count"><strong>{{ tilesLeft }}</strong><span>hexes left</span></div><div class="bag-biomes"><span v-for="(bio,key) in BIOMES" :key="key"><i :class="key"></i>{{ bio.label }}</span></div><div class="up-next"><small>Coming up</small><span class="forest"></span><span class="river"></span><span class="meadow"></span><span class="wetland"></span></div></footer>
    </main>

    <div v-if="showRules" class="modal-backdrop" @click.self="showRules = false"><section class="rules-modal"><button class="modal-close" @click="showRules = false">×</button><span class="eyebrow">Field guide</span><h2>How to play Wildwood</h2><div class="rule-steps"><div><b>1</b><h3>Draft</h3><p>Choose one of four habitat clumps. Any wildlife shown comes with it.</p></div><div><b>2</b><h3>Orient</h3><p>Rotate in 60° turns. Clumps cannot flip, so every bend matters.</p></div><div><b>3</b><h3>Place</h3><p>Fit every hex on open spaces, then confirm to pass the turn.</p></div></div><h3>Scoring the sanctuary</h3><p>Score the largest connected cluster of each habitat (1, 3, 6, 10, 15, or 21 points), plus completed wildlife goals and seasonal edicts. After round 8, the highest score wins.</p><button class="confirm-button" @click="showRules = false">Return to the table</button></section></div>
    <div v-if="showGameOver" class="modal-backdrop"><section class="rules-modal game-over"><span class="eyebrow">The winter bell rings</span><h2>{{ players[0].score === players[1].score ? 'A shared sanctuary!' : (players[0].score > players[1].score ? players[0].name : players[1].name) + ' wins!' }}</h2><div class="final-scores"><div v-for="p in players" :key="p.name"><span class="avatar">{{p.initials}}</span><h3>{{p.name}}</h3><strong>{{p.score}} pts</strong></div></div><button class="confirm-button" @click="resetGame">Play another game</button></section></div>
  </div>
</template>
