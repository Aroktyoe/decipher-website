import { showCoinflipAnimation } from "./games/coinflip.js";
import { updateBalance, delayedBalanceUpdate } from "./utils.js";
import { fetchYourBets, updateHistory, startNewSpin, updateRouletteTimer } from "./games/roulette.js";
import { updateLeaderboard } from './utils.js';
import { loadOpenCoinflips } from './games/coinflip.js';
import { showRouletteMessage, userBetColors } from './games/roulette.js';

let suppressImmediateBalanceUpdate = false;


export function socketEvents() {
    socket.on("connect", () => {
        console.log("🟢 Connected to socket");
        loadOpenCoinflips(); // ensure flips are loaded once socket is ready
    });
    
    socket.on('update_open_flips', () => {
        console.log("🔁 Received update_open_flips");
        loadOpenCoinflips(); // sync all clients when a flip is created/joined
    });
    
    socket.on('update_leaderboard', () => {
        updateLeaderboard();
    });
    
    socket.on('update_bets', () => {
        fetchYourBets();
    });

    socket.on('coinflip_result', data => {
        const { flip_id, result, winner } = data;
        suppressImmediateBalanceUpdate = true;
        showCoinflipAnimation(result, winner);
        setTimeout(() => {
        delayedBalanceUpdate(2000); 
        }, 3500);
    });

    socket.on("update_balance_slots", delayedBalanceUpdate(1500));

    socket.on("update_balance_blackjack", updateBalance);

    socket.on("update_balance", () => {
    if (suppressImmediateBalanceUpdate) {
        suppressImmediateBalanceUpdate = false;
        return; // skip this one — we already have a delayed update coming
    }
    delayedBalanceUpdate(0); // default instant update
    });
    
// Track the user's active bets this round
socket.on("roulette_result", data => {
  const strip = document.getElementById('roulette-row');

  if (data.result && !data.just_spun) {
    const slotWidth = 35;
    const visibleSlots = 11;
    const bufferSlots = 20;
    const totalSlots = visibleSlots + bufferSlots * 2;
    const result = data.result;
    const symbols = ['🔴', '⚫'];
    const finalSymbol = result === 'green' ? '🟢' : (result === 'red' ? '🔴' : '⚫');
    const startIndex = result === 'red' ? 1 : 0;
    const finalPosition = bufferSlots + Math.floor((visibleSlots - 1) / 2);

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    strip.innerHTML = '';
    const spanValues = [];

    for (let i = 0; i < totalSlots; i++) {
      if (i === finalPosition && result === 'green') {
        spanValues.push('🟢');
      } else {
        spanValues.push(symbols[(i + startIndex) % 2]);
      }
    }

    if (result === 'green' && !spanValues.includes('🟢')) {
      spanValues[Math.floor(Math.random() * spanValues.length)] = '🟢';
    }

    strip.innerHTML = spanValues.map(v => `<span>${v}</span>`).join('');

    const centerOffset = (strip.getBoundingClientRect().width / 2) - (slotWidth / 2);
    const targetOffset = -(finalPosition * slotWidth) + centerOffset;

    strip.style.transform = `translateX(${targetOffset}px)`;
    strip.style.transition = 'none';
  }

  if (data.result) {
    startNewSpin();
    const slotWidth = 40;
    const visibleSlots = 11;
    const bufferSlots = 20;
    const totalSlots = visibleSlots + bufferSlots * 2;
    const result = data.result;
    const symbols = ['🔴', '⚫'];
    const finalSymbol = result === 'green' ? '🟢' : (result === 'red' ? '🔴' : '⚫');
    const startIndex = result === 'red' ? 1 : 0;
    const finalPosition = bufferSlots + Math.floor(visibleSlots / 2);

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    strip.innerHTML = '';
    const spanValues = [];

    for (let i = 0; i < totalSlots; i++) {
      if (i === finalPosition && result === 'green') {
        spanValues.push('🟢');
      } else {
        spanValues.push(symbols[(i + startIndex) % 2]);
      }
    }

    if (result === 'green' && !spanValues.includes('🟢')) {
      spanValues[Math.floor(Math.random() * spanValues.length)] = '🟢';
    }

    strip.innerHTML = spanValues.map(v => `<span>${v}</span>`).join('');

    setTimeout(() => {
      const centerOffset = (strip.offsetWidth / 2) - (slotWidth / 2);
      const offsetFix = window.innerWidth > 576 ? 128 : -588;
      strip.style.transform = `translateX(${-finalPosition * slotWidth + centerOffset + offsetFix}px)`;

      strip.style.transition = 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)';

      setTimeout(() => {
        let message = `It landed on ${finalSymbol}`;
        let foundMatch = false;

        if (data.winners && Array.isArray(data.winners)) {
          for (const w of data.winners) {
            if (w.user === window.currentUserId) {
              foundMatch = true;
              if (w.type === "win") {
                message += ` — You won $${w.amount.toLocaleString()} on ${w.color}.`;
              } else if (w.type === "refund") {
                message += ` — Your bet on ${w.color} was refunded (landed green).`;
              }
            }
          }
        }

        if (!foundMatch && userBetColors.size > 0) {
          // Lost, but user had bet
          if (!userBetColors.has(result)) {
            message += " — ❌ You lost this round.";
            foundMatch = true;
          }
        }

        if (foundMatch) {
          showRouletteMessage(message);
        } else {
          showRouletteMessage(""); // Clear message if user didn't bet
        }

        userBetColors.clear(); // Reset for next round
      }, 2000);

      delayedBalanceUpdate(2000);
      updateHistory(data.history);
      document.getElementById("your-bets").innerHTML = "";
    }, 50);
  } else {
    updateHistory(data.history);
  }

  if (typeof data.next_spin_in !== 'undefined') {
    updateRouletteTimer(data.next_spin_in);
  }
});
}