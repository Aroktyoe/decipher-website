import { getCSRFToken } from "../api.js";
import { delayedBalanceUpdate } from "../utils.js";

export async function playSlots(event) {
    if (cooldown) return;
    cooldown = true;
    const button = event.target;
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
    setTimeout(() => {
      button.disabled = false;
      button.style.opacity = '';
      button.style.cursor = '';
      cooldown = false;
    }, 1200);
  
    const bet = parseInt(document.getElementById('slot-bet').value);
    if (!bet || bet <= 0) return alert('Enter a valid bet amount.');
  
    const display = document.getElementById('slot-display');
    const resultText = document.getElementById('slot-result');
    const symbols = ['🍒', '🍋', '🍉', '⭐', '🔔'];
  
    // Fetch result early
    const token = getCSRFToken();
    const res = await fetch('/casino/play/slots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token
      },
      credentials: 'include',
      body: JSON.stringify({ bet })
    });
    const data = await res.json();
    const match = data.message.match(/(🍒|🍋|🍉|⭐|🔔) (🍒|🍋|🍉|⭐|🔔) (🍒|🍋|🍉|⭐|🔔)/);
    if (!match) {
      resultText.textContent = data.message;
      return;
    }
  
    const result = match.slice(1); // actual 3-symbol result
    let index1 = 0, index2 = 0, index3 = 0;
    let spins = 0;
  
    const interval = setInterval(() => {
      display.textContent = `${symbols[index1]} ${symbols[index2]} ${symbols[index3]}`;
      index1 = (index1 + 1) % symbols.length;
      index2 = (index2 + 2) % symbols.length;
      index3 = (index3 + 3) % symbols.length;
      spins++;
  
      // stop after enough spins and show actual result
      if (spins >= 15) {
        clearInterval(interval);
        display.textContent = `${result[0]} ${result[1]} ${result[2]}`;
        resultText.textContent = data.message;
        setTimeout(() => {
          delayedBalanceUpdate(0);
        }, 10);
      }
    }, 80);
}
