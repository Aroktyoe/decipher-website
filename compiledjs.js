
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

  

  // Mobile menu toggle
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const mobileNav = document.getElementById('mobile-nav');
  
  if (hamburgerMenu && mobileNav) {
    hamburgerMenu.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });
  }

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

  fetch("/header.html", { headers: { "X-Original-Request": "true" } })
    .then(res => res.text())
    .then(html => {
      document.getElementById("header-auth-slot").innerHTML = html;
      const script = document.createElement("script");
      script.src = "/header.js?v=" + Date.now();
      script.onload = () => setupHeader();
      document.body.appendChild(script);
    });

    document.getElementById('close-nav').addEventListener('click', () => {
      document.getElementById('mobile-nav').classList.remove('open');
    });

  // Make collapsible buttons work
  document.querySelectorAll(".collapsible").forEach(button => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      const content = button.nextElementSibling;
      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.style.marginTop = "0px";
      } else {
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.marginTop = "15px";
      }
    });
  });

  function getCSRFToken() {
    const match = document.cookie.match(/csrf_access_token=([^;]+)/);
    return match ? match[1] : '';
  }