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
      <div style="display:flex;gap:8px">
        <button class="small" data-edit="${p.id}">Editează</button>
        <button class="small danger" data-del="${p.id}">Șterge</button>
      </div>`;
    playersList.appendChild(div);
  });

  playersList.querySelectorAll('[data-del]').forEach(btn=> btn.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-del');
    if(!confirm('Ștergi jucătorul?')) return;
    players = players.filter(x=>x.id!==id);
    save(KEY_PLAYERS, players); renderPlayers(); renderPlayersCheckboxes();
  }));
  playersList.querySelectorAll('[data-edit]').forEach(btn=> btn.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-edit');
    const p = players.find(x=>x.id===id);
    const newName = prompt('Schimbă numele jucătorului', p.name);
    if(newName && newName.trim()){ p.name=newName.trim(); save(KEY_PLAYERS, players); renderPlayers(); renderPlayersCheckboxes(); }
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
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
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
  if(!name) return alert('Scrie un nume!');
  players.push({ id: uid('p'), name });
  save(KEY_PLAYERS, players);
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
  if(selectedOrder.length < 3 || selectedOrder.length > 6) return alert('Selectează între 3 și 6 jucători (ideal 4).');
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
  games.push(g); save(KEY_GAMES, games);
  activeGame = g; renderActiveGame(); renderHistory();
  selectedOrder = []; renderPlayersCheckboxes();
});

// ==================== LOAD / END GAME ====================
loadLastGameBtn.addEventListener('click', ()=>{
  if(games.length===0) return alert('Nu există jocuri salvate');
  activeGame = games[games.length-1]; renderActiveGame();
});
endGameBtn.addEventListener('click', ()=>{
  if(!activeGame) return alert('Nu e niciun joc activ');
  if(!confirm('Finalizezi jocul curent?')) return;
  activeGame=null; renderActiveGame();
});

// ==================== RENDER ACTIVE GAME ====================
function renderActiveGame(){
  activeGameEl.innerHTML='';
  if(!activeGame){
    activeGameEl.innerHTML=`<div class="muted">Niciun joc activ. Creează unul (Whist românesc).</div>`;
    return;
  }
  const playersMap = getPlayersMap();
  const numPlayers = activeGame.players.length;
  const dealNum = activeGame.dealSequence[activeGame.currentDealIndex] || null;

  const html = [];
  html.push(`<div style="display:flex;justify-content:space-between;align-items:center">
    <div><strong>Joc:</strong> ${WHIST_ROUNDS_META.name.toUpperCase()}</div>
    <div class="muted">id: ${activeGame.id}</div>
  </div>`);

  // scoruri tabel
  html.push('<div style="margin-top:8px"><table><thead><tr><th>Jucător</th><th>Scor</th></tr></thead><tbody>');
  activeGame.players.forEach(p=>{
    const name = playersMap[p.id] ? playersMap[p.id].name : 'Unknown';
    html.push(`<tr data-player="${p.id}">
      <td>${escapeHtml(name)}</td>
      <td class="scoreCell">${p.score}</td>
    </tr>`);
  });
  html.push('</tbody></table></div>');

  // Informații mână curentă
  html.push('<div style="margin-top:10px; padding:10px; border:1px solid #ccc; border-radius:6px">');
  html.push(`<h3>Mâna curentă: ${activeGame.currentDealIndex + 1} / ${activeGame.dealSequence.length}</h3>`);
  if(dealNum){
    html.push(`<div><strong>Număr cărți distribuite:</strong> ${dealNum} ${dealNum===8? '(fără atu)' : ''}</div>`);
  } else {
    html.push('<div class="muted">Toate mâinile au fost jucate.</div>');
  }

  // Formular: introdu licitațiile și levatele realizate pentru această mână
  if(dealNum){
    html.push('<div id="dealForm" style="margin-top:8px">');
    html.push('<form id="dealFormInner">');
    activeGame.players.forEach((p, idx)=> {
      const name = playersMap[p.id] ? playersMap[p.id].name : p.id;
      html.push(`<div style="margin-bottom:6px">
        <label style="display:inline-block; width:160px">${escapeHtml(name)}</label>
        Licitație: <input type="number" min="0" max="${dealNum}" data-input="bid_${p.id}" value="" style="width:60px"/>
        Levate: <input type="number" min="0" max="${dealNum}" data-input="tricks_${p.id}" value="" style="width:60px"/>
      </div>`);
    });
    html.push('<div style="margin-top:8px"><button id="submitDealBtn">Finalizează mâna</button> <button id="undoRoundBtn" class="small" type="button">Anulează ultima mână</button></div>');
    html.push('</form></div>');
  } else {
    html.push('<div style="margin-top:8px"><button id="undoRoundBtn" class="small">Anulează ultima mână</button></div>');
  }

  html.push('</div>'); // end card

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
  if(typeof dealNum === 'undefined') return alert('Nu există mână curentă.');

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
    if(bidVal === null || isNaN(bidVal) || bidVal < 0 || bidVal > dealNum) return alert('Completează toate licitațiile corect (între 0 și ' + dealNum + ').');
    if(trVal === null || isNaN(trVal) || trVal < 0 || trVal > dealNum) return alert('Completează toate levatele corect (între 0 și ' + dealNum + ').');
    bids.push(bidVal);
    tricks.push(trVal);
  }

  // regula: suma bids nu poate fi egală cu dealNum -> ultimul licitator trebuie sa nu permită egalitatea
  const sumBids = bids.reduce((a,b)=>a+b,0);
  if(sumBids === dealNum){
    return alert('Regula licitației: suma licitațiilor nu poate fi egală cu numărul de cărți distribuite. Ajustează ultima licitație.');
  }
  const sumtricks = tricks.reduce((a,b)=>a+b,0);
  if(sumtricks !== dealNum){
    return alert('Numărul total de levate realizate (' + sumtricks + ') nu corespunde cu numărul de cărți distribuite (' + dealNum + '). Verifică levatele.');
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
    round.bids[p.id] = bidVal;
    round.tricks[p.id] = trVal;
    round.delta[p.id] = pts;
  });

  // salvare rundă
  activeGame.rounds.push(round);
  activeGame.currentDealIndex = activeGame.currentDealIndex + 1;
  saveOrUpdateGame(activeGame);
  renderActiveGame();
  renderHistory();
}

// ==================== UNDO ROUND ====================
function undoRound(){
  if(!activeGame) return alert('Nu e niciun joc activ');
  if(activeGame.rounds.length === 0) return alert('Nicio rundă de anulat');

  const last = activeGame.rounds.pop();
  // readucem scorurile înapoi
  activeGame.players.forEach(p=>{
    if(last.delta && last.delta.hasOwnProperty(p.id)){
      p.score -= last.delta[p.id];
    }
  });
  // revenim la dealIndex anterior
  activeGame.currentDealIndex = Math.max(0, activeGame.currentDealIndex - 1);
  saveOrUpdateGame(activeGame);
  renderActiveGame();
  renderHistory();

  // notificare
  const notification = document.createElement('div');
  notification.textContent = 'Ultima mână a fost anulată!';
  notification.style.position = 'fixed';
  notification.style.top = '10px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#4caf50';
  notification.style.color = '#fff';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '9999';
  document.body.appendChild(notification);
  setTimeout(()=>notification.remove(), 3000);
}

// ==================== SAVE/UPDATE GAME ====================
function saveOrUpdateGame(g){
  const idx = games.findIndex(x=>x.id===g.id);
  if(idx>=0) games[idx]=g; else games.push(g);
  save(KEY_GAMES, games);
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
    const id=e.target.getAttribute('data-delgame'); if(!confirm('Ștergi jocul?')) return;
    games=games.filter(x=>x.id!==id); save(KEY_GAMES,games); if(activeGame&&activeGame.id===id) activeGame=null; renderHistory(); renderActiveGame();
  }));
}

// ==================== EXPORT / IMPORT ====================
exportBtn.addEventListener('click', ()=>{ downloadJSON({players,games}, 'card_app_dump.json'); });
importBtn.addEventListener('click', ()=>{
  const txt = prompt('Lipește JSON exportat');
  try{
    const obj=JSON.parse(txt);
    if(obj.players) players=obj.players;
    if(obj.games) games=obj.games;
    save(KEY_PLAYERS, players); save(KEY_GAMES, games);
    renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
    alert('Import OK');
  }catch(e){ alert('JSON invalid'); }
});

// ==================== INIT ====================
renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
