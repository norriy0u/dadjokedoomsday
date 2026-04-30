// ─── STATE & CONFIG ──────────────────────────────────────────────────────────
const ENEMY_JOKES = [
  "What do you call a fake noodle? An impasta!",
  "Why did the scarecrow win an award? He was outstanding in his field!",
  "I'm afraid for the calendar. Its days are numbered.",
  "What do you call a factory that makes okay products? A satisfactory.",
  "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.",
  "Why don't skeletons fight each other? They don't have the guts.",
  "I asked my dog how his day was. He said, 'Rough.'",
  "What do you call a fish wearing a bowtie? Sofishticated.",
  "I'm reading a book on anti-gravity. I can't put it down!",
  "Hi 'End of the World', I'm Dad!" // Wave 10 Boss
];

let wave = 1;
let health = 100;
let score = 0;
let streak = 0;
let villainX = 100; // starts off screen right
let gameLoopId;
let villainSpeed = 0;
let isEvaluating = false;

// ─── AUDIO SYSTEM ────────────────────────────────────────────────────────────
let aCtx;
function initAudio() {
  if(aCtx) return;
  aCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Battle Theme Loop
  const themeGain = aCtx.createGain();
  themeGain.gain.value = 0.05;
  themeGain.connect(aCtx.destination);
  
  const notes = [329.63, 392.00, 493.88]; // E minor arpeggio
  let noteIdx = 0;
  setInterval(() => {
    if(!aCtx || aCtx.state !== 'running') return;
    const o = aCtx.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = notes[noteIdx];
    noteIdx = (noteIdx+1)%notes.length;
    const g = aCtx.createGain(); g.gain.setValueAtTime(0.1, aCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, aCtx.currentTime+0.2);
    o.connect(g); g.connect(themeGain); o.start(); o.stop(aCtx.currentTime+0.2);
  }, 250);
}

function playSound(type) {
  if(!aCtx) return;
  const o = aCtx.createOscillator(), g = aCtx.createGain();
  o.connect(g); g.connect(aCtx.destination);
  
  const t = aCtx.currentTime;
  if(type === 'hit') {
    o.type = 'square';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(50, t+0.3);
    g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0, t+0.3);
    o.start(); o.stop(t+0.3);
  } else if(type === 'crit') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(523.25, t); o.frequency.setValueAtTime(659.25, t+0.1); o.frequency.setValueAtTime(783.99, t+0.2); o.frequency.setValueAtTime(1046.50, t+0.3);
    g.gain.setValueAtTime(0.4, t); g.gain.linearRampToValueAtTime(0, t+0.6);
    o.start(); o.stop(t+0.6);
  } else if(type === 'miss') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(300, t); o.frequency.linearRampToValueAtTime(150, t+0.6);
    g.gain.setValueAtTime(0.4, t); g.gain.linearRampToValueAtTime(0, t+0.6);
    o.start(); o.stop(t+0.6);
  }
}

// ─── CANVAS EFFECTS ──────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas-fx');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function createExplosion(x, y, color, sizeMultiplier) {
  for(let i=0; i<30 * sizeMultiplier; i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*15 * sizeMultiplier,
      vy: (Math.random()-0.5)*15 * sizeMultiplier,
      life: 1, color, size: Math.random()*10*sizeMultiplier + 5
    });
  }
}

function drawFX() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for(let i=particles.length-1; i>=0; i--) {
    let p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life -= 0.02;
    if(p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(drawFX);
}
drawFX();

// ─── GAME LOGIC ──────────────────────────────────────────────────────────────
const elVillain = document.getElementById('villain');
const elBubble = document.getElementById('villain-bubble');
const elHealth = document.getElementById('health-bar');
const elScore = document.getElementById('score-val');
const elStreak = document.getElementById('streak-val');
const elBurst = document.getElementById('comic-burst');

document.getElementById('btn-start').addEventListener('click', () => {
  document.getElementById('screen-start').classList.add('hidden');
  document.querySelectorAll('.hud, .controls, .actor').forEach(e => e.classList.remove('hidden'));
  initAudio();
  if(aCtx && aCtx.state === 'suspended') aCtx.resume();
  startWave();
});

function startWave() {
  if(wave > 10) { winGame(); return; }
  
  isEvaluating = false;
  document.getElementById('wave-display').textContent = `WAVE ${wave} OF 10`;
  elBubble.textContent = ENEMY_JOKES[wave-1];
  
  if(wave === 5) { elVillain.style.transform = 'scale(1.5)'; elVillain.innerHTML = `👹<div class="fuse"></div><div class="spark"></div><div class="speech-bubble villain-bubble" id="villain-bubble">${ENEMY_JOKES[wave-1]}</div>`; }
  if(wave === 10) { elVillain.style.transform = 'scale(2)'; elVillain.innerHTML = `💀<div class="fuse"></div><div class="spark"></div><div class="speech-bubble villain-bubble" id="villain-bubble">${ENEMY_JOKES[wave-1]}</div>`; }
  
  villainX = window.innerWidth;
  villainSpeed = 1 + (wave * 0.3); // gets faster
  elVillain.style.left = villainX + 'px';
  elBubble.classList.add('visible');
  document.getElementById('btn-fire').disabled = false;
  document.getElementById('joke-input').value = '';
  document.getElementById('joke-input').focus();
  
  gameLoopId = requestAnimationFrame(updateGame);
}

function updateGame() {
  if(isEvaluating) return;
  villainX -= villainSpeed;
  elVillain.style.left = villainX + 'px';
  
  // Hero is at 10vw + 120px = roughly 20vw. If villain reaches 25vw, damage!
  const heroX = window.innerWidth * 0.25;
  if(villainX < heroX) {
    takeDamage(20, 'TOO SLOW!');
    return; // stops loop
  }
  
  gameLoopId = requestAnimationFrame(updateGame);
}

function takeDamage(amt, msg) {
  isEvaluating = true;
  health -= amt;
  if(health <= 0) health = 0;
  elHealth.style.width = health + '%';
  if(health < 30) elHealth.style.backgroundColor = 'var(--villain-red)';
  
  streak = 0; elStreak.textContent = streak;
  playSound('miss');
  showBurst(msg, 'var(--villain-red)');
  createExplosion(window.innerWidth*0.15, window.innerHeight*0.8, '#e11d48', 1);
  
  if(health === 0) {
    setTimeout(loseGame, 1500);
  } else {
    setTimeout(() => {
      wave++; startWave();
    }, 2000);
  }
}

// ─── CLAUDE EVALUATION ───────────────────────────────────────────────────────
document.getElementById('btn-fire').addEventListener('click', async () => {
  const playerJoke = document.getElementById('joke-input').value.trim();
  if(!playerJoke) return;
  
  isEvaluating = true;
  document.getElementById('btn-fire').disabled = true;
  elBubble.textContent = "Processing...";
  
  const enemyJoke = ENEMY_JOKES[wave-1];
  const prompt = `You are the Judge of the Great Dad Joke War. The enemy threw this dad joke: '${enemyJoke}'. The hero responded with: '${playerJoke}'. Evaluate the hero's counter-joke. Reply ONLY in valid JSON: {"punPower": 0-100, "originality": 0-100, "verdict": "DEFLECTED"|"CRITICAL HIT"|"MISS"|"BACKFIRED", "battleNarration": "short comic sentence"}`;
  
  try {
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
    const text = await res.text();
    const match = text.match(/\{[\s\S]*\}/);
    let result = { punPower: 50, verdict: 'DEFLECTED', battleNarration: 'Not bad!' };
    if(match) result = JSON.parse(match[0]);
    
    resolveClash(result);
  } catch(e) {
    console.error(e);
    resolveClash({ punPower: 50, verdict: 'DEFLECTED', battleNarration: 'System glitch!' });
  }
});

function resolveClash(res) {
  const vx = villainX;
  const vy = window.innerHeight * 0.8;
  
  if(res.verdict === 'CRITICAL HIT' || res.punPower >= 80) {
    showBurst('CRITICAL!', 'var(--comic-yellow)');
    playSound('crit');
    createExplosion(vx, vy, '#facc15', 2);
    score += res.punPower * 2; streak++;
    elVillain.style.left = window.innerWidth + 'px'; // blown away
  } else if(res.verdict === 'DEFLECTED' || res.punPower >= 40) {
    showBurst('DEFLECTED!', '#3b82f6');
    playSound('hit');
    createExplosion(vx, vy, '#3b82f6', 1);
    score += res.punPower; streak++;
  } else {
    showBurst('GROAAN!', 'var(--villain-red)');
    playSound('miss');
    streak = 0;
    health -= 15;
    elHealth.style.width = health + '%';
    if(health <= 0) { setTimeout(loseGame, 1500); return; }
  }
  
  elScore.textContent = score; elStreak.textContent = streak;
  
  setTimeout(() => {
    wave++; startWave();
  }, 2000);
}

function showBurst(text, color) {
  elBurst.textContent = text;
  elBurst.style.color = color;
  elBurst.classList.remove('burst-anim');
  void elBurst.offsetWidth; // reflow
  elBurst.classList.add('burst-anim');
}

function winGame() {
  document.getElementById('screen-win').classList.remove('hidden');
  document.getElementById('win-score').textContent = score;
}

function loseGame() {
  document.getElementById('screen-lose').classList.remove('hidden');
  document.getElementById('lose-score').textContent = score;
  document.getElementById('city').classList.add('collapsed');
}

// ─── VOICE INPUT ─────────────────────────────────────────────────────────────
const btnVoice = document.getElementById('btn-voice');
const inputJoke = document.getElementById('joke-input');
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

if(SpeechRec) {
  const rec = new SpeechRec();
  rec.continuous = false;
  rec.interimResults = false;
  
  rec.onstart = () => btnVoice.classList.add('recording');
  rec.onresult = (e) => {
    inputJoke.value = e.results[0][0].transcript;
    btnVoice.classList.remove('recording');
  };
  rec.onerror = () => btnVoice.classList.remove('recording');
  rec.onend = () => btnVoice.classList.remove('recording');
  
  btnVoice.addEventListener('click', () => rec.start());
} else {
  btnVoice.style.display = 'none';
}
