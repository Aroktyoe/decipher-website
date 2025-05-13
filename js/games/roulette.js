import { disableBetButtons, enableBetButtons } from '../utils.js';
import { getCSRFToken } from "../api.js";

let countdownInterval;
let spinInProgress = false;
let countdown = 0;
export const userBetColors = new Set();
window.removeBet = removeBet;


export function startNewSpin() {
  spinInProgress = true;
  startCountdown();
  disableBetButtons();

  setTimeout(() => {
      spinInProgress = false;
      startCountdown(countdown);
      enableBetButtons();
  }, 2000);  // Duration of the spin animation
}

export async function placeRouletteBet() {
    const bet = parseInt(document.getElementById('roulette-bet').value);
    const color = document.getElementById('roulette-color').value;
    if (!bet || isNaN(bet) || bet <= 0) {
      console.warn("Ignored invalid bet attempt on load");
      return;
    }
  
    const betButton = document.getElementById('bet-button');
    if (spinInProgress) {
      alert("Wait for spin to end before betting!");
      return;
    }
  
    betButton.disabled = false;
    
    try {
      console.log("Fetching /casino/roulette/bet with:", color, bet);
      const token = getCSRFToken();
      const res = await fetch('/casino/roulette/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token
        },
        credentials: 'include',
        body: JSON.stringify({ color, amount: bet })
      });
  
      const data = await res.json();
      const rouletteResult = document.getElementById('roulette-result');
      rouletteResult.textContent = '';
      if (!res.ok) {
        alert(data.msg || "Bet failed");
      } else {
        rouletteResult.textContent = `✅ Bet placed on ${color}`;
        addBetDisplay(color, bet); // NEW FUNCTION to update bets live
        userBetColors.add(color);
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

export function startCountdown(countdown) {
  // Stop any existing countdown interval
    clearInterval(countdownInterval);

    // Start a new countdown
    if (typeof countdown !== "number" || countdown <= 0) countdown = 10;
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

export function updateHistory(history) {
  if (!Array.isArray(history)) return;

  setTimeout(() => {
    const historyText = history.map(h => h === 'green' ? '🟢' : (h === 'red' ? '🔴' : '⚫')).join(' ');
    document.getElementById("roulette-history").textContent = `Last 15: ${historyText}`;
  }, 2000);
}

export function updateRouletteTimer(seconds) {
  clearInterval(countdownInterval);

  let countdown = seconds;
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

export async function removeBet(color) {
  // Send request to server to remove the bet
  const token = getCSRFToken();
  fetch('/casino/roulette/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token
      },
      credentials: 'include',
      body: JSON.stringify({ color })
  }).then(() => {
      // Remove bet from display
      const betDiv = document.getElementById(`bet-${color}`);
      if (betDiv) betDiv.remove();
      userBetColors.delete(color);
  });
}

export function addBetDisplay(color, amount, username = window.currentUsername) {
  const isOwnBet = username === window.currentUsername;
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

function showRouletteMessage(msg) {
  const box = document.getElementById("roulette-result");
  box.innerHTML = ""; // Clear old messages

  if (!msg) return; // Don't show anything if message is null/empty

  const div = document.createElement("div");
  div.textContent = msg;
  box.appendChild(div);
}


export { showRouletteMessage };
