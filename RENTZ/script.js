// ==================== CONSTANTE ====================
const RENTZ_ROUNDS = [
  { id: 'dame', label: 'Dame (-25 fiecare)' },
  { id: 'popa', label: 'Popa (-100)' },
  { id: 'romburi', label: 'Romburi (-20 fiecare)' },
  { id: 'totplus', label: 'Totale plus' },
  { id: 'totminus', label: 'Totale minus' },
  { id: 'rentz', label: 'Rentz' }
];

// ==================== LOCAL STORAGE KEYS ====================
const KEY_PLAYERS = 'cardApp_players_v1';
const KEY_GAMES = 'cardApp_games_v1';

// ==================== STATE ====================
let players = load(KEY_PLAYERS, []);
let games = load(KEY_GAMES, []);
let activeGame = null;
let selectedOrder = [];
let showLoserJoke = false;
let showLastRoundScore = false;

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'l' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    if (!showLoserJoke) {
      showLoserJoke = true;
      document.querySelectorAll('.loser-joke-container').forEach(el => el.classList.add('active'));
    }
  }
  if (e.key.toLowerCase() === 'k' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    if (!showLastRoundScore) {
      showLastRoundScore = true;
      document.querySelectorAll('.last-round-container').forEach(el => el.classList.add('active'));
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'l') {
    if (showLoserJoke) {
      showLoserJoke = false;
      document.querySelectorAll('.loser-joke-container').forEach(el => el.classList.remove('active'));
    }
  }
  if (e.key.toLowerCase() === 'k') {
    if (showLastRoundScore) {
      showLastRoundScore = false;
      document.querySelectorAll('.last-round-container').forEach(el => el.classList.remove('active'));
    }
  }
});

// normalize older / imported game objects so `available` și `score` sunt numerice
function ensurePlayerAvailable(player, defaultCount){
  if(!player) return;
  if(!player.available || typeof player.available !== 'object') player.available = {};
  const def = typeof defaultCount === 'number' && defaultCount > 0 ? defaultCount : 1;
  RENTZ_ROUNDS.forEach(r=>{
    const k = r.id;
    let v = player.available[k];
    if (typeof v === 'string') v = v.trim() === '' ? undefined : Number(v);
    if (typeof v !== 'number' || Number.isNaN(v)) player.available[k] = def;
    else player.available[k] = v;
  });
  if (typeof player.score !== 'number') player.score = Number(player.score) || 0;
}

function normalizeGamesList(list){
  if(!Array.isArray(list)) return [];
  return list.map(g=>{
    if(!g || typeof g !== 'object') g = { id: uid('g'), type: 'rentz', players: [], rounds: [] };
    if(!Array.isArray(g.players)) g.players = [];
    if(!Array.isArray(g.rounds)) g.rounds = [];
    // `available` e specific Rentz-ului: nu-l injecta în jocurile de Whist,
    // care stau în aceeași cheie de localStorage.
    if(g.type === 'rentz') g.players.forEach(p=> ensurePlayerAvailable(p));
    return g;
  });
}

// ==================== PERSISTENȚĂ ÎNTRE FILE ====================
// Rentz și Whist împart aceleași chei. Dacă o filă scrie întregul array pe care
// l-a citit la încărcare, șterge tot ce a salvat între timp cealaltă filă — jocuri
// care „dispar din senin". De aceea fiecare scriere recitește întâi storage-ul și
// modifică doar înregistrarea vizată.
function persistGame(g){
  const stored = normalizeGamesList(load(KEY_GAMES, []));
  const idx = stored.findIndex(x => x && x.id === g.id);
  if(idx >= 0) stored[idx] = g; else stored.push(g);
  games = stored;
  save(KEY_GAMES, games);
}
function persistPlayers(mutate){
  const stored = load(KEY_PLAYERS, []);
  const fresh = Array.isArray(stored)
    ? stored.map(p => ({ id: p.id || uid('p'), name: p.name || 'Unknown' }))
    : [];
  players = mutate(fresh);
  save(KEY_PLAYERS, players);
}
function reloadFromStorage(){
  players = (load(KEY_PLAYERS, []) || []).map(p => ({ id: p.id || uid('p'), name: p.name || 'Unknown' }));
  games = normalizeGamesList(load(KEY_GAMES, []));
  if(activeGame){
    const fresh = games.find(g => g.id === activeGame.id);
    activeGame = fresh || null;
  }
}

// apply normalization right after load (fără a suprascrie ce a scris altă filă)
players = Array.isArray(players) ? players.map(p => ({ id: p.id || uid('p'), name: p.name || 'Unknown' })) : [];
games = normalizeGamesList(games);

// ==================== DOM ELEMENTS ====================
const playersList = document.getElementById('playersList');
const newPlayerName = document.getElementById('newPlayerName');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const playersCheckboxes = document.getElementById('playersCheckboxes');
const createGameBtn = document.getElementById('createGameBtn');
const gameTypeEl = document.getElementById('gameType');
const activeGameEl = document.getElementById('activeGame');
const historyEl = document.getElementById('history');
const loadLastGameBtn = document.getElementById('loadLastGameBtn');
const endGameBtn = document.getElementById('endGameBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');

// ==================== HELPERS ====================
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function load(key, fallback) { 
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } 
  catch(e) { return fallback; } 
}
function uid(prefix='id'){ return prefix+'_'+Math.random().toString(36).slice(2,9); }
function escapeHtml(s){ return (s+'').replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]); }
function downloadJSON(obj, filename){ 
  const a = document.createElement('a'); 
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})); 
  a.download = filename; a.click(); 
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
function getPlayersMap(){ return players.reduce((acc,p)=>{ acc[p.id]=p; return acc; },{}); }

// ==================== CUSTOM MODALS ====================
function customConfirm(message, callback) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmMessage').innerText = message;
  modal.style.display = 'flex';
  
  const yesBtn = document.getElementById('confirmYesBtn');
  const noBtn = document.getElementById('confirmNoBtn');
  
  const cleanup = () => {
    modal.style.display = 'none';
    yesBtn.removeEventListener('click', onYes);
    noBtn.removeEventListener('click', onNo);
  };
  
  const onYes = () => { cleanup(); callback(true); };
  const onNo = () => { cleanup(); callback(false); };
  
  yesBtn.addEventListener('click', onYes);
  noBtn.addEventListener('click', onNo);
}

function customPrompt(message, defaultValue, callback) {
  const modal = document.getElementById('promptModal');
  document.getElementById('promptMessage').innerText = message;
  const input = document.getElementById('promptInput');
  input.value = defaultValue || '';
  document.getElementById('promptError').style.display = 'none';
  modal.style.display = 'flex';
  input.focus();
  
  const yesBtn = document.getElementById('promptYesBtn');
  const noBtn = document.getElementById('promptNoBtn');
  
  const cleanup = () => {
    modal.style.display = 'none';
    yesBtn.removeEventListener('click', onYes);
    noBtn.removeEventListener('click', onNo);
  };
  
  const onYes = () => { 
    const val = input.value.trim();
    if (!val) {
      document.getElementById('promptError').style.display = 'block';
      return;
    }
    cleanup(); 
    callback(val); 
  };
  const onNo = () => { cleanup(); callback(null); };
  
  yesBtn.addEventListener('click', onYes);
  noBtn.addEventListener('click', onNo);
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

// ==================== RENDER PLAYERS ====================
function renderPlayers() {
  playersList.innerHTML = '';
  if(players.length===0){ 
    playersList.innerHTML = '<div class="muted">Niciun jucător. Creează unul mai sus.</div>'; 
    return;
  }
  players.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'player';
    div.innerHTML = `
      <div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="muted">id: ${p.id}</div>
      </div>
      <div class="flex-gap">
        <button class="small" data-edit="${p.id}">Editează</button>
        <button class="small danger" data-del="${p.id}">Șterge</button>
      </div>`;
    playersList.appendChild(div);
  });

  // events
  playersList.querySelectorAll('[data-del]').forEach(btn=> btn.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-del');
    customConfirm('Ștergi jucătorul?', (yes) => {
      if(!yes) return;
      persistPlayers(list => list.filter(x=>x.id!==id));
      renderPlayers(); renderPlayersCheckboxes();
    });
  }));
  playersList.querySelectorAll('[data-edit]').forEach(btn=> btn.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-edit');
    const p = players.find(x=>x.id===id);
    customPrompt('Schimbă numele jucătorului', p.name, (newName) => {
      if(newName && newName.trim()){
        persistPlayers(list => list.map(x => x.id===id ? { ...x, name: newName.trim() } : x));
        renderPlayers(); renderPlayersCheckboxes();
      }
    });
  }));
}

// ==================== RENDER PLAYERS CHECKBOXES ====================
function renderPlayersCheckboxes() {
  playersCheckboxes.innerHTML = '';
  const playersMap = getPlayersMap();

  players.forEach(p => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.marginBottom = '6px';

    const checked = selectedOrder.includes(p.id) ? 'checked' : '';
    const order = selectedOrder.includes(p.id) ? selectedOrder.indexOf(p.id) + 1 : '';

    div.innerHTML = `
      <label class="flex-gap align-center" style="cursor:pointer">
        <input type="checkbox" value="${p.id}" id="chk_${p.id}" ${checked} />
        <span>${playersMap[p.id].name} ${order ? '(' + order + ')' : ''}</span>
      </label>
    `;

    playersCheckboxes.appendChild(div);

    div.querySelector('input').addEventListener('change', e => {
      const id = e.target.value;
      if (e.target.checked) selectedOrder.push(id);
      else selectedOrder = selectedOrder.filter(x => x !== id);
      renderPlayersCheckboxes(); // update order
    });
  });
}


// ==================== ADD PLAYER ====================
addPlayerBtn.addEventListener('click', ()=>{
  const name = newPlayerName.value.trim();
  if(!name) return showError('playerNameError', 'Scrie un nume!');
  persistPlayers(list => list.concat([{ id: uid('p'), name }]));
  newPlayerName.value='';
  renderPlayers(); renderPlayersCheckboxes();
});

// ==================== GAME FUNCTIONS ====================
createGameBtn.addEventListener('click', ()=> {
  if(selectedOrder.length < 3) return showError('createGameError', 'Selectează cel puțin 3 jucători');
  const gType = gameTypeEl.value;
  if(gType !== 'rentz') return showError('createGameError', 'Acest fișier suportă doar jocul Rentz!');
  // calculează câte pachete sunt necesare pentru joc (8 cărți per jucător)
  const totalCardsNeededForGame = 8 * selectedOrder.length;
  const decksForGame = Math.max(1, Math.ceil(totalCardsNeededForGame / 52));

  const g = {
    id: uid('g'),
    type: gType,
    players: selectedOrder.map(pid => ({
      id: pid,
      score: 0,
      available: { dame: 1, popa: 1, romburi: 1, totplus: 1, totminus: 1, rentz: 1 }
    })),
    rounds: [],
    createdAt: Date.now(),
    currentPlayerIndex: 0,
    selectedRoundType: null
  };
  persistGame(g);
  activeGame = g; renderActiveGame(); renderHistory();
  selectedOrder = []; renderPlayersCheckboxes();
});

loadLastGameBtn.addEventListener('click', ()=>{
  if(games.length===0) return showError('createGameError', 'Nu există jocuri salvate');
  activeGame = games[games.length-1]; renderActiveGame();
});

endGameBtn.addEventListener('click', ()=>{
  if(!activeGame) return;
  customConfirm('Finalizezi jocul curent?', (yes) => {
    if(!yes) return;
    activeGame=null; renderActiveGame();
  });
});

// ==================== VIEW SWITCHING ====================
document.getElementById('goToAdminBtn').addEventListener('click', () => {
  document.getElementById('adminView').style.display = 'grid';
  document.getElementById('gameView').style.display = 'none';
});
document.getElementById('goToGameBtn').addEventListener('click', () => {
  document.getElementById('adminView').style.display = 'none';
  document.getElementById('gameView').style.display = 'flex';
});

// ==================== RENDER ACTIVE GAME ====================
function renderActiveGame(){
  const adminView = document.getElementById('adminView');
  const gameView = document.getElementById('gameView');
  const goToGameBtn = document.getElementById('goToGameBtn');
  
  if(!activeGame){ 
    adminView.style.display = 'grid';
    gameView.style.display = 'none';
    goToGameBtn.style.display = 'none';
    return; 
  }
  
  goToGameBtn.style.display = 'inline-block';
  
  const playersMap = getPlayersMap();
  const roundsOrder = ['dame','popa','romburi','totplus','totminus','rentz'];
  const roundInitials = { dame: "D", popa: "P", romburi: "R", totplus: "T+", totminus: "T-", rentz: "Rz" };

  const isGameOver = activeGame.players.every(p => {
    return roundsOrder.every(rt => (p.available[rt] || 0) === 0);
  });

  const turnQueue = document.getElementById('turnQueue');
  if (isGameOver) {
    turnQueue.innerHTML = '<div class="queue-item current">Joc finalizat</div>';
    turnQueue.style.display = 'flex';
  } else {
    const n = activeGame.players.length;
    const queueHtml = [];
    
    for (let i = 0; i < n; i++) {
      const pIndex = (activeGame.currentPlayerIndex + i) % n;
      const p = activeGame.players[pIndex];
      const name = playersMap[p.id] ? playersMap[p.id].name : 'Unknown';
      
      if (i === 0) {
        let label = escapeHtml(name);
        if (activeGame.selectedRoundType) {
          const roundLabel = RENTZ_ROUNDS.find(r=>r.id===activeGame.selectedRoundType).label;
          label += ` <span style="font-size:16px; font-weight:normal; color:#fff; margin-left:8px;">(joacă ${roundLabel})</span>`;
        }
        queueHtml.push(`<div class="queue-item current">${label}</div>`);
      } else {
        queueHtml.push(`<div class="queue-item">${escapeHtml(name)}</div>`);
      }
      
      if (i < n - 1) {
        queueHtml.push(`<div class="queue-arrow">➔</div>`);
      }
    }
    
    turnQueue.innerHTML = queueHtml.join('');
    turnQueue.style.display = 'flex';
  }

  // 1. Render Scoreboard
  const scoreboardList = document.getElementById('scoreboardList');
  const sortedPlayers = [...activeGame.players].sort((a, b) => b.score - a.score);
  
  const currentOrder = sortedPlayers.map(p => p.id).join(',');
  const orderChanged = scoreboardList.dataset.lastOrder !== currentOrder;
  scoreboardList.dataset.lastOrder = currentOrder;
  
  // Calculate ranks for medals
  const isGameStart = activeGame.rounds.length === 0;
  let currentRank = 1;
  let currentScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 0;
  
  sortedPlayers.forEach((p, index) => {
    if (p.score < currentScore) {
      currentRank = index + 1;
      currentScore = p.score;
    }
    p.rank = currentRank;
  });
  
  const oldRects = {};
  Array.from(scoreboardList.children).forEach(child => {
    oldRects[child.id] = child.getBoundingClientRect();
  });
  
  scoreboardList.innerHTML = '';
  
  const lowestScore = sortedPlayers.length > 0 ? sortedPlayers[sortedPlayers.length - 1].score : null;
  
  sortedPlayers.forEach((p, index) => {
    const name = playersMap[p.id] ? playersMap[p.id].name : 'Unknown';
    const isCurrent = activeGame.players[activeGame.currentPlayerIndex].id === p.id;
    
    let medalClass = '';
    if (!isGameStart) {
      if (p.rank === 1) medalClass = 'medal-gold';
      else if (p.rank === 2) medalClass = 'medal-silver';
      else if (p.rank === 3) medalClass = 'medal-bronze';
    }
    
    let loserHtml = '';
    if (p.score === lowestScore && !isGameStart) {
      const activeClass = showLoserJoke ? 'active' : '';
      loserHtml = `
        <div class="loser-joke-container ${activeClass}">
          <div class="loser-joke-wrapper">
            <div class="loser-joke">
              <div class="loser-arrow">⬆</div>
              Cel mai Ghinionist :(
            </div>
          </div>
        </div>
      `;
    }
    
    let lastRoundHtml = '';
    if (activeGame.rounds.length > 0) {
      const lastRound = activeGame.rounds[activeGame.rounds.length - 1];
      const lastPts = lastRound.values ? lastRound.values[p.id] : (lastRound.delta ? lastRound.delta[p.id] : 0);
      
      if (lastPts !== undefined) {
        const sign = lastPts > 0 ? '+' : '';
        const colorClass = lastPts > 0 ? 'positive' : (lastPts < 0 ? 'negative' : 'neutral');
        const activeClass = showLastRoundScore ? 'active' : '';
        
        lastRoundHtml = `
          <div class="last-round-container ${activeClass}">
            <div class="last-round-wrapper">
              <div class="last-round-score ${colorClass}">
                Ultima rundă: ${sign}${lastPts}
              </div>
            </div>
          </div>
        `;
      }
    }
    
    let badgesHtml = roundsOrder.map(rt => {
      const count = p.available ? (p.available[rt] || 0) : 0;
      const statusClass = count > 0 ? 'available' : 'played';
      return `<span class="badge ${statusClass}">${roundInitials[rt]}</span>`;
    }).join('');
    
    const row = document.createElement('div');
    row.className = `player-card ${medalClass} ${isCurrent ? 'current-turn' : ''}`;
    row.id = `player-card-${p.id}`;
    
    let deltaHtml = '';
    if (p.lastDelta !== undefined && p.lastDelta !== 0) {
      const sign = p.lastDelta > 0 ? '+' : '';
      const deltaClass = p.lastDelta > 0 ? 'positive' : 'negative';
      deltaHtml = `<div class="delta ${deltaClass} show">${sign}${p.lastDelta}</div>`;
      delete p.lastDelta;
    }
    
    row.innerHTML = `
      <div class="player-card-header">
        <div class="rank">${index + 1}</div>
        <div class="name">${escapeHtml(name)}</div>
      </div>
      <div class="score-container">
        ${deltaHtml}
        <div class="score">${p.score}</div>
      </div>
      ${lastRoundHtml}
      ${loserHtml}
      <div class="games-left">${badgesHtml}</div>
    `;
    scoreboardList.appendChild(row);
  });
  
  if (orderChanged) {
    requestAnimationFrame(() => {
      Array.from(scoreboardList.children).forEach(child => {
        const oldRect = oldRects[child.id];
        if (oldRect) {
          const newRect = child.getBoundingClientRect();
          const dx = oldRect.left - newRect.left;
          const dy = oldRect.top - newRect.top;
          if (dx !== 0 || dy !== 0) {
            child.style.transform = `translate(${dx}px, ${dy}px)`;
            child.style.transition = 'none';
            requestAnimationFrame(() => {
              child.style.transform = '';
              child.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            });
          }
        }
      });
    });
  }

  // 2. Render Data Entry
  const activeGameEl = document.getElementById('activeGame');
  const html = [];

  if (isGameOver) {
    html.push('<div class="form-section" style="text-align:center;">');
    html.push('<h2>Clasament Final</h2>');
    sortedPlayers.forEach((p, i) => {
      const name = playersMap[p.id] ? playersMap[p.id].name : 'Unknown';
      html.push(`<div style="font-size:18px; margin:8px 0;">${i+1}. ${escapeHtml(name)} - <strong>${p.score}</strong></div>`);
    });
    html.push('<div class="mt-10"><button id="undoRoundBtnGlobal" class="small danger">Anulează ultima rundă</button></div>');
    html.push('</div>');
  } else if(!activeGame.selectedRoundType){
    const currPlayer = activeGame.players[activeGame.currentPlayerIndex];
    if(!currPlayer){
      html.push('<div class="muted">Jucător curent invalid.</div>');
    } else {
      const hasChoice = RENTZ_ROUNDS.some(r => (currPlayer.available && (Number(currPlayer.available[r.id]) || 0) > 0));
      html.push(`<h3>${playersMap[currPlayer.id].name}, alege jocul:</h3>`);
      if(hasChoice){
        html.push('<div style="display:flex; flex-wrap:wrap; gap:8px;">');
        RENTZ_ROUNDS.forEach(r=>{
          const availableCount = currPlayer.available[r.id] || 0;
          if(availableCount > 0){
            html.push(`<button class="roundChoice" data-round="${r.id}">${r.label}</button>`);
          }
        });
        html.push('</div>');
      } else {
        html.push('<div class="muted">Acest jucător nu are runde disponibile.</div>');
        html.push('<div class="mt-10"><button id="skipTurnBtn" class="small">Treci la următorul jucător</button></div>');
      }
      if(activeGame.rounds.length > 0){
        html.push('<div class="mt-10">');
        html.push('<button id="undoRoundBtnGlobal" class="small danger">Anulează ultima rundă</button>');
        html.push('</div>');
      }
    }
  } else {
    html.push('<h3 class="muted">Adaugă rundă</h3>');
    html.push('<div class="form-section">');
    html.push(`<div><strong>Runda: </strong> ${RENTZ_ROUNDS.find(r=>r.id===activeGame.selectedRoundType).label}</div>`);
    html.push('<div id="roundInputs"></div></div>');
    html.push('<div class="mt-10"><label style="user-select:none"><input type="checkbox" id="nvCheckbox" checked /> NV (scor dublu)</label></div>');
    html.push('<div id="roundError" class="error-text" style="display:none;"></div>');
    html.push('<div class="flex-gap mt-10">' +
              '<button id="addRoundBtn">Adaugă rundă</button>' +
              '<button id="undoRoundBtn" class="small" style="display:none;">Anulează ultima rundă</button>' +
              '<button id="cancelRoundBtn" class="small secondary">Renunță</button></div>');
  }

  activeGameEl.innerHTML = html.join('');

  if(activeGame.selectedRoundType){
    renderRentzRoundForm(activeGame.selectedRoundType);
  }

  // Add event listeners
  if(!activeGame.selectedRoundType){
    activeGameEl.querySelectorAll('.roundChoice').forEach(btn=>{
      btn.addEventListener('click', function(e){
        const chosenType = e.currentTarget.getAttribute('data-round') || btn.getAttribute('data-round');
        if(!chosenType) return;
        selectRoundType(chosenType);
      });
    });
  } else {
    document.getElementById('addRoundBtn').addEventListener('click', addRound);
    document.getElementById('undoRoundBtn').addEventListener('click', undoRound);
    document.getElementById('cancelRoundBtn').addEventListener('click', () => {
      const currPlayer = activeGame.players[activeGame.currentPlayerIndex];
      if(typeof currPlayer.available[activeGame.selectedRoundType] !== 'number'){
        currPlayer.available[activeGame.selectedRoundType] = 0;
      }
      currPlayer.available[activeGame.selectedRoundType] += 1;
      activeGame.selectedRoundType = null;
      renderActiveGame();
    });
  }

  const globalUndo = document.getElementById('undoRoundBtnGlobal');
  if(globalUndo){
    globalUndo.addEventListener('click', () => {
      undoRound();
    });
  }

  const skipBtn = document.getElementById('skipTurnBtn');
  if(skipBtn){
    skipBtn.addEventListener('click', () => {
      activeGame.currentPlayerIndex = (activeGame.currentPlayerIndex + 1) % activeGame.players.length;
      saveOrUpdateGame(activeGame);
      renderActiveGame();
    });
  }

  saveOrUpdateGame(activeGame);
}

// ==================== ADD ROUND ====================
function addRound(){
  if(!activeGame.selectedRoundType) return showError('roundError', 'Selectează un tip de rundă înainte de a continua.');
  const round = { id: uid('r'), values: {} };
  // store which player initiated this round so undo can restore availability correctly
  try{ round.playerId = activeGame.players[activeGame.currentPlayerIndex].id; }catch(e){ round.playerId = undefined; }
  const type = activeGame.selectedRoundType;
  round.type = type;
  const container = activeGameEl.querySelector('#roundInputs');
  const numPlayers = activeGame.players.length;

  // calculează câte pachete sunt necesare (8 cărți per jucător)
  const totalCardsNeeded = 8 * numPlayers;
  const decks = Math.max(1, Math.ceil(totalCardsNeeded / 52));

  // NV multiplier (dublu dacă e bifat)
  const nvCheckbox = document.getElementById('nvCheckbox');
  const nvMultiplier = nvCheckbox && nvCheckbox.checked ? 2 : 1;

  if(type==='dame'){
    const maxDame = 4 * decks;
    // colectează valorile și verifică fiecare în parte
    const vals = activeGame.players.map(p => {
      return parseInt(container.querySelector(`[data-input="${p.id}"]`).value || 0, 10) || 0;
    });
    const invalid = vals.some(v => v > maxDame);
    if(invalid){
       return showError('roundError', `Număr maxim permis pentru dame este ${maxDame}.`);
    }
    // verifică suma totală de dame
    const totalDame = vals.reduce((a,b)=>a+b,0);
    const requiredDame = 4 * decks;
    if(totalDame !== requiredDame){
      return showError('roundError', `Totalul dame trebuie să fie ${requiredDame} (pachete: ${decks}).`);
    }
    activeGame.players.forEach((p, idx)=>{
      const val = vals[idx];
      const pts = (-25 * val) * nvMultiplier;
      p.score += pts;
      p.lastDelta = pts;
      round.values[p.id] = pts;
    });
  } else if(type==='romburi'){
    const totalRomburi = activeGame.players.reduce((acc, p) => {
      return acc + parseInt(container.querySelector(`[data-input="${p.id}"]`).value || 0, 10);
    }, 0);
    const requiredRomburi = activeGame.players.length * 2 * decks;
    if(totalRomburi !== requiredRomburi){
      return showError('roundError', `Totalul romburilor trebuie să fie ${requiredRomburi} (pachete: ${decks}).`);
    }
    activeGame.players.forEach(p=>{
      const val = parseInt(container.querySelector(`[data-input="${p.id}"]`).value||0,10);
      const pts = (-20 * val) * nvMultiplier;
      p.score += pts;
      p.lastDelta = pts;
      round.values[p.id] = pts;
    });
  } else if(type==='totplus' || type==='totminus'){
    const totalRomburi = activeGame.players.reduce((acc, p) => {
        return acc + parseInt(container.querySelector(`[data-input="romburi_${p.id}"]`).value || "0", 10);
    }, 0);
    const totalMaini = activeGame.players.reduce((acc, p) => {
        return acc + parseInt(container.querySelector(`[data-input="maini_${p.id}"]`).value || "0", 10);
    }, 0);
    const totalDame = activeGame.players.reduce((acc, p) => {
        return acc + parseInt(container.querySelector(`[data-input="dame_${p.id}"]`).value || "0", 10);
    }, 0);

    const requiredRomburi = numPlayers * 2 * decks;
    const requiredDame = 4 * decks;
    const requiredMaini = 8 * decks;

    if(totalRomburi !== requiredRomburi || totalDame !== requiredDame || totalMaini !== requiredMaini){
        return showError('roundError', `Sume exacte necesare: Romburi: ${requiredRomburi} (pachete: ${decks}), Dame: ${requiredDame}, Maini: ${requiredMaini}.`);
    }
    const selectedPopa = container.querySelector('input[name="popa_tot"]:checked');
    if(!selectedPopa){
      return showError('roundError', 'Selectează jucătorul care a luat Popa.');
    }

    activeGame.players.forEach(p=>{
        let total = 0;
        const romburi = parseInt(container.querySelector(`[data-input="romburi_${p.id}"]`).value||0,10); total += romburi*20;
        const maini   = parseInt(container.querySelector(`[data-input="maini_${p.id}"]`).value||0,10); total += maini*10;
        const dame    = parseInt(container.querySelector(`[data-input="dame_${p.id}"]`).value||0,10); total += dame*25;
        let popa = false;
        if(selectedPopa && selectedPopa.value === p.id){
          popa = true;
        }
        if(popa) total += 100;
        if(type==='totminus') total = -total;
        const pts = total * nvMultiplier;
        p.score += pts;
        p.lastDelta = pts;
        round.values[p.id] = pts;
    });
  } else if(type==='popa'){
    const popaChecked = container.querySelectorAll('input[name="popa"]:checked');
    if(popaChecked.length !== 1){
      return showError('roundError', "Trebuie să selectezi exact un jucător pentru popa.");
    }
    const pid = popaChecked[0].value; 
    const player = activeGame.players.find(x=>x.id===pid);
    const pts = -100 * nvMultiplier;
    player.score += pts;
    player.lastDelta = pts;
    round.values[pid] = pts;
  } else if(type==='rentz'){
    const n = activeGame.players.length;
    // Verifică dacă fiecare jucător are un loc completat (între 1 și n)
    let allOk = true;
    const usedLocs = [];
    activeGame.players.forEach(p=>{
      const loc = parseInt(container.querySelector(`[data-input="rentz_${p.id}"]`).value,10);
      if (isNaN(loc) || loc < 1 || loc > n) {
        allOk = false;
      }
      usedLocs.push(loc);
    });
    // Verifică dacă toate locurile sunt unice
    const uniqueLocs = new Set(usedLocs.filter(l => !isNaN(l)));
    if (!allOk || uniqueLocs.size !== n) {
      return showError('roundError', "Toți jucătorii trebuie să aibă un loc unic, completat corect (de la 1 la " + n + ")!");
    }
    // Calculează scorurile
    activeGame.players.forEach(p=>{
      const loc = parseInt(container.querySelector(`[data-input="rentz_${p.id}"]`).value,10);
      const pts = ((n - loc) * 100) * nvMultiplier;
      p.score += pts;
      p.lastDelta = pts;
      round.values[p.id] = pts;
    });
  }

  activeGame.rounds.push(round); 
  activeGame.selectedRoundType = null;
  activeGame.currentPlayerIndex = (activeGame.currentPlayerIndex + 1) % activeGame.players.length;
  saveOrUpdateGame(activeGame); 
  renderActiveGame(); 
  renderHistory();
}

// ==================== UNDO ROUND ====================
function undoRound(){
  if(!activeGame) return;
  if(activeGame.rounds.length === 0)
    return showError('roundError', 'Nicio rundă de anulat');
  
  const last = activeGame.rounds.pop();
  activeGame.players.forEach(p => {
    if(last.values.hasOwnProperty(p.id)){
      p.score -= last.values[p.id];
    }
  });
  if(last.type){
    if(last.playerId){
      const pl = activeGame.players.find(p=>p.id===last.playerId);
      if(pl && pl.available && pl.available.hasOwnProperty(last.type)){
        pl.available[last.type] = (pl.available[last.type] || 0) + 1;
      }
    } else {
      // fallback: restore for everyone (backwards compatibility)
      activeGame.players.forEach(p=>{
        if(p.available && p.available.hasOwnProperty(last.type)){
           p.available[last.type] = (p.available[last.type] || 0) + 1;
        }
      });
    }
  }
  activeGame.currentPlayerIndex = (activeGame.currentPlayerIndex - 1 + activeGame.players.length) % activeGame.players.length;
  saveOrUpdateGame(activeGame);
  renderActiveGame();
  renderHistory();

  // Afișează notificare și derulează la partea de sus
  const notification = document.createElement('div');
  notification.textContent = 'Ultima rundă a fost anulată!';
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#ef4444';
  notification.style.color = '#fff';
  notification.style.padding = '15px 30px';
  notification.style.fontSize = '24px';
  notification.style.fontWeight = 'bold';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '9999';
  notification.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== SAVE/UPDATE GAME ====================
function saveOrUpdateGame(g){
  persistGame(g);
}

// ==================== HISTORY ====================
function renderHistory(){
  historyEl.innerHTML='<h3>Istoric jocuri</h3>';
  if(games.length===0){ historyEl.innerHTML+='<div class="muted">Niciun joc salvat</div>'; return; }
  const tbl=document.createElement('table');
  tbl.innerHTML='<thead><tr><th>Tip</th><th>Jucători</th><th>Runde</th><th>Acțiuni</th></tr></thead>';
  const tb=document.createElement('tbody');
  games.slice().reverse().forEach(g=>{
  const tr = document.createElement('tr'); // <-- Adaugă această linie!
  const playersNames = Array.isArray(g.players)
    ? g.players.map(p=>(players.find(x=>x.id===p.id)||{name:p.id}).name).join(', ')
    : '(joc corupt)';
  tr.innerHTML=`<td>${g.type}</td><td>${escapeHtml(playersNames)}</td><td>${g.rounds ? g.rounds.length : 0}</td>
    <td>
      <button class="small" data-load="${g.id}">încarcă</button>
      <button class="small" data-export="${g.id}">export</button>
      <button class="small danger" data-delgame="${g.id}">șterge</button>
    </td>`;
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); historyEl.appendChild(tbl);

  historyEl.querySelectorAll('[data-load]').forEach(b=>b.addEventListener('click', e=>{
    const id=e.target.getAttribute('data-load'); activeGame=games.find(x=>x.id===id); renderActiveGame();
  }));
  historyEl.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click', e=>{
    const id=e.target.getAttribute('data-export'); const g=games.find(x=>x.id===id); downloadJSON(g, `game_${g.id}.json`);
  }));
  historyEl.querySelectorAll('[data-delgame]').forEach(b=>b.addEventListener('click', e=>{
    const id=e.target.getAttribute('data-delgame'); 
    customConfirm('Ștergi jocul?', (yes) => {
      if(!yes) return;
      games = normalizeGamesList(load(KEY_GAMES, [])).filter(x=>x.id!==id);
      save(KEY_GAMES,games); if(activeGame&&activeGame.id===id) activeGame=null; renderHistory(); renderActiveGame();
    });
  }));
}

// ==================== EXPORT / IMPORT ====================
exportBtn.addEventListener('click', ()=>{ downloadJSON({players,games}, 'card_app_dump.json'); });
importBtn.addEventListener('click', ()=>{
  customPrompt('Lipește JSON exportat', '', (txt) => {
    if(!txt) return;
    try{
      const obj=JSON.parse(txt);
      if(obj.players && Array.isArray(obj.players)){
        players = obj.players.map(p => ({ id: p.id || uid('p'), name: p.name || 'Unknown' }));
      }
      if(obj.games && Array.isArray(obj.games)){
        games = normalizeGamesList(obj.games);
      }
      save(KEY_PLAYERS, players); save(KEY_GAMES, games);
      renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
      showError('playerNameError', 'Import OK');
    }catch(e){ showError('playerNameError', 'JSON invalid'); }
  });
});

// ==================== INIT ====================
renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();

function selectRoundType(chosenType){
  if(!chosenType) return;
   const currPlayer = activeGame.players[activeGame.currentPlayerIndex];
  const have = currPlayer && currPlayer.available && (Number(currPlayer.available[chosenType]) || 0);
  if(!currPlayer || have <= 0) return showError('roundError', 'Nu ai suficiente runde disponibile pentru acest tip.');
  // consumă o unitate din disponibilitate (dacă sunt mai multe pachete, vor rămâne)
  currPlayer.available[chosenType] = Math.max(0, have - 1);
   activeGame.selectedRoundType = chosenType;
   saveOrUpdateGame(activeGame);
   renderActiveGame();
}

function renderRentzRoundForm(selectedType){
  const container = activeGameEl.querySelector('#roundInputs');
  const playersMap = getPlayersMap();
  container.innerHTML='';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
  container.style.gap = '10px';
  
  if(selectedType==='dame' || selectedType==='romburi'){
    activeGame.players.forEach(p=>{
      container.innerHTML+=`<div class="player-input" style="margin-bottom:0;"><label>${playersMap[p.id].name}</label><input type="number" data-input="${p.id}" value="0"/></div>`;
    });
  } else if(selectedType==='popa'){
    activeGame.players.forEach(p=>{
      container.innerHTML+=`<div class="player-input" style="margin-bottom:0; display:flex;align-items:center;gap:6px;">
        <input type="radio" name="popa" value="${p.id}" id="popa_${p.id}"/>
        <label for="popa_${p.id}" style="margin:0;">${playersMap[p.id].name}</label>
      </div>`;
    });
  } else if(selectedType==='totplus' || selectedType==='totminus'){
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    activeGame.players.forEach(p=>{
      container.innerHTML += `<div class="player-input" style="margin-bottom:0;">
        <label>${playersMap[p.id].name}</label>
        <div class="flex-gap align-center" style="flex-wrap:wrap; margin-top:16px;">
          <input type="number" data-input="romburi_${p.id}" placeholder="Romburi" style="width:220px; margin:0;"/>
          <input type="number" data-input="maini_${p.id}" placeholder="Mâini" style="width:220px; margin:0;"/>
          <input type="number" data-input="dame_${p.id}" placeholder="Dame" style="width:220px; margin:0;"/>
          <label style="margin:0; display:flex; align-items:center; gap:16px;"><input type="radio" name="popa_tot" data-input="popa_${p.id}" value="${p.id}" id="popa_${p.id}"/> Popa</label>
        </div>
      </div>`;
    });
  } else if(selectedType==='rentz'){
    activeGame.players.forEach(p=>{
      container.innerHTML+=`<div class="player-input" style="margin-bottom:0;"><label>${playersMap[p.id].name}</label>
        <select data-input="rentz_${p.id}">
          <option value="">Selectează locul</option>
          ${activeGame.players.map((_,idx)=>`<option value="${idx+1}">Loc ${idx+1}</option>`).join('')}
        </select></div>`;
    });
  }
}

// Clean up games in localStorage (safe)
try{
  let games1 = JSON.parse(localStorage.getItem('cardApp_games_v1') || 'null');
  if(Array.isArray(games1)){
    games1 = games1.filter(g => g && Array.isArray(g.players));
    localStorage.setItem('cardApp_games_v1', JSON.stringify(games1));
  }
}catch(e){
  // ignore malformed storage
}

// ==================== SINCRONIZARE ÎNTRE FILE ====================
// Dacă altă filă (Rentz sau Whist) schimbă jucătorii sau jocurile, reîmprospătăm
// starea locală, ca să nu lucrăm pe o copie învechită și să o scriem peste.
window.addEventListener('storage', e => {
  if(e.key !== KEY_PLAYERS && e.key !== KEY_GAMES) return;
  reloadFromStorage();
  renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
});
