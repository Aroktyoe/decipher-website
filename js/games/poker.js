// Didn't look into this




// let currentPokerTable = null;
// let playerId = null; // will be assigned from your /me fetch

// async function createPokerTable() {
//   const buyIn = parseInt(document.getElementById('poker-buyin').value) || 0;
//   const type = buyIn > 0 ? 'buyin' : 'casual';

//   const res = await fetch('/holdem/create-table', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'X-CSRF-TOKEN': getCSRFToken()
//     },
//     credentials: 'include',
//     body: JSON.stringify({ type, buy_in: buyIn })
//   });

//   const data = await res.json();
//   if (res.ok) {
//     alert(`Table created! Table ID: ${data.table_id}`);
//     currentPokerTable = data.table_id;
//     renderPokerTable();
//     fetchPokerState();  // <-- ADD THIS
//   } else {
//     alert(data.msg || 'Failed to create table.');
//   }
// }

// async function joinPokerTable() {
//     const tableId = document.getElementById('join-table-id').value.trim();
//     if (!tableId) return alert('Enter a table ID.');
  
//     const res = await fetch('/holdem/join-table', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-CSRF-TOKEN': getCSRFToken()
//       },
//       credentials: 'include',
//       body: JSON.stringify({ table_id: tableId })
//     });
  
//     const data = await res.json();
//     if (res.ok) {
//       alert('Joined table successfully!');
//       currentPokerTable = tableId;
//       renderPokerTable();
//       fetchPokerState();
//     } else {
//       alert(data.msg || 'Failed to join table.');
//     }
//   }
  
//   function renderPokerTable() {
//     const container = document.getElementById('poker-table');
//     container.innerHTML = `
//       <div style="position: relative; width: 600px; height: 400px; background: green; border-radius: 50%; margin: 20px auto; box-shadow: 0 0 30px black inset;">
//         <div id="community-cards" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; gap: 10px;"></div>
//         <div id="pot" style="position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; color: white;">$0</div>
  
//         <div id="opponents" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
  
//         <div id="player-hand" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px;"></div>
//       </div>
  
//       <div id="poker-actions" style="margin-top: 20px;"></div>
//     `;
  
//     // Fetch game state every 3 seconds
//     setInterval(fetchPokerState, 3000);
//   }
  
//   async function fetchPokerState() {
//     if (!currentPokerTable) return;
  
//     const res = await fetch(`/holdem/table-state/${currentPokerTable}`, { credentials: 'include' });
//     const data = await res.json();
//     if (!res.ok) return;
  
//     updatePokerUI(data);
//   }
  
//   function updatePokerUI(game) {
//     document.getElementById('community-cards').innerHTML = game.community_cards.map(c => renderCard(c)).join('');
//     document.getElementById('pot').textContent = `$${game.pot}`;
  
//     // Render opponents
//     const opponents = Object.entries(game.players).filter(([id, _]) => id !== playerId);
//     const oppDiv = document.getElementById('opponents');
//     oppDiv.innerHTML = '';
  
//     const angleStep = 360 / (opponents.length || 1);
  
//     opponents.forEach(([id, p], idx) => {
//       const angle = idx * angleStep;
//       const x = 250 * Math.cos(angle * Math.PI/180);
//       const y = 150 * Math.sin(angle * Math.PI/180);
  
//       const opp = document.createElement('div');
//       opp.style.position = 'absolute';
//       opp.style.left = `calc(50% + ${x}px)`;
//       opp.style.top = `calc(50% + ${y}px)`;
//       opp.style.transform = 'translate(-50%, -50%)';
//       opp.style.color = 'white';
//       opp.innerHTML = `<div>🂠 🂠<br>$${p.chips}</div>`;
//       oppDiv.appendChild(opp);
//     });
  
//     // Render player's hand
//     const player = game.players[playerId];
//     if (player) {
//       document.getElementById('player-hand').innerHTML = player.cards.map(c => renderCard(c)).join('');
//     }
  
//     // Render action buttons if it's player's turn
//     const actionDiv = document.getElementById('poker-actions');
//     if (game.current_turn === playerId && !game.game_over) {
//       actionDiv.innerHTML = `
//         <button class="button6" onclick="sendPokerAction('check')">Check</button>
//         <button class="button6" onclick="sendPokerAction('bet')">Bet</button>
//         <button class="button6" onclick="sendPokerAction('fold')">Fold</button>
//       `;
//     } else {
//       actionDiv.innerHTML = `<div>Waiting for opponents...</div>`;
//     }
//   }
  
//   async function sendPokerAction(action) {
//     const res = await fetch('/casino/play/poker/action', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-CSRF-TOKEN': getCSRFToken()
//       },
//       credentials: 'include',
//       body: JSON.stringify({ action })
//     });
  
//     const data = await res.json();
//     if (!res.ok) alert(data.msg || 'Action failed');
//   }
  
//   function renderCard(card) {
//     if (!card) return '';
//     return `<div style="width:40px;height:60px;background:white;color:black;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;">${card}</div>`;
//   }