import { fetchUser, fetchHeader, fetchBalance, getCSRFToken } from "../api.js";
import { startCooldown } from "../utils.js";

window.currentGame;

export async function startBlackjack(event) {
    startCooldown(event.target);
  
    const bet = parseInt(document.getElementById('blackjack-bet').value);
    if (!bet || bet <= 0) return alert('Enter a valid bet amount.');
  
    const token = getCSRFToken();
    const res = await fetch('/casino/play/blackjack/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token
      },
      credentials: 'include',
      body: JSON.stringify({ bet })
    });
    
    currentGame = await res.json();
    displayBlackjackGame();
}
  
export async function blackjackAction(action) {
    const token = getCSRFToken();
    const res = await fetch('/casino/play/blackjack/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token
      },
      credentials: 'include',
      body: JSON.stringify({ action })
    });
  
    currentGame = await res.json();
    displayBlackjackGame();
  }
  
export function displayBlackjackGame() {
    const container = document.getElementById('blackjack-result');
    if (!currentGame) return;
  
    const isPair =
      currentGame.player_cards.length === 2 &&
      currentGame.player_cards[0] === currentGame.player_cards[1];
  
    const canSplit = isPair && !currentGame.game_over && !currentGame.has_split;
    const canDouble = currentGame.player_cards.length === 2 && !currentGame.game_over && !currentGame.has_doubled;
  
    container.innerHTML = `
      <div>Your cards: ${currentGame.player_cards.join(", ")} (Total: ${currentGame.player_total})</div>
      <div>Dealer's cards: ${
        currentGame.game_over
          ? currentGame.dealer_cards.join(", ")
          : currentGame.dealer_cards[0] + ", ?"
      }${currentGame.game_over ? ` (Total: ${currentGame.dealer_total})` : ''}</div>
      <div class="game-result-message">
    ${currentGame.message.includes('won') ? `You won $${currentGame.payout}` : currentGame.message}
  </div>
      ${
        !currentGame.game_over
          ? `
          <button onclick="blackjackAction('hit')" class="button6">Hit</button>
          <button onclick="blackjackAction('stand')" class="button6">Stand</button>
          ${canDouble ? `<button onclick="blackjackAction('double')" class="button6">Double</button>` : ''}
          ${canSplit ? `<button onclick="blackjackAction('split')" class="button6">Split</button>` : ''}
        `
          : ''
      }
    `;
  
    fetchBalance();
    updateLeaderboard();
}