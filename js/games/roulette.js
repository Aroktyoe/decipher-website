import { disableBetButtons, enableBetButtons } from '../utils.js';
import { getCSRFToken } from "../api.js";

let countdownInterval;
let spinInProgress = false;

export function startNewSpin() {
  spinInProgress = true;
  startCountdown();
  disableBetButtons();

  socket.emit('start_spin');  // You can emit this event to trigger a spin in the backend
  setTimeout(() => {
      spinInProgress = false;
      startCountdown();
      enableBetButtons();
  }, 2000);  // Duration of the spin animation
}

export async function placeRouletteBet() {
    const bet = parseInt(document.getElementById('roulette-bet').value);
    const color = document.getElementById('roulette-color').value;
    if (!bet || bet <= 0) return alert('Enter a valid bet amount.');
  
    const betButton = document.getElementById('bet-button');
    if (spinInProgress) {
      alert("Wait for spin to end before betting!");
      return;
    }
  
    betButton.disabled = false;
    
    try {
      console.log("Fetching /casino/roulette/bet with:", color, bet);
      const res = await fetch('/casino/roulette/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getCSRFToken()
        },
        credentials: 'include',
        body: JSON.stringify({ color, amount: bet })
      });
  
      const data = await res.json();
      const rouletteResult = document.getElementById('roulette-result');
      if (!res.ok) {
        alert(data.msg || "Bet failed");
      } else {
        rouletteResult.textContent = `✅ Bet placed on ${color}`;
        addBetDisplay(color, bet); // NEW FUNCTION to update bets live
      }
    } finally {
    }
}

export async function fetchYourBets() {
  const res = await fetch('/casino/roulette/status', { credentials: 'include' });
  const data = await res.json();
  if (!data || !data.your_bets || !data.all_bets) return;

  const betsContainer = document.getElementById('your-bets');
  betsContainer.innerHTML = ''; // clear old bets

  for (const bet of data.all_bets) {
    addBetDisplay(bet.color, bet.amount, bet.username);
  }
}

export function startCountdown(countdown, countdownInterval) {
    // Stop any existing countdown interval
    clearInterval(countdownInterval);

    // Start a new countdown
    countdown = 10;
    countdownInterval = setInterval(() => {
      if (!spinInProgress) {
        document.getElementById('roulette-timer').textContent = `Next spin in: ${countdown}s`;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            document.getElementById('bet-button').disabled = false;  // Enable the bet button when the countdown ends
        } else {
            countdown--;
        }
      }
    }, 1000);
}

export function updateHistory(history=history) {
  setTimeout(() => {
      const historyText = history.map(h => h === 'green' ? '🟢' : (h === 'red' ? '🔴' : '⚫')).join(' ');
      document.getElementById("roulette-history").textContent = `Last 15: ${historyText}`;
  }, 2000);
}

export function updateRouletteTimer(seconds) {
  clearInterval(countdownInterval);

  countdown = seconds;
  countdownInterval = setInterval(() => {
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      document.getElementById('roulette-timer').textContent = `Rolling...`;
    } else {
      document.getElementById('roulette-timer').textContent = `Next spin in: ${countdown}s`;
      countdown--;
    }
  }, 1000);
}

export function removeBet(color) {
  // Send request to server to remove the bet
  fetch('/casino/roulette/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getCSRFToken()
      },
      credentials: 'include',
      body: JSON.stringify({ color })
  }).then(() => {
      // Remove bet from display
      const betDiv = document.getElementById(`bet-${color}`);
      if (betDiv) betDiv.remove();
  });
}

export function addBetDisplay(color, amount, username = currentUsername) {
  const isOwnBet = username === currentUsername;
  const betDivId = `bet-${username}-${color}`;
  let betDiv = document.getElementById(betDivId);

  const content = `Bet $${amount} on ${color} by ${username}` +
    (isOwnBet ? ` <button onclick="removeBet('${color}')">Remove</button>` : "");

  if (betDiv) {
    betDiv.innerHTML = content;
  } else {
    betDiv = document.createElement("div");
    betDiv.id = betDivId;
    betDiv.innerHTML = content;
    document.getElementById("your-bets").appendChild(betDiv);
  }
}
