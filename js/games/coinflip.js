import { fetchBalance, getCSRFToken } from "../api.js";
import { startCooldown } from "../utils.js";



export async function playCoinflip(event) {
    if (cooldown) return;
    startCooldown(event.target);
    
    const amount = parseInt(document.getElementById('coinflip-bet').value);
    const choice = document.getElementById('coinflip-side').value;
    if (!amount || amount <= 0) return alert('Enter a valid bet amount.');
  
    const token = getCSRFToken();
    const res = await fetch('/casino/coinflip/create', { // <-- FIXED
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token
      },
      credentials: 'include',
      body: JSON.stringify({ amount, choice })
    });
  
    const data = await res.json();
    document.getElementById('coinflip-result').textContent = data.status === 'ok' ? "✅ Coinflip created!" : (data.msg || "❌ Something went wrong.");
    loadOpenCoinflips();
}

export async function loadOpenCoinflips() {
    const res = await fetch('/casino/coinflip/list', { credentials: 'include' });
    const flips = await res.json();
    const container = document.getElementById('open-coinflips');
    if (!Array.isArray(flips) || !container) return;

    if (flips.length === 0) {
        container.innerHTML = "No open coinflips right now.";
        return;
    }

    container.innerHTML = flips.map(flip => {
        const isCreator = currentUsername && flip.creator?.toLowerCase() === currentUsername.toLowerCase();
        return `
        <div style="margin-bottom: 10px;">
            ${flip.creator} bet $${flip.amount.toLocaleString()} on ${flip.choice.toUpperCase()}
            ${isCreator 
            ? `<button onclick="removeCoinflip('${flip.id}')" class="button6" style="margin-left:10px;">Remove</button>`
            : `<button onclick="joinCoinflip('${flip.id}')" class="button6" style="margin-left:10px;">Join</button>`
            }
        </div>
        `;
    }).join('');
}

export async function removeCoinflip(id) {
  const token = getcsRFToken();
  const res = await fetch('/casino/coinflip/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': token
    },
    credentials: 'include',
    body: JSON.stringify({ flip_id: id })
  });

  const data = await res.json();
  if (data.status === 'ok') {
    loadOpenCoinflips();
    fetchBalance();
    updateLeaderboard();
  } else {
    alert(data.msg || "Error");
  }
}

export async function joinCoinflip(id) {
  const token = getCSRFToken();
  const res = await fetch('/casino/coinflip/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': token
    },
    credentials: 'include',
    body: JSON.stringify({ id })
  });

  const data = await res.json();
  if (data.status === 'ok') {
    // Server will emit 'coinflip_result' after delay
    updateLeaderboard();
    loadOpenCoinflips();
  } else {
    alert(data.msg || "Error");
  }
}

export function showCoinflipAnimation(result, winner) {
    console.log("🏅 Coinflip animation triggered:", { result, winner, currentUsername });
  
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '50%';
    wrapper.style.left = '50%';
    wrapper.style.transform = 'translate(-50%, -50%)';
    wrapper.style.background = 'rgba(30,30,30,0.95)';
    wrapper.style.border = '2px solid #bb86fc';
    wrapper.style.borderRadius = '16px';
    wrapper.style.padding = '40px';
    wrapper.style.zIndex = '9999';
    wrapper.style.textAlign = 'center';
    wrapper.style.boxShadow = '0 0 30px rgba(0,0,0,0.5)';
  
    const container = document.createElement('div');
    container.id = 'coin';
    container.className = result === 'heads' ? 'heads' : 'tails';
    container.style.margin = '0 auto';
  
    const sideA = document.createElement('div');
    sideA.className = 'side-a';
    const sideB = document.createElement('div');
    sideB.className = 'side-b';
  
    container.appendChild(sideA);
    container.appendChild(sideB);
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);
  
    setTimeout(() => {
      const resultText = document.createElement('div');
      const isWinner = currentUsername && winner && currentUsername.toLowerCase() === winner.toLowerCase();
      resultText.textContent = `${result?.toUpperCase() || '???'} – ${isWinner ? '✅ You win!' : `❌ ${winner || '???'} wins.`}`;
      resultText.style.color = '#fff';
      resultText.style.fontWeight = 'bold';
      resultText.style.fontSize = '1.5rem';
      resultText.style.marginTop = '30px';
      resultText.style.textAlign = 'center';
      wrapper.appendChild(resultText);
  
      setTimeout(() => {
        wrapper.remove();
      }, 5000);
    }, 3000);
}