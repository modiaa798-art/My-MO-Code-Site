// =============================================
// بِرمَجة - BIRMAJA GAME ENGINE (app.js)
// by Mohamed Diaa AbdALSalam
// =============================================

// =============================================
// SECTION 1: STATE & CONSTANTS
// =============================================

const XP_PER_CORRECT   = 10;
const XP_PER_LEVEL     = 100;
const QUESTION_LIMIT   = 15;
const DAILY_LIMIT      = 10;
const TIMER_SECONDS    = 30;
const ESSAY_TIMER_SECONDS = 90;   // وقت أطول للمقالي

let state = {};

function defaultState() {
  return {
    playerName: 'مبرمج جديد',
    avatar: '🧑‍💻',
    xp: 0,
    level: 1,
    totalCorrect: 0,
    totalWrong: 0,
    chaptersCompleted: [],
    questionsAnswered: 0,
    streak: 0,
    lastDailyDate: '',
    soundOn: true,
    volume: 0.7,
    darkMode: false,
    achievements: [],
  };
}

// =============================================
// SECTION 2: LOCAL STORAGE
// =============================================

function loadState() {
  try {
    const saved = localStorage.getItem('birmaja_state');
    // migrate old key
    const oldSaved = localStorage.getItem('codemaster_state');
    const src = saved || oldSaved;
    state = src ? { ...defaultState(), ...JSON.parse(src) } : defaultState();
  } catch { state = defaultState(); }
}

function saveState() {
  localStorage.setItem('birmaja_state', JSON.stringify(state));
}

function resetState() {
  showResetConfirm();
}

function doReset() {
  localStorage.removeItem('birmaja_state');
  localStorage.removeItem('codemaster_state');
  state = defaultState();
  saveState();
  updateHomeUI();
  closeSettings();
  showCustomAlert('✅', 'تم بنجاح', 'تم إعادة تعيين كل بياناتك.');
}

// =============================================
// SECTION 3: CUSTOM MODAL SYSTEM
// (بدل alert/confirm تماماً)
// =============================================

function showCustomAlert(icon, title, msg, onOk) {
  el('custom-alert-icon').textContent = icon || 'ℹ️';
  el('custom-alert-title').textContent = title || '';
  el('custom-alert-msg').textContent = msg || '';
  el('custom-alert-modal').style.display = 'flex';
  el('custom-alert-modal')._onOk = onOk || null;
}

function closeCustomAlert() {
  const modal = el('custom-alert-modal');
  const cb = modal._onOk;
  modal.style.display = 'none';
  modal._onOk = null;
  if (typeof cb === 'function') cb();
}

function showResetConfirm() {
  el('reset-confirm-modal').style.display = 'flex';
}

function closeResetConfirm() {
  el('reset-confirm-modal').style.display = 'none';
}

function showDailyDone() {
  el('daily-done-modal').style.display = 'flex';
}

function closeDailyDone() {
  el('daily-done-modal').style.display = 'none';
}

// =============================================
// SECTION 4: AUDIO ENGINE
// =============================================

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTone(freq, type, duration, vol = 0.3) {
  if (!state.soundOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * state.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

const SFX = {
  click:   () => playTone(600, 'sine', 0.1, 0.2),
  correct: () => { playTone(523,'sine',0.1,0.25); setTimeout(()=>playTone(659,'sine',0.15,0.3),100); setTimeout(()=>playTone(784,'sine',0.2,0.35),220); },
  wrong:   () => { playTone(300,'sawtooth',0.15,0.3); setTimeout(()=>playTone(220,'sawtooth',0.2,0.35),160); },
  levelup: () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.3,0.4),i*120)); },
  victory: () => { [523,659,784,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.25,0.35),i*150)); },
};

// =============================================
// SECTION 5: SCREEN NAVIGATION
// =============================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// =============================================
// SECTION 6: LOADING & INIT
// =============================================

window.onload = () => {
  loadState();
  applyDarkMode();

  const loadFill = el('load-fill');
  let progress = 0;
  const iv = setInterval(() => {
    progress += 4;
    if (loadFill) loadFill.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(iv);
      el('loading-screen').classList.remove('active');
      showScreen('home-screen');
      renderChapters();
      updateHomeUI();
    }
  }, 40);

  bindEvents();
};

// =============================================
// SECTION 7: HOME UI
// =============================================

function updateHomeUI() {
  el('home-name').textContent   = state.playerName;
  el('home-avatar').textContent = state.avatar;
  el('home-level').textContent  = `المستوى ${state.level}`;
  el('home-xp-text').textContent = `${state.xp} XP`;
  const xpInLevel = state.xp % XP_PER_LEVEL;
  el('home-xp-fill').style.width = (xpInLevel / XP_PER_LEVEL * 100) + '%';

  // الشاشة الرئيسية: أسئلة تم حلها فقط
  el('stat-questions').textContent = state.questionsAnswered;

  // الإعدادات: الصحيح والخاطئ والفصول والأيام
  if (el('sp-correct'))  el('sp-correct').textContent  = state.totalCorrect;
  if (el('sp-wrong'))    el('sp-wrong').textContent    = state.totalWrong;
  if (el('sp-chapters')) el('sp-chapters').textContent = state.chaptersCompleted.length;
  if (el('sp-streak'))   el('sp-streak').textContent   = state.streak;
}

// =============================================
// SECTION 8: RENDER CHAPTERS
// =============================================

function renderChapters() {
  const grid = el('chapters-grid');
  if (!grid || typeof CHAPTERS === 'undefined') return;

  grid.innerHTML = CHAPTERS.map(ch => {
    const done = state.chaptersCompleted.includes(ch.id);
    return `
      <div class="chapter-card ${done ? 'done' : ''}" style="border-top:5px solid ${ch.color}" onclick="startChapter(${ch.id})">
        <div class="ch-icon">${ch.icon}</div>
        <div class="ch-title">${ch.title}</div>
        <div class="ch-count">${ch.questions.length} سؤال ${done ? '✅' : ''}</div>
        ${ch.isReview ? '<div class="ch-badge">مراجعة</div>' : ''}
      </div>`;
  }).join('');
}

// =============================================
// SECTION 9: GAME SESSION STATE
// =============================================

let session = {};

function initSession(questions, title, chapterId) {
  const shuffled = shuffle([...questions]).slice(0, QUESTION_LIMIT);
  session = {
    questions: shuffled,
    title,
    chapterId: chapterId || null,
    current: 0,
    correct: 0,
    wrong: 0,
    xpEarned: 0,
    streak: 0,
    answers: [],
    timerInterval: null,
    timeLeft: TIMER_SECONDS,
    answered: false,
    isDaily: false,
  };
}

// =============================================
// SECTION 10: START GAME MODES
// =============================================

function startChapter(id) {
  const ch = CHAPTERS.find(c => c.id === id);
  if (!ch) return;
  SFX.click();
  initSession(ch.questions, ch.title, ch.id);   // ← نمرر الـ id
  showScreen('game-screen');
  renderQuestion();
}

function startFullExam() {
  SFX.click();
  const all = CHAPTERS.flatMap(ch => ch.questions);
  initSession(all, 'امتحان شامل', null);
  showScreen('game-screen');
  renderQuestion();
}

function startDailyChallenge() {
  SFX.click();
  const today = new Date().toDateString();
  if (state.lastDailyDate === today) {
    showDailyDone();
    return;
  }
  const all = CHAPTERS.flatMap(ch => ch.questions);
  const q   = shuffle([...all]).slice(0, DAILY_LIMIT);
  initSession(q, '⚡ تحدي اليوم', null);
  session.isDaily = true;
  showScreen('game-screen');
  renderQuestion();
}

// =============================================
// SECTION 11: RENDER QUESTION
// =============================================

function renderQuestion() {
  clearTimer();
  session.answered = false;

  const q     = session.questions[session.current];
  const num   = session.current + 1;
  const total = session.questions.length;

  el('game-chapter-title').textContent = session.title;
  el('q-counter').textContent = `${num} / ${total}`;
  el('q-number').textContent  = `السؤال ${num}`;
  el('q-text').textContent    = q.text;

  const diffMap = {
    easy:   { label: 'سهل',    color: 'var(--success)' },
    medium: { label: 'متوسط',  color: 'var(--warning)' },
    hard:   { label: 'صعب',    color: 'var(--danger)'  },
  };
  const diff = diffMap[q.difficulty] || diffMap.easy;
  el('q-difficulty').textContent = diff.label;
  el('q-difficulty').style.background = diff.color + '22';
  el('q-difficulty').style.color = diff.color;

  if (q.code) {
    el('q-code-block').style.display = 'block';
    el('q-code-block').textContent = q.code;
  } else {
    el('q-code-block').style.display = 'none';
  }

  el('progress-fill').style.width = ((num - 1) / total * 100) + '%';

  el('correct-count').textContent = session.correct;
  el('wrong-count').textContent   = session.wrong;
  el('current-xp').textContent    = session.xpEarned;
  el('streak-count').textContent  = session.streak;

  const fb = el('feedback-bar');
  fb.style.display = 'none';
  fb.className = 'feedback-bar';

  if (q.type === 'mcq') {
    el('options-grid').style.display = 'grid';
    el('essay-area').style.display   = 'none';
    renderOptions(q);
  } else {
    el('options-grid').style.display = 'none';
    el('essay-area').style.display   = 'block';
    el('essay-input').value = '';
    el('essay-input').disabled = false;
    el('essay-submit').disabled = false;
  }

  startTimer(q.type === 'essay' ? ESSAY_TIMER_SECONDS : TIMER_SECONDS);
}

function renderOptions(q) {
  const opts = shuffle(q.options.map((o, i) => ({ text: o, origIndex: i })));
  el('options-grid').innerHTML = opts.map((o, i) => `
    <button class="option-btn" onclick="selectOption(this, ${o.origIndex}, ${q.answer}, '${escStr(q.explanation || '')}')">
      <span class="opt-letter">${['أ','ب','ج','د'][i]}</span> ${o.text}
    </button>
  `).join('');
}

// =============================================
// SECTION 12: ANSWER HANDLING
// =============================================

function selectOption(btn, chosen, correct, explanation) {
  if (session.answered) return;
  session.answered = true;
  clearTimer();
  SFX.click();

  const isCorrect = chosen === correct;
  recordAnswer(isCorrect, explanation);

  document.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    const m = b.getAttribute('onclick').match(/selectOption\(this,\s*(\d+)/);
    const idx = m ? parseInt(m[1]) : -1;
    if (idx === correct) b.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');

  showFeedback(isCorrect, explanation);
}

function submitEssay() {
  if (session.answered) return;
  const q = session.questions[session.current];
  const answer = el('essay-input').value.trim();

  // ← رسالة مخصصة بدل alert()
  if (!answer) {
    el('essay-input').style.borderColor = 'var(--danger)';
    el('essay-input').placeholder = '⚠️ الإجابة لا يمكن أن تكون فارغة — اكتب شيئاً أولاً';
    el('essay-input').focus();
    // shake animation
    el('essay-input').classList.add('shake-field');
    setTimeout(() => {
      el('essay-input').classList.remove('shake-field');
      el('essay-input').style.borderColor = '';
      el('essay-input').placeholder = 'اكتب إجابتك هنا...';
    }, 2000);
    return;
  }

  session.answered = true;
  clearTimer();
  el('essay-input').disabled = true;
  el('essay-submit').disabled = true;

  const isCorrect = checkEssay(answer, q.keywords || []);
  recordAnswer(isCorrect, q.modelAnswer || '');
  showFeedback(isCorrect, `النموذج: ${q.modelAnswer || ''}`, true);
}

function checkEssay(answer, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const lower = answer.toLowerCase();
  const matched = keywords.filter(k => lower.includes(k.toLowerCase()));
  return matched.length >= Math.ceil(keywords.length * 0.4);
}

function recordAnswer(isCorrect, explanation) {
  const q = session.questions[session.current];
  session.answers.push({ q, isCorrect, explanation });

  if (isCorrect) {
    session.correct++;
    session.streak++;
    const xp = XP_PER_CORRECT + (session.streak >= 3 ? 5 : 0);
    session.xpEarned += xp;
    state.xp += xp;
    state.totalCorrect++;
    checkLevelUp();
    SFX.correct();
  } else {
    session.wrong++;
    session.streak = 0;
    state.totalWrong++;
    SFX.wrong();
  }
  state.questionsAnswered++;
  saveState();
  updateHomeUI();
  el('streak-count').textContent = session.streak;
}

function showFeedback(isCorrect, detail, isEssay = false) {
  const fb = el('feedback-bar');
  fb.style.display = 'flex';
  fb.className = 'feedback-bar ' + (isCorrect ? 'success' : 'error');
  el('fb-icon').textContent  = isCorrect ? '✅' : '❌';
  el('fb-title').textContent = isCorrect ? (isEssay ? 'إجابة مقبولة! 🎉' : 'إجابة صحيحة! 🎉') : 'إجابة خاطئة';
  el('fb-detail').textContent = detail || '';
  el('correct-count').textContent = session.correct;
  el('wrong-count').textContent   = session.wrong;
  el('current-xp').textContent    = session.xpEarned;
}

// =============================================
// SECTION 13: TIMER
// =============================================

function startTimer(seconds) {
  seconds = seconds || TIMER_SECONDS;
  session.timeLeft = seconds;
  el('timer-display').textContent = seconds;
  el('timer-box').style.color = 'var(--text-main)';

  session.timerInterval = setInterval(() => {
    session.timeLeft--;
    el('timer-display').textContent = session.timeLeft;
    if (session.timeLeft <= 10) el('timer-box').style.color = 'var(--danger)';
    if (session.timeLeft <= 0) {
      clearTimer();
      if (!session.answered) timeOut();
    }
  }, 1000);
}

function clearTimer() {
  if (session.timerInterval) { clearInterval(session.timerInterval); session.timerInterval = null; }
}

function timeOut() {
  session.answered = true;
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  el('essay-input') && (el('essay-input').disabled = true);
  showFeedback(false, '⏰ انتهى الوقت!');
  session.wrong++;
  session.streak = 0;
  session.answers.push({ q: session.questions[session.current], isCorrect: false, explanation: 'انتهى الوقت' });
  state.totalWrong++;
  state.questionsAnswered++;
  saveState();
  SFX.wrong();
}

// =============================================
// SECTION 14: NEXT QUESTION / END GAME
// =============================================

function nextQuestion() {
  session.current++;
  if (session.current >= session.questions.length) {
    endGame();
  } else {
    renderQuestion();
  }
}

function endGame() {
  clearTimer();
  const total   = session.questions.length;
  const correct = session.correct;
  const pct     = Math.round(correct / total * 100);
  const xp      = session.xpEarned;

  let stars = 1;
  if (pct >= 50) stars = 2;
  if (pct >= 75) stars = 3;
  if (pct >= 90) stars = 4;
  if (pct === 100) stars = 5;

  el('res-correct').textContent = correct;
  el('res-wrong').textContent   = session.wrong;
  el('res-score').textContent   = pct + '%';
  el('res-xp').textContent      = '+' + xp;
  el('results-title').textContent = pct >= 80 ? 'ممتاز! 🏆' : pct >= 60 ? 'أحسنت! 👍' : pct >= 40 ? 'جيد، استمر!' : 'حاول مرة أخرى!';
  el('results-trophy').textContent = pct === 100 ? '🏆' : pct >= 80 ? '🥇' : pct >= 60 ? '🥈' : '🥉';
  el('stars-display').textContent = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);

  // ✅ إصلاح: حفظ الفصل المكتمل بشكل صحيح
  if (session.chapterId && pct >= 60 && !state.chaptersCompleted.includes(session.chapterId)) {
    state.chaptersCompleted.push(session.chapterId);
  }

  // daily streak
  if (session.isDaily) {
    const today = new Date().toDateString();
    if (state.lastDailyDate !== today) {
      state.streak++;
      state.lastDailyDate = today;
    }
  }

  saveState();
  updateHomeUI();

  el('level-up-banner').style.display = 'none';
  showScreen('results-screen');

  if (pct >= 80) {
    SFX.victory();
    launchConfetti();
  }

  checkAchievements();
}

// =============================================
// SECTION 15: LEVEL SYSTEM
// =============================================

function checkLevelUp() {
  const newLevel = Math.floor(state.xp / XP_PER_LEVEL) + 1;
  if (newLevel > state.level) {
    state.level = newLevel;
    el('new-level').textContent = newLevel;
    el('level-up-banner').style.display = 'block';
    SFX.levelup();
    saveState();
  }
}

// =============================================
// SECTION 16: REVIEW SCREEN
// =============================================

function renderReview() {
  const list = el('review-list');
  list.innerHTML = session.answers.map((a, i) => {
    const q = a.q;
    const isEssay = q.type === 'essay';
    return `
      <div class="review-item" style="border-right: 4px solid ${a.isCorrect ? 'var(--success)' : 'var(--danger)'}">
        <div style="font-weight:800; margin-bottom:8px;">${i+1}. ${q.text}</div>
        ${isEssay
          ? `<div style="color:var(--text-muted); margin-bottom:8px;">النموذج: ${q.modelAnswer || '-'}</div>`
          : `<div style="color:var(--text-muted); margin-bottom:8px;">الإجابة الصحيحة: ${q.options ? q.options[q.answer] : '-'}</div>`
        }
        <div style="color:${a.isCorrect ? 'var(--success)' : 'var(--danger)'}">
          ${a.isCorrect ? '✅ صح' : '❌ خطأ'}
        </div>
        ${a.explanation ? `<div style="margin-top:8px; font-size:0.9rem; color:var(--text-muted)">💡 ${a.explanation}</div>` : ''}
      </div>`;
  }).join('');
}

// =============================================
// SECTION 17: ACHIEVEMENTS
// =============================================

const ACHIEVEMENTS_DEF = [
  { id: 'first_correct',  icon: '🎯', name: 'أول إجابة صحيحة',   condition: s => s.totalCorrect >= 1 },
  { id: 'ten_correct',    icon: '🔟', name: '10 إجابات صحيحة',  condition: s => s.totalCorrect >= 10 },
  { id: 'fifty_correct',  icon: '🏅', name: '50 إجابة صحيحة',   condition: s => s.totalCorrect >= 50 },
  { id: 'level5',         icon: '⬆️', name: 'المستوى 5',         condition: s => s.level >= 5 },
  { id: 'chapter1',       icon: '📚', name: 'أكملت فصلاً',       condition: s => s.chaptersCompleted.length >= 1 },
  { id: 'three_chapters', icon: '📖', name: 'ثلاثة فصول!',       condition: s => s.chaptersCompleted.length >= 3 },
  { id: 'streak3',        icon: '🔥', name: 'سلسلة 3 أيام',      condition: s => s.streak >= 3 },
  { id: 'xp500',          icon: '⚡', name: '500 XP مكتسب',     condition: s => s.xp >= 500 },
];

function checkAchievements() {
  ACHIEVEMENTS_DEF.forEach(ach => {
    if (!state.achievements.includes(ach.id) && ach.condition(state)) {
      state.achievements.push(ach.id);
      saveState();
      showAchievementPopup(ach);
    }
  });
}

function showAchievementPopup(ach) {
  el('ach-icon').textContent = ach.icon;
  el('ach-name').textContent = ach.name;
  const popup = el('achievement-popup');
  popup.style.display = 'flex';
  setTimeout(() => { popup.style.display = 'none'; }, 3500);
}

function renderAchievementsScreen() {
  el('achievements-grid').innerHTML = ACHIEVEMENTS_DEF.map(ach => {
    const unlocked = state.achievements.includes(ach.id);
    return `
      <div class="chapter-card" style="opacity:${unlocked ? 1 : 0.4}; border-top:5px solid var(--warning)">
        <div class="ch-icon">${ach.icon}</div>
        <div class="ch-title">${ach.name}</div>
        <div class="ch-count">${unlocked ? '✅ مُفتَح' : '🔒 مغلق'}</div>
      </div>`;
  }).join('');
}

// =============================================
// SECTION 18: CONFETTI
// =============================================

function launchConfetti() {
  const canvas = el('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    w: Math.random() * 12 + 6,
    h: Math.random() * 6 + 4,
    color: `hsl(${Math.random()*360},80%,60%)`,
    rot: Math.random() * 360,
    speed: Math.random() * 3 + 2,
    spin: Math.random() * 6 - 3,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.y += p.speed;
      p.rot += p.spin;
    });
    frame++;
    if (frame < 200) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// =============================================
// SECTION 19: DARK MODE
// =============================================

function applyDarkMode() {
  document.body.classList.toggle('dark-mode', state.darkMode);
  el('dark-toggle').textContent = state.darkMode ? '☀️' : '🌙';
}

// =============================================
// SECTION 20: SETTINGS
// =============================================

function openSettings() {
  el('player-name-input').value = state.playerName;
  el('volume-slider').value = Math.round(state.volume * 100);
  el('settings-modal').style.display = 'flex';
}

function closeSettings() {
  const name = el('player-name-input').value.trim();
  if (name) { state.playerName = name; }
  state.volume = parseInt(el('volume-slider').value) / 100;
  saveState();
  updateHomeUI();
  el('settings-modal').style.display = 'none';
}

// =============================================
// SECTION 21: EVENT BINDINGS
// =============================================

function bindEvents() {
  // الشاشة الرئيسية
  el('btn-chapters').addEventListener('click', () => { SFX.click(); showScreen('chapters-screen'); renderChapters(); });
  el('btn-full-exam').addEventListener('click', startFullExam);
  el('btn-daily').addEventListener('click', startDailyChallenge);
  el('btn-achievements').addEventListener('click', () => { SFX.click(); showScreen('achievements-screen'); renderAchievementsScreen(); });

  // الإعدادات
  el('settings-btn').addEventListener('click', () => { SFX.click(); openSettings(); });
  el('close-settings').addEventListener('click', closeSettings);
  el('reset-progress').addEventListener('click', resetState);

  // مودال إعادة التعيين
  el('reset-confirm-yes').addEventListener('click', () => { closeResetConfirm(); doReset(); });
  el('reset-confirm-no').addEventListener('click', closeResetConfirm);

  // مودال التنبيه المخصص
  el('custom-alert-ok').addEventListener('click', closeCustomAlert);

  // مودال التحدي اليومي
  el('daily-done-ok').addEventListener('click', closeDailyDone);

  // Dark mode / Sound
  el('dark-toggle').addEventListener('click', () => { state.darkMode = !state.darkMode; applyDarkMode(); saveState(); SFX.click(); });
  el('sound-toggle').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    el('sound-toggle').textContent = state.soundOn ? '🔊' : '🔇';
    saveState();
  });

  // خروج اللعبة
  el('game-back').addEventListener('click', () => {
    SFX.click();
    el('exit-modal').style.display = 'flex';
  });
  el('exit-confirm-btn').addEventListener('click', () => {
    el('exit-modal').style.display = 'none';
    clearTimer();
    showScreen('home-screen');
  });
  el('exit-cancel-btn').addEventListener('click', () => {
    el('exit-modal').style.display = 'none';
  });

  // التالي
  el('next-btn').addEventListener('click', () => { SFX.click(); nextQuestion(); });

  // مقال
  el('essay-submit').addEventListener('click', submitEssay);

  // ← Enter في حقل المقال يرسل الإجابة
  el('essay-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) submitEssay();
  });

  // نتائج
  el('review-btn').addEventListener('click', () => { SFX.click(); renderReview(); showScreen('review-screen'); });
  el('retry-btn').addEventListener('click', () => {
    SFX.click();
    // ✅ إصلاح: نحتفظ بالـ chapterId والـ questions الأصلية
    const origQuestions = session.answers.map(a => a.q);
    const origTitle = session.title;
    const origChapterId = session.chapterId;
    const wasDaily = session.isDaily;
    initSession(origQuestions, origTitle, origChapterId);
    session.isDaily = wasDaily;
    showScreen('game-screen');
    renderQuestion();
  });
  el('home-btn-res').addEventListener('click', () => { SFX.click(); showScreen('home-screen'); updateHomeUI(); });

  // مراجعة
  el('review-back').addEventListener('click', () => { SFX.click(); showScreen('results-screen'); });

  // صوت
  el('volume-slider').addEventListener('input', e => {
    state.volume = parseInt(e.target.value) / 100;
  });

  // إغلاق الـ modals بالنقر خارجها
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        // لا نغلق مودال الخروج والحذف بالنقر الخارجي — فقط التنبيه والإعدادات
        if (overlay.id === 'settings-modal') closeSettings();
        if (overlay.id === 'custom-alert-modal') closeCustomAlert();
        if (overlay.id === 'daily-done-modal') closeDailyDone();
      }
    });
  });
}

// =============================================
// SECTION 22: UTILITIES
// =============================================

function el(id) { return document.getElementById(id); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

// =============================================
// SECTION 23: NOTES (دفتر الملاحظات)
// =============================================

const NOTES_KEY = 'birmaja_notes';

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY)) || [];
  } catch { return []; }
}

function saveNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function renderNotes() {
  const notes = loadNotes();
  const list = el('notes-list');
  if (!list) return;

  if (notes.length === 0) {
    list.innerHTML = `
      <div class="notes-empty">
        <svg viewBox="0 0 24 24" width="56" height="56">
          <rect x="3" y="2" width="15" height="19" rx="2" fill="var(--border-color)"/>
          <line x1="6.5" y1="7"  x2="14.5" y2="7"  stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="6.5" y1="10" x2="14.5" y2="10" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="6.5" y1="13" x2="11"   y2="13" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>لا توجد ملاحظات بعد<br><small>اكتب أول ملاحظة لك!</small></span>
      </div>`;
    return;
  }

  list.innerHTML = notes.map((n, i) => `
    <div class="note-item" id="note-${i}">
      <div style="flex:1">
        <div class="note-text">${escapeHtml(n.text)}</div>
        <div class="note-meta">📅 ${n.date}</div>
      </div>
      <button class="note-delete" onclick="deleteNote(${i})" title="حذف">🗑</button>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addNote() {
  const input = el('notes-input');
  const text = input.value.trim();
  if (!text) {
    input.style.borderColor = 'var(--danger)';
    input.focus();
    setTimeout(() => { input.style.borderColor = ''; }, 1000);
    return;
  }
  const notes = loadNotes();
  const now = new Date();
  const date = now.toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  notes.unshift({ text, date });
  saveNotes(notes);
  input.value = '';
  renderNotes();

  // scroll to top of list
  const list = el('notes-list');
  if (list) list.scrollTop = 0;
}

function deleteNote(index) {
  const notes = loadNotes();
  notes.splice(index, 1);
  saveNotes(notes);
  renderNotes();
}

function openNotesModal() {
  renderNotes();
  el('notes-modal').style.display = 'flex';
  setTimeout(() => el('notes-input') && el('notes-input').focus(), 150);
}

function closeNotesModal() {
  el('notes-modal').style.display = 'none';
}

// ربط الأحداث
document.addEventListener('DOMContentLoaded', function() {
  const fab = el('notes-fab');
  if (fab) fab.addEventListener('click', openNotesModal);

  const closeBtn = el('notes-close');
  if (closeBtn) closeBtn.addEventListener('click', closeNotesModal);

  const addBtn = el('notes-add');
  if (addBtn) addBtn.addEventListener('click', addNote);

  const input = el('notes-input');
  if (input) {
    input.addEventListener('keydown', function(e) {
      // Ctrl+Enter أو Cmd+Enter لإضافة الملاحظة
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        addNote();
      }
    });
  }

  // إغلاق عند الضغط على الخلفية
  const modal = el('notes-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeNotesModal();
    });
  }
});