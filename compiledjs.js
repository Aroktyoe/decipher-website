
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
    if (loader) {
      loader.classList.add('hidden');
    }
  }, 2000);

  // Loading spinner
  window.addEventListener('load', function() {
    const loader = document.querySelector('.loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  });

  // Back to top button
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
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Dropdown toggle (fixed)
    document.querySelectorAll('.mobile-nav .dropdown-toggle').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = button.closest('.dropdown');
        parent.classList.toggle('open');
      });
    });
  
    // Close if clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav .dropdown.open').forEach(drop => {
        drop.classList.remove('open');
      });
    });
  });

window.addEventListener("DOMContentLoaded", () => {
  // Load the full navbar
    fetch("/pc-navbar.html")
      .then(res => res.text())
      .then(html => {
        const container = document.getElementById("header-placeholder");
        container.innerHTML = html;

        const links = container.querySelectorAll("nav.main-nav a");
        const path = window.location.pathname.replace(/\/$/, "");

        links.forEach(link => {
          const href = link.getAttribute("href").replace(/\/$/, "");

          if (
            (href === "" && path === "") || // exact match for "/"
            (href !== "" && (path === href || path.startsWith(href + "/")))
          ) {
            link.classList.add("active");
          }
        });

      // Load header auth slot *after* navbar is injected
      fetch("/header.html", { headers: { "X-Original-Request": "true" } })
        .then(res => res.text())
        .then(html => {
          const slot = document.getElementById("header-auth-slot");
          if (slot) {
            slot.innerHTML = html;
            const script = document.createElement("script");
            script.src = "/header.js?v=" + Date.now();
            script.onload = () => {
              setupHeader();

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
          }
        });
    });
});

window.addEventListener("DOMContentLoaded", () => {
  const skipVideoPaths = ["/account.html", "/login-page.html", "/casino"];
  if (skipVideoPaths.includes(window.location.pathname)) return;

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

    if (isBackground) {
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
});



fetch("mobile-nav.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("mobile-nav-placeholder").innerHTML = html;

    // Wait for both mobile-nav and hamburger to exist before attaching
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

    setTimeout(tryAttach, 100); // slight delay ensures DOM update
  });


  // Theme toggle
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

  // Button hover effects with animations
  const buttons = document.querySelectorAll('.button6');
  
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

  // Add subtle animation to logo
  const logoIcon = document.querySelector('.logo-icon');
  if (logoIcon) {
    logoIcon.addEventListener('mouseenter', () => {
      logoIcon.style.filter = 'brightness(1.3) contrast(1.2)';
    });
    
    logoIcon.addEventListener('mouseleave', () => {
      logoIcon.style.filter = 'brightness(1.2) contrast(1.1)';
    });
  }


    const closeNavBtn = document.getElementById('close-nav');
    const mobileNav = document.getElementById('mobile-nav');
    if (closeNavBtn && mobileNav) {
      closeNavBtn.addEventListener('click', () => {
        mobileNav.classList.remove('open');
      });
    }

  document.querySelectorAll(".collapsible").forEach(button => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      
      if (button.style.maxHeight) { // turn off
        button.style.maxHeight = null;
        button.style.marginTop = "0px";
      } else { // turn on
        document.querySelectorAll(".collapsible").forEach(btn => {
          btn.style.maxHeight = null; // turns everything off
          btn.style.marginTop = "0px";
        });
        button.style.maxHeight = button.scrollHeight + "px";
        button.style.marginTop = "15px";
      }
    });
  });

  function getCSRFToken() {
    const match = document.cookie.match(/csrf_access_token=([^;]+)/);
    return match ? match[1] : '';
  }
