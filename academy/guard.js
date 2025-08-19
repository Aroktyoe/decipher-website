(async () => {
  // /academy/<tier>/<level>[optional / or .html/.shtml]
  const m = location.pathname.match(
    /^\/academy\/(beginner|mediocre|expert)\/(\d+)(?:\/|(?:\.(?:s?html))?)?$/i
  );
  if (!m) return;

  const tier = m[1].toLowerCase();
  const level = parseInt(m[2], 10);

  function block(reason, gotoUrl) {
    // Prefer redirect to the last unlocked level; show a message first for UX
    const html = `
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Locked • DECIPHER Academy</title><link href="/index2.css" rel="stylesheet"></head>
      <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b0b0b;color:#eee;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Exo 2,sans-serif;">
        <div style="max-width:640px;padding:24px;border:1px solid #a6169094;border-radius:14px;background:#01010125;">
          <h1 style="margin-top:0">🔒 Level Locked</h1>
          <p style="line-height:1.6">${reason}</p>
          <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <a href="/academy" class="btn primary" style="padding:.6rem 1rem;background:#a61690;color:#fff;border-radius:10px;text-decoration:none;">Back to Academy</a>
            ${gotoUrl ? `<a href="${gotoUrl}" class="btn" style="padding:.6rem 1rem;background:#222;color:#fff;border-radius:10px;text-decoration:none;">Go to next unlocked</a>` : ""}
          </div>
        </div>
      </body>`;
    document.documentElement.innerHTML = html;
    if (gotoUrl) setTimeout(() => location.replace(gotoUrl), 1200);
    throw new Error("locked");
  }

  // 1) must be signed in
  let user = null;
  try {
    const res = await fetch("/me", { credentials: "include", cache: "no-store" });
    if (res.ok) user = await res.json();
  } catch {}
  if (!user || !(user.username || user.user || user.email)) {
    block(`You must be signed in to view Academy levels.`, "/login-page.shtml");
  }

  // 2) progress: try API, accept multiple shapes; fallback to localStorage
  let solved = 0;
  try {
    const r = await fetch("/api/academy/progress", { credentials: "include", cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      // Accept {beginner: n} or {progress:{beginner:n}} or {academy_progress:{beginner:n}}
      const p =
        (data && (data.progress || data.academy_progress || data)) || {};
      solved = Math.max(0, +p[tier] || 0);
    }
  } catch {}
  if (!solved) {
    try {
      const ls = JSON.parse(localStorage.getItem("academy-progress") || "{}");
      solved = Math.max(0, +ls[tier] || 0);
    } catch {}
  }

  const nextAllowed = Math.min(10, solved + 1);
  if (level > nextAllowed) {
    const tip = solved
      ? `You’ve solved ${solved} ${tier} level${solved === 1 ? "" : "s"}. Next unlocked is ${tier} ${solved + 1}.`
      : `You haven’t solved any ${tier} levels yet. Start at ${tier} 1.`;
    block(
      `You haven’t unlocked ${tier} ${level} yet. ${tip}`,
      `/academy/${tier}/${nextAllowed}`
    );
  }
})();
