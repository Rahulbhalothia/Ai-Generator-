const screens = document.querySelectorAll('.screen');
const tabs = document.querySelectorAll('.tab');

function showScreen(id){
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.screen === id));
}

tabs.forEach(tab => tab.addEventListener('click', () => showScreen(tab.dataset.screen)));

// style card select
document.querySelectorAll('.style-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  });
});

// Navigate to generate screen and run generation
const goGenerate = document.getElementById('goGenerate');
const fabGenerate = document.getElementById('fabGenerate');
const genRing = document.getElementById('genRing');
const genPct = document.getElementById('genPct');
const genStatus = document.getElementById('genStatus');
const genVideo = document.getElementById('genVideo');
const genScan = document.getElementById('genScan');
const resultActions = document.getElementById('resultActions');
const downloadBtn = document.getElementById('downloadBtn');
const regenBtn = document.getElementById('regenBtn');
const genCaption = document.getElementById('genCaption');
const promptInput = document.getElementById('promptInput');

// ============================================================
// Talks to your backend (Flask app.py), which holds the fal.ai key
// server-side. No API key lives in this file.
//
// 👉 AFTER YOU DEPLOY TO RAILWAY: replace the URL below with your
// Railway public domain, e.g.
// "https://your-app-name.up.railway.app/api/generate"
// (Railway shows this under Settings → Networking → Generate Domain)
// ============================================================
const BACKEND_URL = "http://localhost:5000/api/generate";

function mapDuration(text){
  const n = parseInt(text);
  return n <= 6 ? "5" : "10";
}
function mapRatio(text){
  if (text.includes('9:16')) return '9:16';
  if (text.includes('1:1')) return '1:1';
  return '16:9';
}

async function callBackend(prompt, duration, ratio){
  // 1. submit job — backend forwards this to fal.ai's queue
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

  // 2. poll status until COMPLETED
  let status = submitData.status;
  while (status !== 'COMPLETED') {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${BACKEND_URL}?action=status&request_id=${encodeURIComponent(requestId)}`);
    const statusData = await statusRes.json();
    status = statusData.status;
    if (status === 'IN_PROGRESS') genStatus.textContent = 'Rendering on fal.ai…';
    if (status === 'FAILED' || status === 'ERROR') throw new Error('Generation failed');
  }

  // 3. fetch final result
  const resultRes = await fetch(`${BACKEND_URL}?action=result&request_id=${encodeURIComponent(requestId)}`);
  const resultData = await resultRes.json();
  return resultData.video?.url || resultData.video_url;
}

async function runGeneration(){
  showScreen('screen-generate');
  const prompt = promptInput.value.trim();
  genCaption.textContent = '"' + prompt + '"';
  genVideo.style.display = 'none';
  genRing.style.display = 'block';
  genScan.style.display = 'block';
  resultActions.classList.remove('show');
  genPct.style.display = 'none';
  genStatus.textContent = 'Sending prompt…';

  const duration = mapDuration(document.querySelectorAll('.mini-select')[0].textContent);
  const ratio = mapRatio(document.querySelectorAll('.mini-select')[1].textContent);

  try {
    const videoUrl = await callBackend(prompt, duration, ratio);
    genRing.style.display = 'none';
    genScan.style.display = 'none';
    genStatus.textContent = 'Done';
    genVideo.src = videoUrl;
    genVideo.style.display = 'block';
    genVideo.play();
    resultActions.classList.add('show');
  } catch (err) {
    genRing.style.display = 'none';
    genScan.style.display = 'none';
    genStatus.textContent = 'Error: ' + err.message;
    console.error(err);
  }
}

goGenerate.addEventListener('click', runGeneration);
fabGenerate.addEventListener('click', runGeneration);
regenBtn.addEventListener('click', runGeneration);

downloadBtn.addEventListener('click', async () => {
  try {
    const resp = await fetch(genVideo.src);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'reelmind-render.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    // fallback: open in new tab if CORS blocks the blob fetch
    window.open(genVideo.src, '_blank');
  }
});
