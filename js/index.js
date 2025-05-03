import { socketEvents } from "./sockets.js";
import { fetchUser, fetchHeader, fetchBalance, getCSRFToken } from "./api.js";
import {
  backToTop, loaderEvents, mobileMenuToggle, themeToggle, startCooldown,
  buttonEvents, logoAnimation, delayedBalanceUpdate, updateLeaderboard, updateBalance
} from "./utils.js";
import { playSlots } from "./games/slots.js";
import {
  startNewSpin, placeRouletteBet, fetchYourBets, startCountdown,
  updateHistory, updateRouletteTimer, removeBet, addBetDisplay
} from "./games/roulette.js";
import {
  loadOpenCoinflips // Only load here!
} from "./games/coinflip.js";
import {
  startBlackjack, blackjackAction, displayBlackjackGame
} from "./games/blackjack.js";
import { io } from "https://cdn.socket.io/4.5.4/socket.io.esm.min.js";
import { loadDailyInfo } from './utils.js';


window.socket = io("https://decipher.wiki", {
  withCredentials: true
});

window.currentUsername;
window.cooldown = false;

document.addEventListener("DOMContentLoaded", async () => {
  const buttons = document.querySelectorAll('.button6');
  const backToTopButton = document.getElementById('back-to-top');

  // Core setup
  await fetchUser();
  loadDailyInfo();
  fetchHeader();
  backToTop(backToTopButton);
  loaderEvents();
  mobileMenuToggle();
  themeToggle();
  buttonEvents(buttons);
  logoAnimation();
  await fetchBalance();
  getCSRFToken();


  await loadOpenCoinflips(); // This loads available coinflips

  updateHistory();
  // removeBet(), addBetDisplay() are only needed during real interaction

  await fetchYourBets();
  await placeRouletteBet();

  await startBlackjack();
  // blackjackAction(action) should be triggered by button click, not run automatically

  displayBlackjackGame();
  delayedBalanceUpdate();
  socketEvents();
  document.getElementById("buy-balance-button")?.addEventListener("click", async () => {
    const amount = document.getElementById("buy-amount").value;
    document.getElementById("buy-status").innerText = "⏳ Redirecting to PayPal...";
    const res = await fetch("/create-paypal-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCSRFToken()
      },
      credentials: "include",
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (data.approvalUrl) {
      window.location.href = data.approvalUrl;
    } else {
      document.getElementById("buy-status").innerText = "❌ Failed to start payment.";
    }
  });
});
