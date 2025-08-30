function getCSRFToken(){
  const m = document.cookie.match(/csrf_access_token=([^;]+)/);
  return m ? m[1] : '';
}

async function saveProgress(answer){
  try{
    const r = await fetch('/api/academy/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-CSRF-TOKEN':getCSRFToken()},
      credentials:'include',
      body:JSON.stringify({ tier: DB_TIER, challenge: LEVEL, answer })
    });
    const data = await r.json().catch(()=>({}));
    return { ok: r.ok && data && data.ok, data };
  }catch(e){ return { ok:false, data:null }; }
}

async function init(){
  const status = document.getElementById('status');
  const form = document.getElementById('answer-form');
  const input = document.getElementById('answer');
  const submitBtn = document.getElementById('submit-btn');
  const card = document.querySelector('.challenge-card');
  if (card) card.style.display = 'none';

  // login gate
  let signedIn = false;
  try{
    const me = await fetch('/me',{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json():null);
    signedIn = !!(me && (me.username || me.user || me.email));
  }catch(e){}
  if(!signedIn){
    document.getElementById('signin-note')?.classList.remove('hidden');
    form?.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    document.querySelector('.loader')?.remove();
    return;
  }

  // server truth for solved/total
  let solved = 0, total = 1;
  try{
    const prog = await fetch('/api/academy/progress',{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json():null);
    solved = prog?.[DB_TIER]?.solved || 0;
    total  = prog?.[DB_TIER]?.total  || 1;
  }catch(e){}

  const nextAllowed = Math.min(solved + 1, total);

  // hard gate
  if (LEVEL > nextAllowed){
    status.className = 'status-line err';
    status.textContent = `🔒 You haven't unlocked Level ${LEVEL} yet. Redirecting to Level ${nextAllowed}…`;
    form?.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    setTimeout(()=>{ window.location.href = `/academy/${URL_TIER}/${nextAllowed}`; }, 800);
    document.querySelector('.loader')?.remove();
    return;
  }

  if (card) card.style.display = '';

  // already complete
  if (solved >= LEVEL){
    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = false;
    status.className = 'status-line ok';
    status.textContent = '✅ Already complete!';
  }

  // submit
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    status.textContent = '';
    const { ok, data } = await saveProgress(input.value);
    if (ok){
      if (input) input.disabled = true;
      if (submitBtn) submitBtn.disabled = false;
      status.className = 'status-line ok';
      status.textContent = '✅ Correct!';
      submitBtn.textContent = '➡️ Go to Next Level';
      submitBtn.onclick = () => {
          const aliasOut = { beginner:'beginner', mediocre:'medium', expert:'extreme' };
          let next = (data && data.next) || NEXT_LEVEL_URL;
          next = next.replace(/\/academy\/(beginner|mediocre|expert)\//,
                              (_, t) => `/academy/${aliasOut[t]}/`);
          window.location.href = next;
        };
    }else{
      status.className = 'status-line err';
      status.textContent = (data && data.msg) ? `❌ ${data.msg}` : '❌ That’s not quite right.';
    }
  });

  input?.addEventListener('keydown', e=>{ if(e.key==='Enter') form.requestSubmit(); });
  document.querySelector('.loader')?.remove();
}

document.addEventListener('DOMContentLoaded', init);
