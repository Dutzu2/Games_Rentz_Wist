// whist.js - Manager Whist românesc

// ==================== CONSTANTE ====================
const WHIST_ROUNDS_META = {
  // folosit pentru afișări / labels
  name: 'Whist românesc'
};

// ==================== LOCAL STORAGE KEYS ====================
const KEY_PLAYERS = 'cardApp_players_v1';
const KEY_GAMES   = 'cardApp_games_v1';

// ==================== STATE ====================
let players = load(KEY_PLAYERS, []);
let games   = load(KEY_GAMES, []);
let activeGame = null;
let selectedOrder = []; // ordine / participanți la joc
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

// ==================== DOM ELEMENTS ====================
const playersList = document.getElementById('playersList');
const newPlayerName = document.getElementById('newPlayerName');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const playersCheckboxes = document.getElementById('playersCheckboxes');
const createGameBtn = document.getElementById('createGameBtn');
const gameTypeEl = document.getElementById('gameType'); // poate rămâne pentru compatibilitate
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
  catch(e){ return fallback; }
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

// ==================== PERSISTENȚĂ ÎNTRE FILE ====================
// Whist și Rentz împart aceleași chei de localStorage. Dacă o filă scrie întregul
// array pe care l-a citit la încărcare, șterge tot ce a salvat între timp cealaltă
// filă — jocuri care „dispar din senin". Fiecare scriere recitește întâi storage-ul.
function persistGame(g){
  const stored = load(KEY_GAMES, []);
  const list = Array.isArray(stored) ? stored : [];
  const idx = list.findIndex(x => x && x.id === g.id);
  if(idx >= 0) list[idx] = g; else list.push(g);
  games = list;
  save(KEY_GAMES, games);
}
function persistPlayers(mutate){
  const stored = load(KEY_PLAYERS, []);
  players = mutate(Array.isArray(stored) ? stored : []);
  save(KEY_PLAYERS, players);
}
function reloadFromStorage(){
  const sp = load(KEY_PLAYERS, []); players = Array.isArray(sp) ? sp : [];
  const sg = load(KEY_GAMES, []);   games   = Array.isArray(sg) ? sg : [];
  if(activeGame){
    const fresh = games.find(g => g.id === activeGame.id);
    activeGame = fresh || null;
  }
}

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

// ==================== HELP: GENERARE SECVENȚĂ MÂINI ====================
function generateDealSequence(numPlayers){
  // Conform paginii: start cu 1 repetat numPlayers, apoi 2..7 (o dată), apoi 8 repetat numPlayers,
  // apoi 7..2, apoi 1 repetat numPlayers (exemplu dat în articol pentru 4 jucători).
  const seq = [];
  for(let i=0;i<numPlayers;i++) seq.push(1);
  for(let k=2;k<=7;k++) seq.push(k);
  for(let i=0;i<numPlayers;i++) seq.push(8);
  for(let k=7;k>=2;k--) seq.push(k);
  for(let i=0;i<numPlayers;i++) seq.push(1);
  return seq;
}

// ==================== CREATE GAME ====================
createGameBtn.addEventListener('click', ()=> {
  if(selectedOrder.length < 3 || selectedOrder.length > 6) return showError('createGameError', 'Selectează între 3 și 6 jucători (ideal 4).');
  const participants = selectedOrder.slice(); // array of player ids
  const numPlayers = participants.length;
  const dealSequence = generateDealSequence(numPlayers); // numere de cărți per mână

  const g = {
    id: uid('g'),
    type: 'whist',
    players: participants.map(pid => ({ id: pid, score: 0 })),
    rounds: [], // istoricul rundelor (mâinilor)
    createdAt: Date.now(),
    currentDealIndex: 0,
    dealSequence, // lista de mânî (nr cărți) ce urmează
    dealerIndex: 0 // index în players - cine împarte (rotativ)
  };
  persistGame(g);
  activeGame = g; renderActiveGame(); renderHistory();
  selectedOrder = []; renderPlayersCheckboxes();
});

// ==================== LOAD / END GAME ====================
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
function renderActiveGame() {
  const adminView = document.getElementById('adminView');
  const gameView = document.getElementById('gameView');
  const goToGameBtn = document.getElementById('goToGameBtn');
  
  if (!activeGame) {
    adminView.style.display = 'grid';
    gameView.style.display = 'none';
    goToGameBtn.style.display = 'none';
    return;
  }
  
  goToGameBtn.style.display = 'inline-block';
  
  const playersMap = getPlayersMap();
  const numPlayers = activeGame.players.length;
  const dealNum = activeGame.dealSequence[activeGame.currentDealIndex] || null;
  const isGameOver = !dealNum;
  
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
    
    const row = document.createElement('div');
    row.className = `player-card ${medalClass}`;
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

  // Update Whist Info
  const whistInfo = document.getElementById('whistInfo');
  if (isGameOver) {
    whistInfo.innerHTML = `Joc finalizat`;
  } else {
    const dealerId = activeGame.players[activeGame.dealerIndex].id;
    const dealerName = playersMap[dealerId] ? playersMap[dealerId].name : 'Unknown';
    whistInfo.innerHTML = `Mâna ${activeGame.currentDealIndex + 1} / ${activeGame.dealSequence.length} &bull; ${dealNum} cărți &bull; Împarte: ${escapeHtml(dealerName)}`;
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
    html.push('<div class="mt-10"><button id="undoRoundBtn" class="small">Anulează ultima mână</button></div>');
    html.push('</div>');
  } else {
    html.push('<h3 class="muted">Adaugă mână</h3>');
    html.push('<div class="form-section">');
    html.push(`<div style="margin-bottom:10px;"><strong>Cărți:</strong> ${dealNum} ${dealNum===8? '(fără atu)' : ''}</div>`);
    html.push('<div id="dealFormInner" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">');
    
    // Reorder players starting from the one after the dealer
    const n = activeGame.players.length;
    const startIndex = (activeGame.dealerIndex + 1) % n;
    
    for(let i=0; i<n; i++) {
      const pIndex = (startIndex + i) % n;
      const p = activeGame.players[pIndex];
      const name = playersMap[p.id] ? playersMap[p.id].name : p.id;
      html.push(`<div class="player-input" style="margin-bottom: 0;">
        <label>${escapeHtml(name)}</label>
        <div class="flex-gap">
          <input type="number" min="0" max="${dealNum}" data-input="bid_${p.id}" placeholder="Licitație" />
          <input type="number" min="0" max="${dealNum}" data-input="tricks_${p.id}" placeholder="Levate" />
        </div>
      </div>`);
    }
    
    html.push('</div>');
    html.push('<div id="roundError" class="error-text" style="display:none;"></div>');
    html.push('<div class="flex-gap mt-10">' +
              '<button id="submitDealBtn">Finalizează mâna</button>' +
              '<button id="undoRoundBtn" class="small secondary">Anulează ultima mână</button></div>');
    html.push('</div>');
  }

  activeGameEl.innerHTML = html.join('');

  // event listeners
  const submitDealBtn = document.getElementById('submitDealBtn');
  if(submitDealBtn){
    submitDealBtn.addEventListener('click', (ev)=>{
      ev.preventDefault();
      submitCurrentDeal();
    });
  }
  const undoBtn = document.getElementById('undoRoundBtn');
  if(undoBtn) undoBtn.addEventListener('click', undoRound);

  saveOrUpdateGame(activeGame);
}

// ==================== SUBMIT DEAL (calculează scor pentru mâna curentă) ====================
function submitCurrentDeal(){
  if(!activeGame) return;
  const dealNum = activeGame.dealSequence[activeGame.currentDealIndex];
  if(typeof dealNum === 'undefined') return showError('roundError', 'Nu există mână curentă.');

  const container = activeGameEl.querySelector('#dealFormInner');
  if(!container) return;

  // colectează bids (licit) în ordine jucători; ultima intrare trebuie să respecte regula sumei != dealNum
  const bids = [];
  const tricks = [];
  for(const p of activeGame.players){
    const bidEl = container.querySelector(`[data-input="bid_${p.id}"]`);
    const trEl  = container.querySelector(`[data-input="tricks_${p.id}"]`);
    const bidVal = bidEl && bidEl.value!=='' ? parseInt(bidEl.value,10) : null;
    const trVal  = trEl && trEl.value!==''  ? parseInt(trEl.value,10) : null;
    if(bidVal === null || isNaN(bidVal) || bidVal < 0 || bidVal > dealNum) return showError('roundError', 'Completează toate licitațiile corect (între 0 și ' + dealNum + ').');
    if(trVal === null || isNaN(trVal) || trVal < 0 || trVal > dealNum) return showError('roundError', 'Completează toate levatele corect (între 0 și ' + dealNum + ').');
    bids.push(bidVal);
    tricks.push(trVal);
  }

  // regula: suma bids nu poate fi egală cu dealNum -> ultimul licitator trebuie sa nu permită egalitatea
  const sumBids = bids.reduce((a,b)=>a+b,0);
  if(sumBids === dealNum){
    return showError('roundError', 'Regula licitației: suma licitațiilor nu poate fi egală cu numărul de cărți distribuite. Ajustează ultima licitație.');
  }
  const sumtricks = tricks.reduce((a,b)=>a+b,0);
  if(sumtricks !== dealNum){
    return showError('roundError', 'Numărul total de levate realizate (' + sumtricks + ') nu corespunde cu numărul de cărți distribuite (' + dealNum + '). Verifică levatele.');
  }

  // calculează scoruri runda
  const round = { id: uid('r'), dealNumber: dealNum, bids: {}, tricks: {}, delta: {}, timestamp: Date.now() };
  activeGame.players.forEach((p, idx) => {
    const bidVal = bids[idx];
    const trVal  = tricks[idx];
    let pts = 0;
    if(trVal === bidVal){
      pts = 5 + trVal; // exact -> 5 + levate
    } else {
      // penalizare = diferență absolută (conform articol)
      const diff = Math.abs(trVal - bidVal);
      pts = -diff;
    }
    // actualizează scorul jucătorului
    p.score += pts;
    p.lastDelta = pts;
    round.bids[p.id] = bidVal;
    round.tricks[p.id] = trVal;
    round.delta[p.id] = pts;
  });

  // salvare rundă
  activeGame.rounds.push(round);
  activeGame.currentDealIndex = activeGame.currentDealIndex + 1;
  activeGame.dealerIndex = (activeGame.dealerIndex + 1) % activeGame.players.length;
  saveOrUpdateGame(activeGame);
  renderActiveGame();
  renderHistory();
}

// ==================== UNDO ROUND ====================
function undoRound(){
  if(!activeGame) return;
  if(activeGame.rounds.length === 0) return showError('roundError', 'Nicio rundă de anulat');

  const last = activeGame.rounds.pop();
  // readucem scorurile înapoi
  activeGame.players.forEach(p=>{
    if(last.delta && last.delta.hasOwnProperty(p.id)){
      p.score -= last.delta[p.id];
    }
  });
  // revenim la dealIndex anterior
  activeGame.currentDealIndex = Math.max(0, activeGame.currentDealIndex - 1);
  activeGame.dealerIndex = (activeGame.dealerIndex - 1 + activeGame.players.length) % activeGame.players.length;
  saveOrUpdateGame(activeGame);
  renderActiveGame();
  renderHistory();
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
  tbl.innerHTML='<thead><tr><th>Tip</th><th>Jucători</th><th>Runde jucate</th><th>Acțiuni</th></tr></thead>';
  const tb=document.createElement('tbody');
  games.slice().reverse().forEach(g=>{
    const tr = document.createElement('tr');
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
      games=(load(KEY_GAMES,[])||[]).filter(x=>x&&x.id!==id); save(KEY_GAMES,games); if(activeGame&&activeGame.id===id) activeGame=null; renderHistory(); renderActiveGame();
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
      if(obj.players) players=obj.players;
      if(obj.games) games=obj.games;
      save(KEY_PLAYERS, players); save(KEY_GAMES, games);
      renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
      showError('playerNameError', 'Import OK');
    }catch(e){ showError('playerNameError', 'JSON invalid'); }
  });
});

// ==================== INIT ====================
renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();

// ==================== SINCRONIZARE ÎNTRE FILE ====================
// Dacă altă filă (Rentz sau Whist) schimbă jucătorii sau jocurile, reîmprospătăm
// starea locală, ca să nu lucrăm pe o copie învechită și să o scriem peste.
window.addEventListener('storage', e => {
  if(e.key !== KEY_PLAYERS && e.key !== KEY_GAMES) return;
  reloadFromStorage();
  renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
});
