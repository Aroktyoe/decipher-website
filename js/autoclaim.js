import { getCSRFToken } from "./api.js";

function initAutoClaimButton() {
  const button = document.createElement("button");
  button.id = "auto-claim-button";
  button.className = "button6";
  document.querySelector(".div1").appendChild(button);

  button.addEventListener("click", () => {
    fetch("/casino/auto-claim/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCSRFToken()
      },
      credentials: "include"
    })
    .then(res => res.json())
    .then(data => {
      if (data.enabled) {
        button.textContent = "✅ Auto-claim enabled (48h)";
        button.style.backgroundColor = "#1f6603";
      } else {
        button.textContent = "▶️ Enable auto-claim for 48 hours";
        button.style.backgroundColor = "";
      }
    });
  });

  fetch("/casino/auto-claim/status", {
    headers: { "X-CSRF-TOKEN": getCSRFToken() },
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (data.enabled) {
        button.textContent = "✅ Auto-claim enabled (48h)";
        button.style.backgroundColor = "#1f6603";
      } else {
        button.textContent = "▶️ Enable auto-claim for 48 hours";
      }
    });
}

document.addEventListener("DOMContentLoaded", initAutoClaimButton);
