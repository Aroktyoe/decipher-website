import { showCoinflipAnimation } from "./games/coinflip.js";

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
    
    socket.on("roulette_result", data => {
      const strip = document.getElementById('roulette-row');
      const resultText = document.getElementById('roulette-result');
      
      // if a spin is happening, start animation
    
      if (data.result && !data.just_spun) {
      const strip = document.getElementById('roulette-row');
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
        // Centered green if needed
        if (i === finalPosition && result === 'green') {
          spanValues.push('🟢');
        } else {
          spanValues.push(symbols[(i + startIndex) % 2]);
        }
      }
    
      // Replace one random red or black with green if green is not at center (for realism)
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
          // Centered green if needed
          if (i === finalPosition && result === 'green') {
            spanValues.push('🟢');
          } else {
            spanValues.push(symbols[(i + startIndex) % 2]);
          }
        }
    
        // Replace one random red or black with green if green is not at center (for realism)
        if (result === 'green' && !spanValues.includes('🟢')) {
          spanValues[Math.floor(Math.random() * spanValues.length)] = '🟢';
        }
    
        strip.innerHTML = spanValues.map(v => `<span>${v}</span>`).join('');
    
        setTimeout(() => {
          const centerOffset = (strip.offsetWidth / 2) - (slotWidth / 2);
          const offsetFix = window.innerWidth > 576 ? 128 : -597;
          strip.style.transform = `translateX(${-finalPosition * slotWidth + centerOffset + offsetFix}px)`;
    
          strip.style.transition = 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)';
          setTimeout(() => {
            resultText.textContent = `It landed on ${finalSymbol}`;
          }, 2000);
          delayedBalanceUpdate(2000);
          updateHistory(data.history);
    
          document.getElementById("your-bets").innerHTML = "";
        }, 50);
    
      } else {
        // if no spin yet (page just loaded), just update history
        updateHistory(data.history);
      }
    
      // Always update timer if available
      if (typeof data.next_spin_in !== 'undefined') {
        updateRouletteTimer(data.next_spin_in);
      }
    });
}