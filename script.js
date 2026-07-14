/* ============================================================
   REELMIND — app logic
   All thumbnails/previews are painted on <canvas> at runtime,
   so nothing depends on external image/video URLs that could
   fail to load.

   TO CONNECT YOUR REAL fal.ai BACKEND (app.py on Railway):
   set BACKEND_URL below to your deployed endpoint and set
   DEMO_MODE = false. callBackend() already speaks the
   submit → status → result protocol your Flask proxy expects.
   ============================================================ */
const DEMO_MODE = true;
const BACKEND_URL = "https://YOUR-APP.up.railway.app/api/generate";

const UNLIMITED_CREDITS = true;
let credits = 24; // ignored when UNLIMITED_CREDITS is true
let renders = 32;

const styles = [
  {name:"Cinematic", hue:32},
  {name:"Anime", hue:210},
  {name:"Realistic", hue:190},
  {name:"Noir", hue:0},
  {name:"Claymation", hue:20},
  {name:"Cyberpunk", hue:290},
];
let selectedStyle = styles[0];

const feed = [
  {author:"nova.ai", cap:"A lone cyclist crossing a foggy bridge at dawn, slow tracking shot", tag:"Cinematic · 8s", hue:32, likes:"12.4k"},
  {author:"pixel.dreams", cap:"Neon Tokyo alley at night, rain reflections, cyberpunk", tag:"Cyberpunk · 8s", hue:290, likes:"8.9k"},
  {author:"studio.vex", cap:"Paper boat drifting down an ink-black river", tag:"Noir · 4s", hue:0, likes:"5.2k"},
  {author:"aria.render", cap:"Drone shot over glacier crevasse, golden hour", tag:"Realistic · 8s", hue:195, likes:"21.1k"},
];

const library = [
  {t:"Foggy bridge cyclist", m:"2 min ago", dur:"8s", hue:32},
  {t:"Neon tokyo alley", m:"Yesterday", dur:"8s", hue:210},
  {t:"Desert convoy dust", m:"2d ago", dur:"12s", hue:20},
  {t:"Paper boat, ink river", m:"3d ago", dur:"4s", hue:0},
  {t:"Clockwork city, dusk", m:"5d ago", dur:"8s", hue:280},
];

/* ---------- canvas art generator (stand-in for real thumbnails/video) ---------- */
function paintScene(canvas, hue, seed, animT){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const t = animT || 0;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue}, 40%, ${16 + Math.sin(t)*2}%)`);
  g.addColorStop(1, `hsl(${hue + 25}, 55%, 7%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  let r = seed || 1;
  function rnd(){ r = (r * 9301 + 49297) % 233280; return r / 233280; }
  for (let i = 0; i < 6; i++){
    ctx.beginPath();
    ctx.fillStyle = `hsla(${hue + i * 12}, 65%, ${45 + i * 3}%, ${0.05 + rnd() * 0.05})`;
    const ex = rnd() * w, ey = rnd() * h;
    ctx.ellipse(ex, ey, 40 + rnd() * 90, 30 + rnd() * 70, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = `hsla(${hue}, 60%, 75%, .22)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 18){
    const y = h * 0.6 + Math.sin(t * 1.4 + x * 0.025) * 12;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/* ---------- EXPLORE feed ---------- */
const feedStack = document.getElementById('feedStack');
const feedLoops = [];
feed.forEach((item, i) => {
  const card = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <canvas width="360" height="780"></canvas>
    <div class="shade"></div>
    <div class="feed-meta">
      <div class="author"><div class="av"></div>@${item.author}</div>
      <div class="cap">${item.cap}</div>
      <div class="tag">${item.tag}</div>
    </div>
    <div class="feed-side">
      <div class="sbtn"><div class="ic">♥</div><div class="n">${item.likes}</div></div>
      <div class="sbtn"><div class="ic">💬</div><div class="n">Chat</div></div>
      <div class="sbtn"><div class="ic">↗</div><div class="n">Share</div></div>
      <div class="sbtn"><div class="ic">⬇</div><div class="n">Save</div></div>
    </div>`;
  feedStack.appendChild(card);
  const canvas = card.querySelector('canvas');
  feedLoops.push({ canvas, hue: item.hue, seed: i + 3, t: i * 2 });
  card.querySelector('.sbtn:first-child').addEventListener('click', () => showToast('Liked'));
  card.querySelector('.sbtn:nth-child(3)').addEventListener('click', () => showToast('Link copied'));
  card.querySelector('.sbtn:last-child').addEventListener('click', () => showToast('Saved to Library'));
});
function animateFeed(){
  feedLoops.forEach(f => { f.t += 0.01; paintScene(f.canvas, f.hue, f.seed, f.t); });
  requestAnimationFrame(animateFeed);
}
animateFeed();

document.querySelectorAll('.feed-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (tab.dataset.feed === 'following') showToast('Follow creators to see them here');
  });
});
document.getElementById('openProfileFromFeed').addEventListener('click', () => showScreen('screen-profile'));

/* ---------- style chips (Create screen) ---------- */
const styleScroll = document.getElementById('styleScroll');
styles.forEach((s, i) => {
  const card = document.createElement('div');
  card.className = 'style-card' + (i === 0 ? ' active' : '');
  card.innerHTML = `<canvas width="80" height="104"></canvas><span>${s.name}</span>`;
  paintScene(card.querySelector('canvas'), s.hue, i + 20, i);
  card.addEventListener('click', () => {
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedStyle = s;
  });
  styleScroll.appendChild(card);
});

/* ---------- prompt chip toggles ---------- */
['pillRef', 'pillEnhance'].forEach(id => {
  document.getElementById(id).addEventListener('click', function () {
    this.classList.toggle('active');
  });
});

/* ---------- functional dropdowns ---------- */
function setupDropdown(selectId){
  const wrap = document.getElementById(selectId);
  const values = wrap.dataset.values.split(',');
  const valtext = wrap.querySelector('.valtext');
  const dropdown = wrap.querySelector('.mini-dropdown');
  dropdown.innerHTML = values.map(v => `<div data-v="${v}" class="${v === valtext.textContent ? 'sel' : ''}">${v}</div>`).join('');

  wrap.querySelector('div:first-child').addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.mini-dropdown.show').forEach(d => {
      if (d !== dropdown) { d.classList.remove('show'); d.closest('.mini-select').classList.remove('open'); }
    });
    dropdown.classList.toggle('show');
    wrap.classList.toggle('open');
  });
  dropdown.querySelectorAll('div').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      valtext.textContent = opt.dataset.v;
      dropdown.querySelectorAll('div').forEach(o => o.classList.remove('sel'));
      opt.classList.add('sel');
      dropdown.classList.remove('show');
      wrap.classList.remove('open');
    });
  });
}
setupDropdown('durationSelect');
setupDropdown('ratioSelect');
document.addEventListener('click', () => {
  document.querySelectorAll('.mini-dropdown.show').forEach(d => {
    d.classList.remove('show'); d.closest('.mini-select').classList.remove('open');
  });
});

/* ---------- library grid ---------- */
const libraryGrid = document.getElementById('libraryGrid');
function renderLibrary(){
  libraryGrid.innerHTML = '';
  if (library.length === 0){
    libraryGrid.innerHTML = '<div class="empty-hint">No renders yet.<br>Tap ✦ to create your first video.</div>';
    return;
  }
  library.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'lib-card';
    card.innerHTML = `
      <canvas width="200" height="266"></canvas>
      <div class="badge">${item.dur}</div>
      <div class="info"><div class="t">${item.t}</div><div class="m">${item.m}</div></div>`;
    paintScene(card.querySelector('canvas'), item.hue, i + 40, i);
    card.addEventListener('click', () => showToast('Opening preview…'));
    libraryGrid.appendChild(card);
  });
}
renderLibrary();

/* ---------- profile ---------- */
function updateProfile(){
  if (UNLIMITED_CREDITS){
    document.getElementById('planPill').textContent = `PRO · Unlimited`;
    document.getElementById('creditFill').style.width = '100%';
    document.getElementById('renderCount').textContent = renders;
    document.getElementById('creditNote').textContent = `Unlimited generations`;
  } else {
    document.getElementById('planPill').textContent = `PRO · ${credits} credits`;
    document.getElementById('creditFill').style.width = Math.max(0, Math.min(100, (credits / 50) * 100)) + '%';
    document.getElementById('renderCount').textContent = renders;
    document.getElementById('creditNote').textContent = `Uses 1 credit · ${credits} remaining`;
  }
}
updateProfile();

/* ---------- toast ---------- */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1700);
}

/* ---------- tab navigation ---------- */
const screens = document.querySelectorAll('.screen');
const tabs = document.querySelectorAll('.tab');
function showScreen(id){
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.screen === id));
}
tabs.forEach(tab => tab.addEventListener('click', () => showScreen(tab.dataset.screen)));

/* ---------- generation flow ---------- */
const goGenerate = document.getElementById('goGenerate');
const fabGenerate = document.getElementById('fabGenerate');
const genCanvas = document.getElementById('genCanvas');
const ringFg = document.getElementById('ringFg');
const genPct = document.getElementById('genPct');
const genStatus = document.getElementById('genStatus');
const genCaption = document.getElementById('genCaption');
const resultActions = document.getElementById('resultActions');
const downloadBtn = document.getElementById('downloadBtn');
const regenBtn = document.getElementById('regenBtn');
const promptInput = document.getElementById('promptInput');

const RING_CIRC = 2 * Math.PI * 38;
ringFg.style.strokeDasharray = RING_CIRC;
ringFg.style.strokeDashoffset = RING_CIRC;
function setRing(pct){ ringFg.style.strokeDashoffset = RING_CIRC - (RING_CIRC * pct) / 100; }

let resultAnimHandle = null;
function stopResultLoop(){ if (resultAnimHandle) { cancelAnimationFrame(resultAnimHandle); resultAnimHandle = null; } }
function startResultLoop(hue){
  let t = 0;
  function frame(){
    t += 0.01;
    paintScene(genCanvas, hue, 99, t);
    resultAnimHandle = requestAnimationFrame(frame);
  }
  frame();
}

function mapDuration(text){ const n = parseInt(text); return n <= 6 ? "5" : (n >= 10 ? "10" : "8"); }

async function callBackend(prompt, duration, ratio){
  const submitRes = await fetch(`${BACKEND_URL}?action=submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, duration, aspect_ratio: ratio })
  });
  if (!submitRes.ok) {
    const errBody = await submitRes.json().catch(() => ({}));
    throw new Error(errBody.error || ('Submit failed: ' + submitRes.status));
  }
  const submitData = await submitRes.json();
  const requestId = submitData.request_id;
  if (!requestId) throw new Error('No request_id returned from backend');

  let status = submitData.status;
  while (status !== 'COMPLETED') {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${BACKEND_URL}?action=status&request_id=${encodeURIComponent(requestId)}`);
    const statusData = await statusRes.json();
    status = statusData.status;
    if (status === 'IN_PROGRESS') genStatus.textContent = 'Rendering on fal.ai…';
    if (status === 'FAILED' || status === 'ERROR') throw new Error('Generation failed');
  }
  const resultRes = await fetch(`${BACKEND_URL}?action=result&request_id=${encodeURIComponent(requestId)}`);
  const resultData = await resultRes.json();
  return resultData.video?.url || resultData.video_url;
}

function demoGenerate(){
  return new Promise((resolve) => {
    const stages = [
      [500, 'Reading prompt…'],
      [800, 'Queuing on fal.ai…'],
      [1300, 'Composing first frame…'],
      [1500, 'Animating motion…'],
      [1200, 'Rendering — ' + selectedStyle.name + '…'],
      [700, 'Upscaling…'],
      [400, 'Finalizing…'],
    ];
    let i = 0, elapsed = 0;
    const total = stages.reduce((a, s) => a + s[0], 0);
    function nextStage(){
      if (i >= stages.length) { resolve(); return; }
      const [dur, label] = stages[i];
      genStatus.textContent = label;
      const start = performance.now();
      function tick(now){
        const stageElapsed = now - start;
        const pct = Math.min(100, Math.round(((elapsed + stageElapsed) / total) * 100));
        genPct.textContent = pct + '%';
        setRing(pct);
        if (stageElapsed < dur) requestAnimationFrame(tick);
        else { elapsed += dur; i++; nextStage(); }
      }
      requestAnimationFrame(tick);
    }
    nextStage();
  });
}

async function runGeneration(){
  if (!DEMO_MODE && !UNLIMITED_CREDITS && credits <= 0) { showToast('Out of credits'); return; }
  showScreen('screen-generate');
  stopResultLoop();
  const prompt = promptInput.value.trim() || 'Untitled shot';
  genCaption.textContent = '"' + prompt + '"';
  genCanvas.style.display = 'none';
  document.getElementById('genRing').style.display = 'flex';
  resultActions.classList.remove('show');
  genPct.textContent = '0%';
  setRing(0);
  genStatus.textContent = 'Sending prompt…';
  goGenerate.disabled = true;

  const durationTxt = document.querySelector('#durationSelect .valtext').textContent;
  const ratioTxt = document.querySelector('#ratioSelect .valtext').textContent;
  const duration = mapDuration(durationTxt);

  try {
    if (DEMO_MODE) {
      await demoGenerate();
    } else {
      await callBackend(prompt, duration, ratioTxt);
    }
    document.getElementById('genRing').style.display = 'none';
    genStatus.textContent = 'Done';
    genCanvas.style.display = 'block';
    startResultLoop(selectedStyle.hue);
    resultActions.classList.add('show');

    library.unshift({
      t: prompt.length > 30 ? prompt.slice(0, 30) + '…' : prompt,
      m: 'Just now', dur: durationTxt, hue: selectedStyle.hue
    });
    renders += 1;
    if (!DEMO_MODE && !UNLIMITED_CREDITS) credits = Math.max(0, credits - 1);
    renderLibrary();
    updateProfile();
  } catch (err) {
    document.getElementById('genRing').style.display = 'none';
    genStatus.textContent = 'Error: ' + err.message;
    console.error(err);
  } finally {
    goGenerate.disabled = false;
  }
}

goGenerate.addEventListener('click', runGeneration);
fabGenerate.addEventListener('click', () => { showScreen('screen-create'); document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', false)); });
regenBtn.addEventListener('click', runGeneration);

downloadBtn.addEventListener('click', () => {
  try {
    const link = document.createElement('a');
    link.href = genCanvas.toDataURL('image/png');
    link.download = 'reelmind-render-preview.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Preview frame saved');
  } catch (err) {
    showToast('Download failed');
  }
});
