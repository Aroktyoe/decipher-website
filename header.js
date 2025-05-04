async function setupHeader() {
  const loginLink = document.getElementById("login-link");
  const accountLink = document.getElementById("account-link");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("header-user-info");

  // 🔽 Add these for mobile menu
  const mobileAccountDropdown = document.getElementById("mobile-account-dropdown");

  if (!loginLink || !userInfo || !document.getElementById("account-dropdown")) return;


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
    document.getElementById("account-dropdown").style.display = "inline-block";
    const dropdownToggle = document.querySelector("#account-dropdown .dropdown-toggle");
    const dropdown = document.getElementById("account-dropdown");

    if (dropdownToggle && dropdown) {
      dropdownToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });

      // Close dropdown if clicking outside
      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("open");
        }
      });
    }




    // 🔽 Show + connect mobile account/logout
    if (mobileAccountDropdown) mobileAccountDropdown.style.display = "list-item";


  } catch (e) {
    userInfo.innerHTML = "";
    loginLink.style.display = "inline";
    accountLink.style.display = "none";
    logoutBtn.style.display = "none";

    // 🔽 Hide mobile account/logout on failure
    if (mobileAccountDropdown) mobileAccountDropdown.style.display = "none";

  }
}


window.setupHeader = setupHeader;
