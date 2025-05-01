async function setupHeader() {
  const loginLink = document.getElementById("login-link");
  const accountLink = document.getElementById("account-link");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("header-user-info");

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
    } catch (e) {
      userInfo.innerHTML = "";
      loginLink.style.display = "inline";
      accountLink.style.display = "none";
      logoutBtn.style.display = "none";
    }
}

window.setupHeader = setupHeader;