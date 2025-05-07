/*
import { fetchBalance, getCSRFToken } from "../api.js";
import { updateLeaderboard } from "../utils.js";

const fill = document.getElementById("luck-fill");
const msgBox = document.getElementById("one-in-1000-msg");
const diceImg = document.getElementById("dice-img");
const btn = document.getElementById("one-in-1000-btn");

let luckPercent = 0;
let oneInCooldown = false;

const LOCK_KEY = "onein1000_lock_until";

// Check for cooldown lock
const now = Date.now();
const lockUntil = parseInt(localStorage.getItem(LOCK_KEY) || "0");
if (now < lockUntil) {
  disableButtonForCooldown(lockUntil - now);
}

fetch("/casino/get-luck", {
  credentials: "include"
})
  .then(res => res.json())
  .then(data => {
    luckPercent = data.progress || 0;
    fill.style.width = luckPercent + "%";
  });

btn.addEventListener("click", tryOneIn1000);

function tryOneIn1000() {
  if (oneInCooldown || btn.disabled) return;
  oneInCooldown = true;

  btn.disabled = true;
  btn.style.opacity = 0.5;
  setTimeout(() => {
    oneInCooldown = false;
    btn.disabled = false;
    btn.style.opacity = 1;
  }, 1000);

  fetch("/casino/win-1000-button", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCSRFToken()
    },
    credentials: "include"
  })
    .then(res => res.json().catch(() => ({ msg: "Server error." })))
    .then(data => {
      msgBox.textContent = data.msg || "Try again.";

      if (data.msg?.includes("take a break")) {
        const cooldownMs = 6 * 60 * 60 * 1000;
        const unlockTime = Date.now() + cooldownMs;
        localStorage.setItem(LOCK_KEY, unlockTime);
        disableButtonForCooldown(cooldownMs);
      }

      if (data.progress !== undefined) {
        luckPercent = data.progress;
        fill.style.width = luckPercent + "%";
      }

      if (data.reward > 0) {
        fetchBalance();
        updateLeaderboard();
      }

      if (luckPercent === 100) {
        setTimeout(() => {
          diceImg.style.display = "block";
          animateDice(diceImg, () => {
            fetch("/casino/dice-roll", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": getCSRFToken()
              },
              credentials: "include"
            })
              .then(res => res.json())
              .then(data => {
                diceImg.src = `https://decipher.wiki/dice/${data.roll}.png?ts=${Date.now()}`;
                msgBox.textContent = data.msg || `🎲 Rolled ${data.roll}. No luck this time.`;
                fill.style.width = "0%";
                luckPercent = 0;

                if (data.reward > 0) {
                  fetchBalance();
                  updateLeaderboard();
                }

                setTimeout(() => {
                  msgBox.textContent = "";
                  diceImg.style.display = "none";
                }, 3000);
              });
          });
        }, 150);
      }

      setTimeout(() => {
        msgBox.textContent = "";
      }, 1000);
    });
}

function disableButtonForCooldown(ms) {
  btn.disabled = true;
  btn.textContent = "🚫 Take a break";
  btn.style.opacity = 0.6;

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "🎯 Try Your Luck";
    btn.style.opacity = 1;
    localStorage.removeItem(LOCK_KEY);
  }, ms);
}

function animateDice(img, callback) {
  let frames = [1, 2, 3, 4, 5, 6];
  let i = 0;
  let interval = setInterval(() => {
    img.src = `https://decipher.wiki/dice/${frames[i++ % 6]}.png`;
  }, 100);
  setTimeout(() => {
    clearInterval(interval);
    callback();
  }, 1000);
}

*/