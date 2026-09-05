// ==================== CONSTANTE ====================
const RENTZ_ROUNDS = [
  { id: 'dame', label: 'Dame (-25 fiecare)' },
  { id: 'popa', label: 'Popa (-100)' },
  { id: 'romburi', label: 'Romburi (-20 fiecare)' },
  { id: 'totplus', label: 'Totale plus' },
  { id: 'totminus', label: 'Totale minus' },
  { id: 'rentz', label: 'Rentz (+/- în funcție de poziție)' }
];

// ==================== LOCAL STORAGE KEYS ====================
const KEY_PLAYERS = 'cardApp_players_v1';
const KEY_GAMES = 'cardApp_games_v1';

// ==================== STATE ====================
let players = load(KEY_PLAYERS, []);
let games = load(KEY_GAMES, []);
let activeGame = null;
let selectedOrder = [];

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
    if(!g || typeof g !== 'object') g = { id: uid('g'), players: [], rounds: [] };
    if(!Array.isArray(g.players)) g.players = [];
    // preserve per-player availability default (1 each)
    g.players.forEach(p=> ensurePlayerAvailable(p));
    if(!Array.isArray(g.rounds)) g.rounds = [];
    return g;
  });
}

// apply normalization right after load
players = Array.isArray(players) ? players.map(p => ({ id: p.id || uid('p'), name: p.name || 'Unknown' })) : [];
games = normalizeGamesList(games);
save(KEY_PLAYERS, players);
save(KEY_GAMES, games);

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

  // events
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

// ==================== GAME FUNCTIONS ====================
createGameBtn.addEventListener('click', ()=> {
  if(selectedOrder.length < 3) return alert('Selectează cel puțin 3 jucători');
  const gType = gameTypeEl.value;
  if(gType !== 'rentz') return alert('Acest fișier suportă doar jocul Rentz!');
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
  games.push(g); save(KEY_GAMES, games);
  activeGame = g; renderActiveGame(); renderHistory();
  selectedOrder = []; renderPlayersCheckboxes();
});

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
    activeGameEl.innerHTML='<div class="muted">Niciun joc activ. Creează unul.</div>'; 
    return; 
  }
  const playersMap = getPlayersMap();
  const roundsOrder = ['dame','popa','romburi','totplus','totminus','rentz'];
  const roundsLabels = { dame: "Dame", popa: "Popa", romburi: "Romburi", totplus: "Totale plus", totminus: "Totale minus", rentz: "Rentz" };

  const html = [];
  html.push(`<div style="display:flex;justify-content:space-between;align-items:center">
    <div><strong>Joc:</strong> ${activeGame.type.toUpperCase()}</div>
    <div class="muted">id: ${activeGame.id}</div>
  </div>`);

  // Tabel scoruri + available rounds
  html.push('<div style="margin-top:8px"><table><thead><tr><th>Jucător</th><th>Scor</th><th>Jocuri</th></tr></thead><tbody>');
  activeGame.players.forEach(p=>{
    const name = playersMap[p.id] ? playersMap[p.id].name : 'Unknown';
    let availStr = '';
    if(p.available){
      availStr = roundsOrder.map(rt=>{
        const count = p.available[rt] || 0;
        return count > 0 ? roundsLabels[rt] : '';
      }).filter(letter => letter !== '').join(" | ");
    }
    html.push(`<tr data-player="${p.id}">
      <td>${escapeHtml(name)}</td>
      <td class="scoreCell">${p.score}</td>
      <td class="availableCell">${availStr}</td>
    </tr>`);
  });
  html.push('</tbody></table></div>');

  // Selectare tip rundă
  if(!activeGame.selectedRoundType){
    const currPlayer = activeGame.players[activeGame.currentPlayerIndex];
    if(!currPlayer){
      html.push('<div style="margin-top:12px; padding:8px; border:1px solid #ccc; border-radius:4px">');
      html.push('<div class="muted">Jucător curent invalid.</div>');
      html.push('</div>');
      activeGameEl.innerHTML = html.join('');
      return;
    }
    const hasChoice = RENTZ_ROUNDS.some(r => (currPlayer.available && (Number(currPlayer.available[r.id]) || 0) > 0));
    html.push('<div style="margin-top:12px; padding:8px; border:1px solid #ccc; border-radius:4px">');
    html.push(`<h3>${playersMap[currPlayer.id].name}, alege jocul pe care-l joci:</h3>`);
    if(hasChoice){
      RENTZ_ROUNDS.forEach(r=>{
        const availableCount = currPlayer.available[r.id] || 0;
        if(availableCount > 0){
          html.push(`<button class="roundChoice" data-round="${r.id}" style="margin-right:8px">
                       ${roundsLabels[r.id]}
                     </button>`);
        }
      });
    } else {
      html.push('<div class="muted">Acest jucător nu are runde disponibile.</div>');
      html.push('<div style="margin-top:8px"><button id="skipTurnBtn" class="small">Treci la următorul jucător</button></div>');
    }
    html.push('</div>');
    if(activeGame.rounds.length > 0){
      html.push('<div style="margin-top:8px">');
      html.push('<button id="undoRoundBtnGlobal" class="small" style="background:#f44336;color:#fff;padding:4px 8px;border:none;border-radius:4px;">Anulează ultima rundă</button>');
      html.push('</div>');
    }
  }
  else {
    // Formularul de rundă
    html.push('<div style="margin-top:10px"><h3 class="muted">Adaugă rundă</h3>');
    html.push('<div class="form-section">');
    html.push(`<div><strong>Runda: </strong> ${RENTZ_ROUNDS.find(r=>r.id===activeGame.selectedRoundType).label}</div>`);
    html.push('<div id="roundInputs"></div></div>');
    // NV checkbox (scor dublu)
    html.push('<div style="margin-top:8px"><label style="user-select:none"><input type="checkbox" id="nvCheckbox" checked /> NV (scor dublu)</label></div>');
    html.push('<div style="display:flex;gap:8px;margin-top:8px">' +
              '<button id="addRoundBtn">Adaugă rundă</button>' +
              '<button id="undoRoundBtn" class="small" style="visibility: hidden;">Anulează ultima rundă</button>' +
              '<button id="cancelRoundBtn" class="small">Renunță la rundă</button></div>');
  }

  html.push('</div>');
  activeGameEl.innerHTML = html.join('');

  if(activeGame.selectedRoundType){
    renderRentzRoundForm(activeGame.selectedRoundType);
  }

  // Add event listeners
  if(!activeGame.selectedRoundType){
    activeGameEl.querySelectorAll('.roundChoice').forEach(btn=>{
      // folosește currentTarget/btn pentru a te asigura că obții atributul corect
      btn.addEventListener('click', function(e){
        const chosenType = e.currentTarget.getAttribute('data-round') || btn.getAttribute('data-round');
        if(!chosenType) return; // protecție
        selectRoundType(chosenType);
      });
    });
  }
  else {
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
  if(!activeGame.selectedRoundType) return alert('Selectează un tip de rundă înainte de a continua.');
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
       alert(`Număr maxim permis pentru dame este ${maxDame}.`);
       return;
    }
    // verifică suma totală de dame
    const totalDame = vals.reduce((a,b)=>a+b,0);
    const requiredDame = 4 * decks;
    if(totalDame !== requiredDame){
      alert(`Totalul dame trebuie să fie ${requiredDame} (pachete: ${decks}).`);
      return;
    }
    activeGame.players.forEach((p, idx)=>{
      const val = vals[idx];
      const pts = (-25 * val) * nvMultiplier;
      p.score += pts;
      round.values[p.id] = pts;
    });
  } else if(type==='romburi'){
    const totalRomburi = activeGame.players.reduce((acc, p) => {
      return acc + parseInt(container.querySelector(`[data-input="${p.id}"]`).value || 0, 10);
    }, 0);
    const requiredRomburi = activeGame.players.length * 2 * decks;
    if(totalRomburi !== requiredRomburi){
      alert(`Totalul romburilor trebuie să fie ${requiredRomburi} (pachete: ${decks}).`);
      return;
    }
    activeGame.players.forEach(p=>{
      const val = parseInt(container.querySelector(`[data-input="${p.id}"]`).value||0,10);
      const pts = (-20 * val) * nvMultiplier;
      p.score += pts;
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
      alert(`Sume exacte necesare: Romburi: ${requiredRomburi} (pachete: ${decks}), Dame: ${requiredDame}, Maini: ${requiredMaini}.`);
        return;
    }
    const selectedPopa = container.querySelector('input[name="popa_tot"]:checked');

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
        round.values[p.id] = pts;
    });
  } else if(type==='popa'){
    const popaChecked = container.querySelectorAll('input[name="popa"]:checked');
    if(popaChecked.length !== 1){
      alert("Trebuie să selectezi exact un jucător pentru popa.");
      return;
    }
    const pid = popaChecked[0].value; 
    const player = activeGame.players.find(x=>x.id===pid);
    const pts = -100 * nvMultiplier;
    player.score += pts;
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
      alert("Toți jucătorii trebuie să aibă un loc unic, completat corect (de la 1 la " + n + ")!");
      return;
    }
    // Calculează scorurile
    activeGame.players.forEach(p=>{
      const loc = parseInt(container.querySelector(`[data-input="rentz_${p.id}"]`).value,10);
      const pts = ((n - loc) * 100) * nvMultiplier;
      p.score += pts;
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
  if(activeGame.rounds.length === 0)
    return alert('Nicio rundă de anulat');
  
  const last = activeGame.rounds.pop();
  activeGame.players.forEach(p => {
    if(last.values.hasOwnProperty(p.id)){
      p.score -= last.values[p.id];
    }
  });
  if(last.type){
    // restore availability for the player who initiated the round (if known)
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
  notification.style.top = '10px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#4caf50';
  notification.style.color = '#fff';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '9999';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if(obj.players && Array.isArray(obj.players)){
      // normalize players list (keep id+name)
      players = obj.players.map(p => ({ id: p.id || uid('p'), name: p.name || 'Unknown' }));
    }
    if(obj.games && Array.isArray(obj.games)){
      // normalize imported games so availability & rounds are sane
      games = normalizeGamesList(obj.games);
    }
    save(KEY_PLAYERS, players); save(KEY_GAMES, games);
    renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();
    alert('Import OK');
  }catch(e){ alert('JSON invalid'); }
});

// ==================== INIT ====================
renderPlayers(); renderPlayersCheckboxes(); renderHistory(); renderActiveGame();

function selectRoundType(chosenType){
  if(!chosenType) return;
   const currPlayer = activeGame.players[activeGame.currentPlayerIndex];
  const have = currPlayer && currPlayer.available && (Number(currPlayer.available[chosenType]) || 0);
  if(!currPlayer || have <= 0) return alert('Nu ai suficiente runde disponibile pentru acest tip.');
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
  if(selectedType==='dame' || selectedType==='romburi'){
    activeGame.players.forEach(p=>{
      container.innerHTML+=`<label>${playersMap[p.id].name}</label><input type="number" data-input="${p.id}" value="0"/>`;
    });
  } else if(selectedType==='popa'){
    activeGame.players.forEach(p=>{
      container.innerHTML+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <input type="radio" name="popa" value="${p.id}" id="popa_${p.id}"/>
        <label for="popa_${p.id}">${playersMap[p.id].name}</label>
      </div>`;
    });
  } else if(selectedType==='totplus' || selectedType==='totminus'){
    activeGame.players.forEach(p=>{
      container.innerHTML += `<div style="margin-bottom:6px">
        <label>${playersMap[p.id].name}</label><br>
        Romburi:<input type="number" data-input="romburi_${p.id}" value="" style="width:50px"/>
        Maini:<input type="number" data-input="maini_${p.id}" value="" style="width:50px"/>
        Dame:<input type="number" data-input="dame_${p.id}" value="" style="width:50px"/>
        Popa:<input type="radio" name="popa_tot" data-input="popa_${p.id}" value="${p.id}" id="popa_${p.id}"/>
        </div>`;
    });
  } else if(selectedType==='rentz'){
  activeGame.players.forEach(p=>{
    container.innerHTML+=`<div style="margin-bottom:6px"><label>${playersMap[p.id].name}</label>
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

