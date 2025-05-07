import { fetchBalance, getCSRFToken } from "../api.js";
import { updateLeaderboard } from "../utils.js";

const rewards = [1000, 2000, 3000, 4000, 5000, 6000, 10000, 15000, 20000, 100000];
const wheel = document.getElementById("wheel");
const spinBtn = document.getElementById("spin-btn");
const msgBox = document.getElementById("wheel-msg");

let spinning = false;

spinBtn.addEventListener("click", () => {
  if (spinning) return;
  spinning = true;
  spinBtn.disabled = true;
  msgBox.textContent = "Spinning...";

  fetch("/casino/spin-wheel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCSRFToken()
    },
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        msgBox.textContent = data.msg;
        spinning = false;
        spinBtn.disabled = false;
        return;
      }

      const index = rewards.indexOf(data.reward);
      const slice = 360 / rewards.length;
      const targetDeg = index * slice + slice / 2;
      const spins = 5 * 360;
      const finalDeg = spins - targetDeg - 72;

      wheel.style.transition = "transform 5s cubic-bezier(0.25, 1, 0.5, 1)";
      wheel.style.transform = `rotate(${finalDeg}deg)`;

      setTimeout(() => {
        msgBox.textContent = data.msg;
        fetchBalance();
        updateLeaderboard();
        spinning = false;
      }, 5200);
    })
    .catch(() => {
      msgBox.textContent = "Error spinning.";
      spinning = false;
      spinBtn.disabled = false;
    });
});

const timerDisplay = document.getElementById("wheel-timer");

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function startWheelTimer(seconds) {
  if (seconds <= 0) {
    timerDisplay.textContent = "00:00:00";
    return;
  }
  timerDisplay.textContent = formatTime(seconds);
  const interval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(interval);
      timerDisplay.textContent = "00:00:00";
    } else {
      timerDisplay.textContent = formatTime(seconds);
    }
  }, 1000);
}

fetch("/casino/spin-wheel-time", {
  credentials: "include"
})
  .then(res => res.json())
  .then(data => {
    startWheelTimer(data.seconds_remaining);
  });


// Add labels to wheel segments
rewards.forEach((val, i) => {
  const label = document.createElement("span");
  const deg = (360 / rewards.length) * i;
  label.textContent = val / 1000 + "k";
  label.style.transform = `rotate(${deg}deg) translateX(130px) rotate(-${deg}deg)`;
  wheel.appendChild(label);
});
