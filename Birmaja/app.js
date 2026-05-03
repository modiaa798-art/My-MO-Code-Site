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
    highScores: {},       // { chapterId: percentage }
    onboardingDone: false,
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
  showToast('✅ تم حذف كل البيانات وإعادة التعيين', 'success');
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
// SECTION 5.5: TOAST NOTIFICATIONS
// =============================================

const TOAST_QUEUE = [];
let toastActive = false;

function showToast(msg, type = 'info', duration = 3000) {
  TOAST_QUEUE.push({ msg, type, duration });
  if (!toastActive) processToastQueue();
}

function processToastQueue() {
  if (TOAST_QUEUE.length === 0) { toastActive = false; return; }
  toastActive = true;
  const { msg, type, duration } = TOAST_QUEUE.shift();
  const container = document.getElementById('toast-container');
  if (!container) { processToastQueue(); return; }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️', xp: '⭐' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => { toast.remove(); processToastQueue(); }, 400);
  }, duration);
}



// =============================================
// SECTION 5: SCREEN NAVIGATION
// =============================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  syncBottomNav(id);
  // scroll to top
  window.scrollTo(0, 0);
}

// =============================================
// SECTION 6: LOADING & INIT
// =============================================

const CODING_QUOTES = [
  '"البرمجة هي فن حل المشاكل بطريقة إبداعية"',
  '"الكود الجيد يُقرأ كقصيدة شعر" — Donald Knuth',
  '"أولاً اجعله يعمل، ثم اجعله صحيحاً، ثم اجعله سريعاً"',
  '"كل مبرمج عظيم بدأ بـ Hello World"',
  '"console.log(\'مرحباً بعالم البرمجة!\');"',
  '"function dream() { return reality * effort; }"',
  '"Debug = كن محققاً في جريمة ارتكبتها أنت"',
  '"الخطأ الأول علّمني أكثر مما علّمتني كتب كثيرة"',
];

window.onload = () => {
  loadState();
  applyDarkMode();
  registerPWA();
  initOfflineDetection();

  const quoteEl = el('load-quote');
  if (quoteEl) quoteEl.textContent = CODING_QUOTES[Math.floor(Math.random() * CODING_QUOTES.length)];

  const loadFill = el('load-fill');
  const loadPct  = el('load-pct');
  let progress = 0;
  const iv = setInterval(() => {
    progress += 4;
    if (loadFill) loadFill.style.width = progress + '%';
    if (loadPct)  loadPct.textContent  = Math.min(progress, 100) + '%';
    if (progress >= 100) {
      clearInterval(iv);
      el('loading-screen').classList.remove('active');
      if (!state.onboardingDone) {
        showScreen('onboarding-screen');
        initOnboarding();
      } else {
        showScreen('home-screen');
        renderChapters();
        updateHomeUI();
      }
    }
  }, 40);

  bindEvents();
};

function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function initOfflineDetection() {
  function updateStatus() {
    const banner = el('offline-banner');
    if (!banner) return;
    if (!navigator.onLine) {
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }
  window.addEventListener('online',  () => { updateStatus(); showToast('✅ عاد الاتصال بالإنترنت', 'success'); });
  window.addEventListener('offline', () => { updateStatus(); showToast('📵 لا يوجد إنترنت — اللعبة تعمل offline!', 'info', 4000); });
  updateStatus();
}

function initOnboarding() {
  let currentSlide = 0;
  const totalSlides = 4;
  const slides = document.querySelectorAll('.ob-slide');
  const dots   = document.querySelectorAll('.ob-dot');
  const nextBtn = el('ob-next-btn');
  if (!nextBtn) return;

  document.querySelectorAll('#ob-avatar-grid .av-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ob-avatar-grid .av-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.avatar = btn.dataset.av;
      SFX.click();
    });
  });

  function goToSlide(n) {
    slides.forEach((s, i) => s.classList.toggle('active', i === n));
    dots.forEach((d, i)   => d.classList.toggle('active', i === n));
    currentSlide = n;
    nextBtn.textContent = n === totalSlides - 1 ? '🚀 ابدأ اللعب!' : 'التالي ←';
    if (n === 2) setTimeout(() => el('ob-name-input') && el('ob-name-input').focus(), 100);
  }

  nextBtn.addEventListener('click', () => {
    SFX.click();
    if (currentSlide === 2) {
      const name = el('ob-name-input') && el('ob-name-input').value.trim();
      if (name) state.playerName = name;
    }
    if (currentSlide === totalSlides - 1) {
      state.onboardingDone = true;
      saveState();
      showScreen('home-screen');
      renderChapters();
      updateHomeUI();
      showToast(`أهلاً ${state.playerName}! 🎉 ابدأ رحلتك الآن`, 'success', 3500);
    } else {
      goToSlide(currentSlide + 1);
    }
  });
}



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

  el('stat-questions').textContent = state.questionsAnswered;
  el('stat-chapters').textContent  = state.chaptersCompleted.length;
  el('stat-streak').textContent    = state.streak;

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
    const done      = state.chaptersCompleted.includes(ch.id);
    const hs        = (state.highScores && state.highScores[ch.id]) || 0;
    const answered  = state['ch_answered_' + ch.id] || 0;
    const total     = ch.questions.length;
    const pct       = total > 0 ? Math.round(answered / total * 100) : 0;
    const hsBadge   = hs > 0 ? `<div class="ch-hs">🏆 أعلى: ${hs}%</div>` : '';
    const progressBar = `
      <div class="ch-progress-wrap">
        <div class="ch-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="ch-progress-label">${pct}% تم الإجابة</div>
    `;
    return `
      <div class="chapter-card ${done ? 'done' : ''}" style="border-top:5px solid ${ch.color}" onclick="startChapter(${ch.id})">
        <div class="ch-icon">${ch.icon}</div>
        <div class="ch-title">${ch.title}</div>
        <div class="ch-count">${ch.questions.length} سؤال ${done ? '✅' : ''}</div>
        ${hsBadge}
        ${progressBar}
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
    haptic('success');
  } else {
    session.wrong++;
    session.streak = 0;
    state.totalWrong++;
    SFX.wrong();
    haptic('error');
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

  // تحديث العدادات مع animation
  function bumpEl(id, val) {
    const span = el(id);
    if (!span) return;
    span.textContent = val;
    span.classList.remove('bump');
    void span.offsetWidth;
    span.classList.add('bump');
    setTimeout(() => span.classList.remove('bump'), 300);
  }
  bumpEl('correct-count', session.correct);
  bumpEl('wrong-count',   session.wrong);
  bumpEl('current-xp',    session.xpEarned);
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

  // 🏆 حفظ الـ High Score
  if (session.chapterId) {
    if (!state.highScores) state.highScores = {};
    const prev = state.highScores[session.chapterId] || 0;
    if (pct > prev) {
      state.highScores[session.chapterId] = pct;
      if (prev > 0) showToast(`🏆 رقم قياسي جديد! ${pct}% في ${session.title}`, 'xp', 4000);
    }
    // تتبع عدد الأسئلة المُجابة لكل فصل
    state['ch_answered_' + session.chapterId] = (state['ch_answered_' + session.chapterId] || 0) + total;
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
    showToast(`🎉 ترقية! وصلت المستوى ${newLevel}`, 'xp', 4000);
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
  // إنجازات الإجابات الصحيحة
  { id: 'first_correct',    icon: '🎯', name: 'أول إجابة صحيحة',    condition: s => s.totalCorrect >= 1 },
  { id: 'ten_correct',      icon: '🔟', name: '10 إجابات صحيحة',    condition: s => s.totalCorrect >= 10 },
  { id: 'twenty_five',      icon: '💪', name: '25 إجابة صحيحة',     condition: s => s.totalCorrect >= 25 },
  { id: 'fifty_correct',    icon: '🏅', name: '50 إجابة صحيحة',     condition: s => s.totalCorrect >= 50 },
  { id: 'hundred_correct',  icon: '💯', name: '100 إجابة صحيحة',    condition: s => s.totalCorrect >= 100 },
  { id: 'legend_200',       icon: '🦁', name: '200 إجابة — أسطورة!', condition: s => s.totalCorrect >= 200 },

  // إنجازات المستوى
  { id: 'level3',           icon: '⬆️', name: 'المستوى 3',           condition: s => s.level >= 3 },
  { id: 'level5',           icon: '🚀', name: 'المستوى 5',           condition: s => s.level >= 5 },
  { id: 'level10',          icon: '👑', name: 'المستوى 10 — ملك!',   condition: s => s.level >= 10 },

  // إنجازات الفصول
  { id: 'chapter1',         icon: '📚', name: 'أكملت فصلاً',        condition: s => s.chaptersCompleted.length >= 1 },
  { id: 'three_chapters',   icon: '📖', name: 'ثلاثة فصول!',        condition: s => s.chaptersCompleted.length >= 3 },
  { id: 'five_chapters',    icon: '📕', name: 'خمسة فصول!',         condition: s => s.chaptersCompleted.length >= 5 },
  { id: 'all_chapters',     icon: '🎓', name: 'أكملت كل الفصول!',   condition: s => s.chaptersCompleted.length >= (typeof CHAPTERS !== 'undefined' ? CHAPTERS.length : 999) },

  // إنجازات الأيام المتتالية
  { id: 'streak3',          icon: '🔥', name: 'سلسلة 3 أيام',       condition: s => s.streak >= 3 },
  { id: 'streak7',          icon: '🌟', name: 'سلسلة أسبوع كامل!',  condition: s => s.streak >= 7 },
  { id: 'streak30',         icon: '🏆', name: 'شهر متواصل!',        condition: s => s.streak >= 30 },

  // إنجازات XP
  { id: 'xp100',            icon: '⚡', name: '100 XP مكتسب',       condition: s => s.xp >= 100 },
  { id: 'xp500',            icon: '💥', name: '500 XP مكتسب',       condition: s => s.xp >= 500 },
  { id: 'xp1000',           icon: '💎', name: '1000 XP — ماسي!',    condition: s => s.xp >= 1000 },
  { id: 'xp5000',           icon: '🌌', name: '5000 XP — خارق!',    condition: s => s.xp >= 5000 },

  // إنجازات خاصة
  { id: 'daily_done',       icon: '⚡', name: 'أكملت تحدي اليوم',   condition: s => s.lastDailyDate !== '' },
  { id: 'no_wrong',         icon: '🎖️', name: 'بدون أخطاء!',        condition: s => s.totalCorrect >= 10 && s.totalWrong === 0 },
  { id: 'speedster',        icon: '⚡', name: '50 سؤال تم حله',      condition: s => s.questionsAnswered >= 50 },
  { id: 'question_100',     icon: '🤖', name: '100 سؤال تم حله',     condition: s => s.questionsAnswered >= 100 },
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
  showToast(`${ach.icon} إنجاز جديد: ${ach.name}`, 'xp', 3000);
}

function renderAchievementsScreen() {
  const categories = [
    { label: '🎯 الإجابات الصحيحة', ids: ['first_correct','ten_correct','twenty_five','fifty_correct','hundred_correct','legend_200'] },
    { label: '⬆️ المستويات',         ids: ['level3','level5','level10'] },
    { label: '📚 الفصول',            ids: ['chapter1','three_chapters','five_chapters','all_chapters'] },
    { label: '🔥 الأيام المتتالية',  ids: ['streak3','streak7','streak30'] },
    { label: '⚡ نقاط XP',           ids: ['xp100','xp500','xp1000','xp5000'] },
    { label: '🌟 إنجازات خاصة',      ids: ['daily_done','no_wrong','speedster','question_100'] },
  ];

  const unlocked = state.achievements.length;
  const total = ACHIEVEMENTS_DEF.length;

  el('achievements-grid').innerHTML = `
    <div class="ach-summary">
      <div class="ach-sum-bar-wrap">
        <div class="ach-sum-bar" style="width:${Math.round(unlocked/total*100)}%"></div>
      </div>
      <div class="ach-sum-text">${unlocked} / ${total} إنجاز مفتوح</div>
    </div>
    ${categories.map(cat => {
      const items = ACHIEVEMENTS_DEF.filter(a => cat.ids.includes(a.id));
      return `
        <div class="ach-category">
          <div class="ach-cat-label">${cat.label}</div>
          <div class="ach-cat-grid">
            ${items.map(ach => {
              const isUnlocked = state.achievements.includes(ach.id);
              return `
                <div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}">
                  <div class="ach-card-icon">${isUnlocked ? ach.icon : '🔒'}</div>
                  <div class="ach-card-name">${ach.name}</div>
                  <div class="ach-card-status">${isUnlocked ? '✅ مفتوح' : 'مغلق'}</div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('')}
  `;
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
  // sync avatar
  document.querySelectorAll('#settings-avatar-grid .av-btn-sm').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.av === state.avatar);
  });
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

  // Avatar picker في الإعدادات
  document.querySelectorAll('#settings-avatar-grid .av-btn-sm').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settings-avatar-grid .av-btn-sm').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.avatar = btn.dataset.av;
      el('home-avatar').textContent = state.avatar;
      saveState();
      SFX.click();
      showToast(`تم اختيار الأفاتار ${btn.dataset.av}`, 'success');
    });
  });

  // Keyboard shortcuts button
  const showKb = el('show-kb-hints');
  if (showKb) showKb.addEventListener('click', () => { el('kb-hints').style.display = 'block'; closeSettings(); });
  const closeKb = el('kb-close');
  if (closeKb) closeKb.addEventListener('click', () => { el('kb-hints').style.display = 'none'; });

  // Global keyboard shortcuts (desktop)
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const active = document.querySelector('.screen.active');
    const screen = active ? active.id : '';

    if (e.key === '?') {
      const kb = el('kb-hints');
      kb.style.display = kb.style.display === 'none' ? 'block' : 'none';
      return;
    }
    if (e.key.toLowerCase() === 'h') { SFX.click(); showScreen('home-screen'); return; }
    if (e.key.toLowerCase() === 'd') { state.darkMode = !state.darkMode; applyDarkMode(); saveState(); return; }
    if (e.key.toLowerCase() === 's') { SFX.click(); openSettings(); return; }

    if (screen === 'game-screen' && !session.answered) {
      const optBtns = document.querySelectorAll('.option-btn:not([disabled])');
      const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (map[e.key] !== undefined && optBtns[map[e.key]]) {
        optBtns[map[e.key]].click();
      }
    }
    if (screen === 'game-screen' && session.answered && e.key === 'Enter') {
      SFX.click(); nextQuestion();
    }
  });

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

// Bottom Nav helper
function navTo(screenId, btn) {
  SFX.click();
  // لا تروح لشاشة اللعبة من الـ nav
  const gameActive = document.querySelector('#game-screen.active');
  if (gameActive) return;
  showScreen(screenId);
  updateHomeUI();
  // تفعيل الزرار الصح
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// sync bottom nav with current screen
function syncBottomNav(screenId) {
  const map = {
    'home-screen': 'bnav-home',
    'chapters-screen': 'bnav-chapters',
    'achievements-screen': 'bnav-ach',
  };
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  const targetId = map[screenId];
  if (targetId) { const btn = el(targetId); if (btn) btn.classList.add('active'); }
  // إخفاء الـ nav أثناء اللعبة
  const nav = el('bottom-nav');
  if (!nav) return;
  nav.style.display = (screenId === 'game-screen' || screenId === 'results-screen' || screenId === 'review-screen' || screenId === 'onboarding-screen') ? 'none' : 'flex';
}

// Haptic feedback
function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [10], medium: [20], heavy: [30, 10, 30], success: [10, 30, 10], error: [50, 20, 50] };
  navigator.vibrate(patterns[type] || [10]);
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
// =============================================
// SECTION 24: CUSTOM CURSOR (ديسكتوب فقط)
// =============================================

(function initCursor() {
  // شغّل بس لو مش touch device
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (isTouch) return;

  const cursor  = document.getElementById('custom-cursor');
  const ring    = document.getElementById('cursor-ring');
  if (!cursor || !ring) return;

  let mouseX = -100, mouseY = -100;
  let ringX  = -100, ringY  = -100;
  let rafId;

  // تحديث موقع الـ cursor فوراً
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top  = mouseY + 'px';
  });

  // الـ ring بيتبع بـ lag (easing)
  function animateRing() {
    ringX += (mouseX - ringX) * 0.13;
    ringY += (mouseY - ringY) * 0.13;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';
    rafId = requestAnimationFrame(animateRing);
  }
  animateRing();

  // hover على الأزرار والعناصر القابلة للضغط
  const hoverSel = 'button, a, .menu-card, .chapter-card, .option-btn, .ach-card, [onclick], input, textarea, select, label';

  document.addEventListener('mouseover', e => {
    const t = e.target.closest(hoverSel);
    if (t) {
      cursor.classList.add('hovering');
      ring.classList.add('hovering');
    }
    // حقول النص
    if (e.target.matches('input[type="text"], textarea')) {
      cursor.classList.add('text-mode');
      ring.classList.add('text-mode');
    }
  });

  document.addEventListener('mouseout', e => {
    const t = e.target.closest(hoverSel);
    if (t) {
      cursor.classList.remove('hovering');
      ring.classList.remove('hovering');
    }
    cursor.classList.remove('text-mode');
    ring.classList.remove('text-mode');
  });

  // حالة الضغط
  document.addEventListener('mousedown', () => {
    cursor.classList.add('clicking');
    ring.classList.add('clicking');
  });
  document.addEventListener('mouseup', () => {
    cursor.classList.remove('clicking');
    ring.classList.remove('clicking');
  });

  // إخفاء لما يخرج من النافذة
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    ring.style.opacity   = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    ring.style.opacity   = '1';
  });
})();

// =============================================
// SECTION 25: TOUCH RIPPLE EFFECT (موبايل)
// =============================================

(function initRipple() {
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!isTouch) return;

  const rippleSel = '.menu-card, .option-btn, .action-btn, .chapter-card, .back-btn, .next-btn, .submit-btn, .icon-btn, .notes-add-btn, .close-modal, .danger-btn';

  document.addEventListener('touchstart', function(e) {
    const btn = e.target.closest(rippleSel);
    if (!btn) return;

    const rect   = btn.getBoundingClientRect();
    const touch  = e.touches[0];
    const size   = Math.max(rect.width, rect.height) * 2;
    const x      = touch.clientX - rect.left - size / 2;
    const y      = touch.clientY - rect.top  - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    btn.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
  }, { passive: true });
})();

// =============================================
// SECTION 26: SWIPE TO GO BACK (موبايل)
// =============================================

(function initSwipe() {
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!isTouch) return;

  let startX = 0, startY = 0;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);

    // swipe يمين (من شمال للـ يمين) أكتر من 80px وأفقي
    if (dx > 80 && dy < 60) {
      const active = document.querySelector('.screen.active');
      if (!active) return;
      const id = active.id;

      // رجوع حسب الشاشة الحالية
      if (id === 'chapters-screen' || id === 'achievements-screen') {
        SFX.click(); showScreen('home-screen');
      } else if (id === 'review-screen') {
        SFX.click(); showScreen('results-screen');
      }
      // game-screen: بيستخدم زرار الخروج المخصص
    }
  }, { passive: true });
})();
