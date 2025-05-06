import { getCSRFToken } from "./api.js";
import { claimDaily } from "./utils.js";


let autoClaimEnabled = false;
let autoClaimTimeout = null;
const AUTO_CLAIM_KEY = "autoClaimUntil";

function initAutoClaimButton() {
  const button = document.createElement("button");
  button.id = "auto-claim-button";
  button.className = "button6";
  document.querySelector(".div1").appendChild(button);

  button.addEventListener("click", () => {
    const now = Date.now();
    const saved = localStorage.getItem(AUTO_CLAIM_KEY);
    if (autoClaimEnabled) {
      autoClaimEnabled = false;
      localStorage.removeItem(AUTO_CLAIM_KEY);
      button.textContent = "▶️ Enable auto-claim for 48 hours";
      button.style.backgroundColor = "";
      clearTimeout(autoClaimTimeout);
    } else {
      autoClaimEnabled = true;
      const until = now + 48 * 60 * 60 * 1000;
      localStorage.setItem(AUTO_CLAIM_KEY, until);
      button.textContent = "✅ Auto-claim enabled (48h)";
      button.style.backgroundColor = "#1f6603";
      setupAutoClaimLoop();
    }
  });

  const savedUntil = parseInt(localStorage.getItem(AUTO_CLAIM_KEY));
  if (!isNaN(savedUntil) && savedUntil > Date.now()) {
    autoClaimEnabled = true;
    button.textContent = "✅ Auto-claim enabled (48h)";
    button.style.backgroundColor = "#1f6603";
    setupAutoClaimLoop();
  } else {
    button.textContent = "▶️ Enable auto-claim for 48 hours";
  }
}

function setupAutoClaimLoop() {
  if (!autoClaimEnabled) return;
  checkCooldownAndSchedule();
}

function checkCooldownAndSchedule() {
  fetch("/casino/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCSRFToken()
    },
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (!autoClaimEnabled) return;

      if (data.success) {
        // Claim was accepted immediately
        const event = { target: document.getElementById("claimDailyButton") };
        claimDaily(event);
        scheduleNextClaim(0);
      } else if (data.wait !== undefined) {
        // Wait for cooldown to expire
        scheduleNextClaim(data.wait);
      }
    });
}

function scheduleNextClaim(seconds) {
  clearTimeout(autoClaimTimeout);

  const ms = seconds * 1000;
  const now = Date.now();
  const expireAt = parseInt(localStorage.getItem(AUTO_CLAIM_KEY));

  if (isNaN(expireAt) || now + ms > expireAt) {
    // Auto-claim expired before next claim
    autoClaimEnabled = false;
    localStorage.removeItem(AUTO_CLAIM_KEY);
    const btn = document.getElementById("auto-claim-button");
    if (btn) {
      btn.textContent = "▶️ Enable auto-claim for 48 hours";
      btn.style.backgroundColor = "";
    }
    return;
  }

  autoClaimTimeout = setTimeout(() => {
    if (autoClaimEnabled) {
      const event = { target: document.getElementById("claimDailyButton") };
      claimDaily(event);
      checkCooldownAndSchedule();
    }
  }, ms);
}

document.addEventListener("DOMContentLoaded", initAutoClaimButton);
