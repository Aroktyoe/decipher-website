// ---------------- Loader ----------------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.loader')?.classList.add('hidden');
});

// Fallback in case something goes wrong
setTimeout(() => {
  document.querySelector('.loader')?.classList.add('hidden');
}, 2000);

// ---------------- Back to top button ----------------
const backToTopButton = document.getElementById('back-to-top');
if (backToTopButton) {
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });

  backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---------------- Mobile dropdown toggle ----------------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mobile-nav .dropdown-toggle').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      button.closest('.dropdown')?.classList.toggle('open');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.mobile-nav .dropdown.open').forEach(drop => {
      drop.classList.remove('open');
    });
  });
});

// ---------------- Header + Navbar ----------------
window.addEventListener("DOMContentLoaded", () => {
  // Load the full navbar AFTER paint
  requestAnimationFrame(() => {
    fetch("/pc-navbar.html")
      .then(res => res.text())
      .then(html => {
        const container = document.getElementById("header-placeholder");
        if (!container) return;
        container.innerHTML = html;

        const links = container.querySelectorAll("nav.main-nav a");
        const path = window.location.pathname.replace(/\/$/, "");
        links.forEach(link => {
          const href = link.getAttribute("href").replace(/\/$/, "");
          if ((href === "" && path === "") || (href !== "" && (path === href || path.startsWith(href + "/")))) {
            link.classList.add("active");
          }
        });

        // Load header auth slot AFTER navbar
        fetch("/header.html", { headers: { "X-Original-Request": "true" } })
          .then(res => res.text())
          .then(html => {
            const slot = document.getElementById("header-auth-slot");
            if (!slot) return;
            slot.innerHTML = html;

            const script = document.createElement("script");
            script.src = "/header.js?v=" + Date.now();
            script.onload = () => {
              if (typeof setupHeader === "function") setupHeader();

              const themeToggle = document.getElementById('theme-toggle');
              if (themeToggle) {
                const themeIcon = themeToggle.querySelector('i');
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'light') {
                  document.body.classList.add('light-theme');
                  themeIcon.classList.replace('fa-moon', 'fa-sun');
                }
                themeToggle.addEventListener('click', () => {
                  const isLight = document.body.classList.toggle('light-theme');
                  localStorage.setItem('theme', isLight ? 'light' : 'dark');
                  themeIcon.classList.toggle('fa-moon', !isLight);
                  themeIcon.classList.toggle('fa-sun', isLight);
                });
              }
            };
            document.body.appendChild(script);
          });
      });
  });
});

// ---------------- Background video ----------------
window.addEventListener("load", () => {
  const skipVideoPaths = ["/account.html", "/login-page.html", "/casino"];
  if (skipVideoPaths.includes(window.location.pathname)) return;

  setTimeout(() => { // delay video so it doesn't block LCP
    const video = document.createElement("video");
    video.id = "bg-video";
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.setAttribute("playsinline", "");
    video.playsInline = true;

    const source = document.createElement("source");
    source.src = "https://decipher.wiki/effects.mp4";
    source.type = "video/mp4";
    video.appendChild(source);
    document.body.prepend(video);

    video.addEventListener("loadeddata", () => {
      video.playbackRate = 0.75;
      if (localStorage.getItem("bg-video-paused") === "true") {
        video.pause();
      }
    });

    const togglePlaybackIfBackground = (e) => {
      const target = e.target;
      const isBackground = !target.closest("a, button, input, textarea, video");
      if (isBackground && (target.nodeName === "MAIN" || target.nodeName === "BODY")) {
        if (video.paused) {
          video.play();
          localStorage.setItem("bg-video-paused", "false");
        } else {
          video.pause();
          localStorage.setItem("bg-video-paused", "true");
        }
      }
    };

    document.body.addEventListener("click", togglePlaybackIfBackground);
    document.body.addEventListener("touchstart", togglePlaybackIfBackground);
  }, 1000);
});

// ---------------- Mobile nav ----------------
fetch("mobile-nav.html")
  .then(res => res.text())
  .then(html => {
    const placeholder = document.getElementById("mobile-nav-placeholder");
    if (!placeholder) return;
    placeholder.innerHTML = html;

    const tryAttach = () => {
      const closeNavBtn = document.getElementById('close-nav');
      const mobileNav = document.getElementById('mobile-nav');
      const hamburgerMenu = document.getElementById('hamburger-menu');

      if (closeNavBtn && mobileNav) {
        closeNavBtn.addEventListener('click', () => {
          mobileNav.classList.remove('open');
        });
      }

      if (hamburgerMenu && mobileNav) {
        hamburgerMenu.addEventListener('click', () => {
          mobileNav.classList.toggle('open');
        });
      }
    };

    setTimeout(tryAttach, 100);
  });

// ---------------- Theme toggle ----------------
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  const themeIcon = themeToggle.querySelector('i');
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
  }

  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeIcon.classList.toggle('fa-sun', isLight);
    themeIcon.classList.toggle('fa-moon', !isLight);
  });
}

// ---------------- Button hover animations ----------------
document.querySelectorAll('.button6').forEach(button => {
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-5px)';
    button.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = '';
    button.style.boxShadow = '';
  });
  setTimeout(() => {
    button.classList.add('pulse');
    setTimeout(() => button.classList.remove('pulse'), 1000);
  }, Math.random() * 1000 + 1000);
});

// ---------------- Logo hover animation ----------------
const logoIcon = document.querySelector('.logo-icon');
if (logoIcon) {
  logoIcon.addEventListener('mouseenter', () => {
    logoIcon.style.filter = 'brightness(1.3) contrast(1.2)';
  });
  logoIcon.addEventListener('mouseleave', () => {
    logoIcon.style.filter = 'brightness(1.2) contrast(1.1)';
  });
}

// ---------------- Collapsible sections ----------------
document.querySelectorAll(".collapsible").forEach(button => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    if (button.style.maxHeight) {
      button.style.maxHeight = null;
      button.style.marginTop = "0px";
    } else {
      document.querySelectorAll(".collapsible").forEach(btn => {
        btn.style.maxHeight = null;
        btn.style.marginTop = "0px";
      });
      button.style.maxHeight = button.scrollHeight + "px";
      button.style.marginTop = "3px";
    }
  });
});

// ---------------- CSRF Helper ----------------
function getCSRFToken() {
  const match = document.cookie.match(/csrf_access_token=([^;]+)/);
  return match ? match[1] : '';
}

// ---------------- Link toggle ----------------
document.addEventListener("DOMContentLoaded", () => {
  const settingKey = "openLinksInNewTab";
  const toggle = document.getElementById("link-toggle");

  if (toggle) {
    const savedSetting = localStorage.getItem(settingKey);
    toggle.checked = savedSetting !== "false"; // default true
    toggle.addEventListener("change", () => {
      localStorage.setItem(settingKey, toggle.checked ? "true" : "false");
    });
  }

  const shouldOpenInNewTab = localStorage.getItem(settingKey) !== "false";
  document.querySelectorAll("a[href]").forEach(link => {
    if (!link.hasAttribute("target")) {
      link.setAttribute("target", shouldOpenInNewTab ? "_blank" : "_self");
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
});
