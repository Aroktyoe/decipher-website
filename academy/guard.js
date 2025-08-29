// guard.js — display slugs ↔ DB slugs, server-truth gating, no localStorage
(async () => {
  // Match both display and DB slugs for backward compatibility
  const m = location.pathname.match(
    /^\/academy\/(beginner|medium|mediocre|extreme|expert)\/(\d+)(?:\/|(?:\.(?:s?html))?)?$/i
  );
  if (!m) return;

  const slug = m[1].toLowerCase();
  const level = parseInt(m[2], 10);

  // Maps
  const toDb = { beginner: "beginner", medium: "mediocre", mediocre: "mediocre", extreme: "expert", expert: "expert" };
  const toDisplay = { beginner: "beginner", mediocre: "medium", medium: "medium", expert: "extreme", extreme: "extreme" };

  const urlTier = toDisplay[slug]; // what we show in URLs
  const dbTier  = toDb[slug];      // what backend uses

  function block(reason, gotoUrl) {
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

  // 2) authoritative progress from server
  let cur = { solved: 0, total: 1, unlocked: false };
  try {
    const r = await fetch("/api/academy/progress", { credentials: "include", cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (data && data[dbTier]) cur = data[dbTier];
    }
  } catch {}

  // If tier not unlocked at all (e.g., medium before finishing beginner), bounce
  if (!cur.unlocked) {
    block(`The ${urlTier} tier is locked. Finish the previous tier to unlock it.`, "/academy");
  }

  // 3) gate by nextAllowed using server totals
  const nextAllowed = Math.min((cur.solved || 0) + 1, cur.total || 1);
  if (level > nextAllowed) {
    const tip = (cur.solved || 0)
      ? `You’ve solved ${cur.solved} ${urlTier} level${cur.solved === 1 ? "" : "s"}. Next unlocked is ${urlTier} ${cur.solved + 1}.`
      : `You haven’t solved any ${urlTier} levels yet. Start at ${urlTier} 1.`;
    block(
      `You haven’t unlocked ${urlTier} ${level} yet. ${tip}`,
      `/academy/${urlTier}/${nextAllowed}`
    );
  }
})();
