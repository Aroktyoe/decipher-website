import { updateLeaderboard } from "./utils.js";

export async function fetchUser() {
  try {
      const res = await fetch("/me");
      const data = await res.json();
      window.currentUsername = data.username;
      fetchBalance();
      await updateLeaderboard();
      return data; // ✅ return the user
  } catch {
      fetchBalance();
      await updateLeaderboard();
      return null; // fallback
  }
}


export function fetchHeader(){
    fetch("/header.html", { headers: { "X-Original-Request": "true" } })
        .then(res => res.text())
        .then(html => {
            document.getElementById("header-auth-slot").innerHTML = html;
            const script = document.createElement("script");
            script.src = "/header.js?v=" + Date.now();
            script.onload = () => {
            if (window.setupHeader) setupHeader();
            };
            document.body.appendChild(script);
    });
}

export async function fetchBalance() {
    const res = await fetch('/casino/balance', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) return alert('You must be logged to play the casino.');
    document.getElementById('balance').textContent = `$${data.balance.toLocaleString()}`;
    return data;
}

export function getCSRFToken() {
    const match = document.cookie.match(/csrf_access_token=([^;]+)/);
    return match ? match[1] : '';
}