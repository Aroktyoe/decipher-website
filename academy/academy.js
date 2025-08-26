function getCSRFToken() {
  const m = document.cookie.match(/csrf_access_token=([^;]+)/);
  return m ? m[1] : '';
}

async function saveProgress(answer){
  try {
    const r = await fetch('/api/academy/submit', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-CSRF-TOKEN': getCSRFToken() },
      credentials: 'include',
      body: JSON.stringify({ tier: TIER, challenge: LEVEL, answer })
    });
    const data = await r.json().catch(()=> ({}));
    if (r.ok && data && data.ok){
      // mirror server state locally so client + server stay in sync
      const key = 'academy-progress';
      const cur = JSON.parse(localStorage.getItem(key) || '{}');
      const next = {...cur};
      next[TIER] = Math.max(next[TIER] || 0, LEVEL);
      localStorage.setItem(key, JSON.stringify(next));
      return true;
    }
  } catch(e){}
  return false;
}

async function init(){
  const status = document.getElementById('status');
  const form = document.getElementById('answer-form');
  const input = document.getElementById('answer');
  const submitBtn = document.getElementById('submit-btn');

  // gate by login
  let signedIn = false;
  try{
    const me = await fetch('/me', { credentials:'include', cache:'no-store' }).then(r => r.ok ? r.json() : null);
    signedIn = !!(me && (me.username || me.user || me.email));
  }catch(e){}
  if(!signedIn){
    document.getElementById('signin-note').classList.remove('hidden');
    form.querySelectorAll('input,button').forEach(el => el.disabled = true);
  }

  // Prefill "already complete" using /me; fallback to localStorage
  try {
    const r = await fetch('/me', {credentials:'include', cache:'no-store'});
    if (r.ok) {
      const me = await r.json();
      const solvedFromDB = (me.academy_progress && me.academy_progress[TIER]) ? me.academy_progress[TIER] : 0;

      if (solvedFromDB >= LEVEL) {
        input.disabled = true;
        submitBtn.disabled = true;
        status.className = 'status-line ok';
        status.textContent = '✅ Already complete!';
      } else {
        // only fallback to localStorage if server shows 0
        const cur = JSON.parse(localStorage.getItem('academy-progress') || '{}');
        if ((cur[TIER] || 0) >= LEVEL) {
          input.disabled = true;
          submitBtn.disabled = true;
          status.className = 'status-line ok';
          status.textContent = '✅ Already complete! (local cache)';
        }
      }
    }
  } catch(e){}


  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    status.textContent = '';
    const raw = input.value;

    const ok = await saveProgress(raw);
    if (ok){
      input.disabled = true;
      submitBtn.disabled = false;
      status.className = 'status-line ok';
      status.textContent = '✅ Correct!';
      submitBtn.textContent = '➡️ Go to Next Level';
      submitBtn.onclick = () => { window.location.href = NEXT_LEVEL_URL; };
    } else {
      status.className = 'status-line err';
      status.textContent = '❌ That’s not quite right.';
    }
  });

  input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') form.requestSubmit(); });

  document.querySelector('.loader')?.remove();
}

document.addEventListener('DOMContentLoaded', init);
