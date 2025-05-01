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



window.socket = io("https://decipher.wiki", {
  withCredentials: true
});

window.currentUsername = null;
window.cooldown = false;

document.addEventListener("DOMContentLoaded", async () => {
  const buttons = document.querySelectorAll('.button6');
  const backToTopButton = document.getElementById('back-to-top');

  // Core setup
  await fetchUser();
  fetchHeader();
  backToTop(backToTopButton);
  loaderEvents();
  mobileMenuToggle();
  themeToggle();
  buttonEvents(buttons);
  logoAnimation();
  await fetchBalance();
  getCSRFToken();

  // Game logic
  startCountdown(10, null);
  startNewSpin();

  await loadOpenCoinflips(); // This loads available coinflips

  updateHistory();
  updateRouletteTimer(10); // Replace 10 with actual time if needed
  // removeBet(), addBetDisplay() are only needed during real interaction

  await fetchYourBets();
  await placeRouletteBet();

  await startBlackjack();
  // blackjackAction(action) should be triggered by button click, not run automatically

  displayBlackjackGame();
  delayedBalanceUpdate();
  socketEvents();
});
