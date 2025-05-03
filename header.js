async function setupHeader() {
  const loginLink = document.getElementById("login-link");
  const accountLink = document.getElementById("account-link");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("header-user-info");

  // 🔽 Add these for mobile menu
  const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
  const mobileLogoutLi = document.getElementById("mobile-logout");
  const mobileAccountLi = document.getElementById("mobile-account");

  if (!loginLink || !accountLink || !logoutBtn || !userInfo) return;

  const logout = async () => {
    await fetch("/logout", {
      method: "POST",
      credentials: "include"
    });
    location.reload();
  };

  try {
    const res = await fetch("/me", {
      method: "GET",
      credentials: "include"
    });

    if (!res.ok) throw new Error();

    const data = await res.json();
    userInfo.innerHTML = `🔐 <span class="username"></span>`;
    userInfo.querySelector(".username").textContent = data.username;

    loginLink.style.display = "none";
    accountLink.style.display = "inline";
    logoutBtn.style.display = "inline";
    logoutBtn.onclick = logout;

    // 🔽 Show + connect mobile account/logout
    if (mobileLogoutBtn) mobileLogoutBtn.onclick = logout;
    if (mobileLogoutLi) mobileLogoutLi.style.display = "list-item";
    if (mobileAccountLi) mobileAccountLi.style.display = "list-item";

  } catch (e) {
    userInfo.innerHTML = "";
    loginLink.style.display = "inline";
    accountLink.style.display = "none";
    logoutBtn.style.display = "none";

    // 🔽 Hide mobile account/logout on failure
    if (mobileLogoutLi) mobileLogoutLi.style.display = "none";
    if (mobileAccountLi) mobileAccountLi.style.display = "none";
  }
}

window.setupHeader = setupHeader;
