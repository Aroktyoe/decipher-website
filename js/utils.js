import { playCoinflip } from "./games/coinflip.js";
import { placeRouletteBet } from "./games/roulette.js";
import { startBlackjack } from "./games/blackjack.js";
import { playSlots } from "./games/slots.js";
import { getCSRFToken } from "./api.js";
import { fetchBalance } from "./api.js";


export function startCooldown(button) {
    cooldown = true;
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';

    setTimeout(() => {
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
        cooldown = false;
    }, 2000);
}

export function loaderEvents(){
    document.addEventListener("DOMContentLoaded", loadDailyInfo);

    // Force hide loader even if load event fails
    document.addEventListener('DOMContentLoaded', function() {
        const loader = document.querySelector('.loader');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 500);
        }
    });
  
    // Fallback to hide loader after fixed time
    setTimeout(() => {
        const loader = document.querySelector('.loader');
        if (loader) loader.classList.add('hidden');
    }, 2000);
  
    // Loading spinner
    window.addEventListener('load', function() {
        const loader = document.querySelector('.loader');
        if (loader) loader.classList.add('hidden');
    });
}

export function backToTop(backToTopButton) {

    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

function loadDailyInfo() {
    fetch("/me", { credentials: "include" })
        .then(res => res.json())
        .then(user => {
            const completed = user.completed_puzzles?.length || 0;
            const isPatreon = user.roles?.includes("1004792236552241203"); // Replace if needed

            const base = 10000;
            const bonus = completed * 2000;
            const total = base + bonus;
    
            const payoutEl = document.getElementById("daily-payout");
            if (payoutEl) {
                payoutEl.textContent = `Your daily payout: $${total.toLocaleString()}`;
            }
    });
}

export function mobileMenuToggle() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (hamburgerMenu && mobileNav) {
      hamburgerMenu.addEventListener('click', () => {
        mobileNav.classList.toggle('open');
      });
    }
}

export function themeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const themeIcon = themeToggle.querySelector('i');

        // Set initial theme from localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }

        themeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');

            if (isLight) {
                themeIcon.classList.remove('fa-moon');
                themeIcon.classList.add('fa-sun');
            } else {
                themeIcon.classList.remove('fa-sun');
                themeIcon.classList.add('fa-moon');
            }
        });
    }
}

export function buttonEvents(buttons) {

    console.log(document.getElementById("coinflipButton"))
    document.getElementById("coinflipButton").addEventListener("click", (event) => {
        playCoinflip(event);
    });

    console.log(document.getElementById("bet-button"))
    document.getElementById("bet-button").addEventListener("click", () => {
        placeRouletteBet();
    });

    console.log(document.getElementById("claimDailyButton"))
    document.getElementById("claimDailyButton").addEventListener("click", (event) => {
        claimDaily(event)
    });

    console.log(document.getElementById("slotsButton"))
    document.getElementById("slotsButton").addEventListener("click", (event) => {
        playSlots(event)
    });

    console.log(document.getElementById("blackjack-button"))
    document.getElementById("blackjack-button").addEventListener("click", (event) => {
        startBlackjack(event)
    });

    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
          button.style.transform = 'translateY(-5px)';
          button.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.2)';
        });
        
        button.addEventListener('mouseleave', () => {
          button.style.transform = '';
          button.style.boxShadow = '';
        });
      
        // Add pulse animation on page load
        setTimeout(() => {
          button.classList.add('pulse');
          setTimeout(() => {
            button.classList.remove('pulse');
          }, 1000);
        }, Math.random() * 1000 + 1000);
      });
}

export function disableBetButtons() {
    document.getElementById('bet-button').disabled = true;
    document.querySelectorAll("#your-bets button, .place-bet-button").forEach(btn => {
        btn.disabled = true;
    });
}

export function enableBetButtons() {
    document.querySelectorAll("#your-bets button, .place-bet-button, #bet-button").forEach(btn => {
        btn.disabled = false;
    });
}

export function logoAnimation() {
    const logoIcon = document.querySelector('.logo-icon'); // Add subtle animation to logo

    if (logoIcon) {
        logoIcon.addEventListener('mouseenter', () => {
            logoIcon.style.filter = 'brightness(1.3) contrast(1.2)';
        });
        
        logoIcon.addEventListener('mouseleave', () => {
            logoIcon.style.filter = 'brightness(1.2) contrast(1.1)';
        });
    }
}

export function claimDaily(event) {
  if (cooldown) return;
  startCooldown(event.target);
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
      const msgEl = document.getElementById("daily-msg");
      if (!msgEl) return;

      if (data.success) {
        msgEl.textContent = `✅ You claimed your daily $${data.bonus.toLocaleString()}!`;
        fetchBalance();
        updateLeaderboard();
      } else if (data.wait !== undefined) {
        const hrs = Math.floor(data.wait / 3600);
        const mins = Math.floor((data.wait % 3600) / 60);
        const secs = data.wait % 60;
        msgEl.textContent = `⏳ Come back in ${hrs}h ${mins}m ${secs}s`;
      } else if (data.msg) {
        msgEl.textContent = `❌ ${data.msg}`;
      } else {
        msgEl.textContent = "❌ Something went wrong.";
      }

      // Clear message after 5 seconds
      setTimeout(() => {
        msgEl.textContent = "";
      }, 5000);
    });
}

export function delayedBalanceUpdate(delay = 0) {
    setTimeout(() => {
      fetch("/casino/balance")
        .then(res => res.json())
        .then(data => {
          document.getElementById("balance").textContent = `$${data.balance.toLocaleString()}`;
        });
    updateLeaderboard();
    }, delay);
}

export async function updateLeaderboard() {
  const res = await fetch('/casino/leaderboard', { credentials: 'include' });
  const board = await res.json();
  if (!Array.isArray(board)) return;

  const username = window.currentUsername?.toLowerCase?.(); // Safely get it

  const list = board.map(entry => {
      const isSelf = entry.username.toLowerCase() === username;
      return `<li${isSelf ? ' style="color: #90ee90; font-weight: bold;"' : ''}>${entry.username}: $${entry.balance.toLocaleString()}</li>`;
  }).join('');

  document.getElementById('leaderboard').innerHTML = list;
}


export function updateBalance() {
    fetch("/casino/balance", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        document.getElementById("balance").textContent = `$${data.balance.toLocaleString()}`;
      });
  }