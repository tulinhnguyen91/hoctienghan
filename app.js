/* Học tiếng Hàn — sổ học theo ngày. Không cần máy chủ: dữ liệu trong /data, tiến độ lưu trên máy. */
(() => {
'use strict';

const $app = document.getElementById('app');
const cache = {};
let INDEX = null;

/* ---------- lưu trữ trên máy ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('kr.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kr.' + k, JSON.stringify(v)); } catch {} },
};

/* ---------- tiện ích ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${+d}/${+m}/${y}`; };
const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const norm = s => String(s ?? '').normalize('NFC').replace(/[.,!?~·"'“”‘’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const tight = s => norm(s).replace(/\s/g, '');
/* "유월 (육월)" → ["유월","육월","유월 (육월)"] ; "처음 뵙겠습니다." → ["처음 뵙겠습니다"] */
const variants = kr => { const m = String(kr).match(/^(.*?)\s*\((.*)\)\s*$/); const out = [kr]; if (m) out.push(m[1], m[2]); return out; };
/* phần của từ xuất hiện nguyên vẹn trong câu ví dụ (động từ đã chia thì không dùng được) */
const blankKey = w => w[3] ? variants(w[0]).map(v => v.replace(/\.$/, '').trim()).find(v => v && w[3].includes(v)) : null;
const plainKr = kr => variants(kr).length > 1 ? variants(kr)[1] : kr;

const ICON = {
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M17 7h3m-3 0c-2 0-3 1.5-4 3.5M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
};

const MIC = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
/* độ giống nhau theo ký tự (bỏ khoảng trắng, dấu câu) */
function similar(a, b) {
  a = tight(a); b = tight(b); if (!a || !b) return 0; if (a === b) return 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- đọc tiếng Hàn ---------- */
let koVoice = null;
function loadVoice() { try { koVoice = speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang)) || null; } catch {} }
if ('speechSynthesis' in window) { loadVoice(); speechSynthesis.onvoiceschanged = loadVoice; }
function speak(text, rate = 0.85) {
  if (!('speechSynthesis' in window)) { toast('Trình duyệt này chưa hỗ trợ đọc'); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plainKr(text));
    u.lang = 'ko-KR'; u.rate = rate; if (koVoice) u.voice = koVoice;
    speechSynthesis.speak(u);
  } catch {}
}
const soundBtn = (text, label = 'Nghe phát âm') => `<button class="icon-btn" type="button" data-say="${esc(text)}" aria-label="${label}">${ICON.sound}</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.stopPropagation(); speak(b.dataset.say); } });

/* ---------- dữ liệu ---------- */
async function loadIndex() {
  if (INDEX) return INDEX;
  const r = await fetch('data/index.json?v=' + Date.now(), { cache: 'no-store' });
  INDEX = await r.json(); return INDEX;
}
async function loadLesson(id) {
  if (cache[id]) return cache[id];
  const r = await fetch(`data/${id}.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('missing');
  return (cache[id] = await r.json());
}
async function loadAll() { const idx = await loadIndex(); return Promise.all(idx.lessons.map(l => loadLesson(l.id))); }

/* ---------- kết quả & từ sai ---------- */
const results = () => store.get('results', []);
function addResult(r) {
  const all = results(); r.at = new Date().toISOString(); r.day = dayKey(); all.push(r);
  store.set('results', all.slice(-400)); updateBadge();
}
function best(lessonId, mode) {
  const rs = results().filter(r => r.lessonId === lessonId && r.mode === mode && r.total);
  return rs.length ? Math.max(...rs.map(r => Math.round(100 * r.correct / r.total))) : null;
}
const wrongBank = () => store.get('wrong', {});
/* lặp lại ngắt quãng: hộp 0..6, đúng thì lên hộp và giãn ngày ôn, sai thì về hộp 0 */
const SRS_GAP = [0, 1, 2, 4, 7, 15, 30];
const srs = () => store.get('srs', {});
const addDays = (n, d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() + n); return dayKey(x); };
function srsMark(w, ok, lesson) {
  const s = srs(); const k = w[0]; const cur = s[k] || { box: 0 };
  const box = ok ? Math.min(cur.box + 1, SRS_GAP.length - 1) : 0;
  s[k] = { box, due: addDays(ok ? SRS_GAP[box] : 1), lesson, last: dayKey() };
  store.set('srs', s);
}
function dueWords(pool) {
  const s = srs(), today = dayKey();
  return pool.filter(w => s[w[0]] && s[w[0]].due <= today);
}
const masteredCount = () => Object.values(srs()).filter(x => x.box >= 4).length;
const studiedDays = () => [...new Set([...results().map(r => r.day), ...store.get('days', [])])].sort();
function markStudied() { const d = store.get('days', []); if (!d.includes(dayKey())) { d.push(dayKey()); store.set('days', d.slice(-400)); } }
function streak() {
  const set = new Set(studiedDays()); let n = 0; let d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function markWord(w, ok, lesson) {
  srsMark(w, ok, lesson); markStudied();
  const b = wrongBank(); const k = w[0];
  if (ok) { if (b[k]) { b[k].streak = (b[k].streak || 0) + 1; if (b[k].streak >= 2) delete b[k]; } }
  else b[k] = { w, lesson, n: (b[k]?.n || 0) + 1, streak: 0 };
  store.set('wrong', b);
}
function updateBadge() {
  const n = results().filter(r => r.day === dayKey() && !r.sent).length;
  const b = document.getElementById('submitBadge');
  if (b) { b.hidden = !n; b.textContent = n; }
}

/* ---------- router ---------- */
function setNav(which) { document.querySelectorAll('.bottom a').forEach(a => a.classList.toggle('on', a.dataset.nav === which)); }
async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try { speechSynthesis.cancel(); } catch {}
  window.scrollTo(0, 0);
  try {
    if (!parts.length) { setNav('home'); await renderHome(); }
    else if (parts[0] === 'on-tap') { setNav('review'); await renderReview(parts[1]); }
    else if (parts[0] === 'nop-bai') { setNav('submit'); renderSubmit(parts[1]); }
    else if (parts[0] === 'so-tay') { setNav('notes'); renderNotes(); }
    else if (parts[0] === 'lo-trinh') { setNav('home'); await renderPlan(); }
    else { setNav('home'); await renderLesson(parts[0], parts[1] || 'tu-vung'); }
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<p class="empty">Không mở được trang này. <a href="#/">Về trang bài học</a></p>`;
  }
  updateBadge();
}
window.addEventListener('hashchange', route);

/* ---------- trang chủ ---------- */
const CHEERS = ['✧ 공주님, 화이팅! Công chúa cố lên nhé ✧', '✧ 천천히, 꾸준히 — chậm mà chắc ✧', '✧ 오늘도 한 걸음 — hôm nay thêm một bước ✧', '✧ 잘하고 있어요 — công chúa học giỏi lắm ✧', '✧ 공주님은 할 수 있어요 — công chúa làm được mà ✧'];
async function renderHome() {
  const idx = await loadIndex();
  const ls = idx.lessons.slice();
  const latest = ls[ls.length - 1];
  const lt = await loadLesson(latest.id);
  const todayDone = results().filter(r => r.day === dayKey()).length;
  const cheer = CHEERS[new Date().getDate() % CHEERS.length];
  const ex = await todayExtras();
  $app.innerHTML = `
    ${ex ? `<section class="quote" aria-label="Câu nói hôm nay">
      <div class="q-label">✧ Câu nói hôm nay ✧</div>
      <p class="q-kr" lang="ko">${esc(ex.quote.kr)}</p>
      <p class="q-vi">${esc(ex.quote.vi)}</p>
      ${soundBtn(ex.quote.kr, 'Nghe câu nói')}
    </section>` : ''}
    <section class="hero" aria-label="Bài mới nhất">
      <span class="ghost" lang="ko" aria-hidden="true">${esc(latest.krTitle.slice(0, 1))}</span>
      <span class="tiara" aria-hidden="true">${document.querySelector('.brand .crown')?.outerHTML.replace('id="cg"', 'id="cg2"').replace('url(#cg)', 'url(#cg2)') || ''}</span>
      <span class="spark s1" aria-hidden="true">✦</span><span class="spark s2" aria-hidden="true">✧</span><span class="spark s3" aria-hidden="true">✦</span>
      <div class="when">${latest.date ? 'Bài ngày ' + fmtDate(latest.date) : 'Bài mới nhất'}</div>
      <span class="hangul" lang="ko">${esc(latest.krTitle)}</span>
      <div class="vi">${esc(latest.lesson)} · ${esc(latest.title)}</div>
      <div class="stats"><span><b>${lt.words.length}</b> từ</span><span><b>${lt.patterns.length}</b> mẫu ngữ pháp</span><span><b>${lt.exercises.length}</b> bài tập</span></div>
      <div class="row"><a class="btn light" href="#/${latest.id}">Vào học</a><a class="btn line" style="color:#fff;border-color:rgba(255,255,255,.35)" href="#/${latest.id}/luyen">Làm bài luôn</a></div>
    </section>
    <p class="cheer" lang="ko">${esc(cheer)}</p>
    ${await todayCard(ex)}
    ${homeSupport(latest, lt, await loadAll())}
    ${todayDone ? `<p class="note">Hôm nay bạn đã làm <b>${todayDone}</b> phần. Xong thì vào <a href="#/nop-bai">Nộp bài</a> để copy kết quả gửi Claude nhé.</p>` : ''}
    <h2>Các ngày đã học</h2>
    <ol class="timeline">
      ${ls.slice().reverse().map(l => {
        const modes = ['viet', 'kv', 'vk', 'nghe', 'ghep', 'ngu-phap'];
        const done = modes.filter(m => best(l.id, m) !== null);
        const n = l.lesson.replace(/\D/g, '');
        return `<li data-n="${n}" class="${done.length >= 3 ? 'done' : ''}">
          <a class="lesson-link" href="#/${l.id}">
            <div class="t"><span class="kr" lang="ko">${esc(l.krTitle)}</span><span class="small muted">${l.date ? fmtDate(l.date) : ''}</span></div>
            <div class="meta">${esc(l.lesson)} · ${esc(l.title)} · ${l.words} từ · ${l.exercises} bài ngữ pháp</div>
            <div class="dots" aria-label="Đã làm ${done.length}/${modes.length} dạng bài">${modes.map(m => `<i class="${best(l.id, m) !== null ? 'on' : ''}"></i>`).join('')}</div>
          </a></li>`;
      }).join('')}
    </ol>`;
  petals($app.querySelector('.hero'));
  bindHomeExtras(ex);
}
let EXTRAS = null;
async function todayExtras() {
  const plan = await loadPlan(); if (!plan) return null;
  if (!EXTRAS) { try { const r = await fetch('data/extras.json?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) EXTRAS = await r.json(); } catch {} }
  if (!EXTRAS) return null;
  const { d, before, after } = planToday(plan);
  const n = before ? 1 : after ? 30 : d.day;
  return EXTRAS.days.find(x => x.day === n) || null;
}
function extrasHtml(ex, dayLabel) {
  if (!ex) return '';
  const draft = store.get('diary.' + dayKey(), '');
  const saved = results().find(r => r.day === dayKey() && r.mode === 'nhat-ky');
  return `<div class="extras">
    <h3 class="ex-h">♕ Góc công chúa hôm nay</h3>
    <details open><summary>🗣️ Phát âm: ${esc(ex.pron.title)}</summary>
      <p class="small">${esc(ex.pron.rule)}</p>
      <ul class="ex-list">${ex.pron.examples.map(e => `<li><span lang="ko">${esc(e)}</span>${soundBtn(e.split(/[→(/]/)[0].trim())}</li>`).join('')}</ul></details>
    <details><summary>💬 3 câu giao tiếp</summary>
      <ul class="ex-list">${ex.phrases.map(([k, v]) => `<li><span><span lang="ko" class="kr">${esc(k)}</span><br><span class="muted small">${esc(v)}</span></span>${soundBtn(k)}</li>`).join('')}</ul></details>
    <details><summary>🏯 Văn hóa Hàn</summary><p class="small">${esc(ex.culture)}</p></details>
    <details><summary>🎯 Mẹo thi TOPIK</summary><p class="small">${esc(ex.tip)}</p></details>
    <details ${saved ? '' : 'open'}><summary>📔 Nhật ký 3 câu${saved ? ' ✓' : ''}</summary>
      <p class="small"><b>Đề:</b> ${esc(ex.diary)}</p>
      <textarea class="answer-input" id="diary" rows="4" lang="ko" placeholder="Viết 3–5 câu tiếng Hàn…">${esc(saved ? saved.sentences.join('\n') : draft)}</textarea>
      <button class="btn block" id="diarySave" style="margin-top:10px">${saved ? 'Cập nhật nhật ký' : 'Lưu nhật ký vào bài nộp'}</button></details>
  </div>`;
}
function bindHomeExtras(ex) {
  const ta = document.getElementById('diary'); if (!ta || !ex) return;
  ta.addEventListener('input', () => store.set('diary.' + dayKey(), ta.value));
  document.getElementById('diarySave').onclick = () => {
    const sentences = ta.value.split(/\n+|(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length < 3) { toast('Viết ít nhất 3 câu nhé công chúa'); return; }
    store.set('results', results().filter(r => !(r.day === dayKey() && r.mode === 'nhat-ky')));
    addResult({ lessonId: 'nhat-ky', lesson: 'Ngày ' + ex.day, mode: 'nhat-ky', label: 'Nhật ký', prompt: ex.diary, sentences });
    markStudied(); toast('Đã lưu nhật ký ✿'); renderHome();
  };
  document.querySelectorAll('[data-tick]').forEach(b => b.onclick = e => {
    e.preventDefault();
    const has = results().some(r => r.day === dayKey() && r.mode === 'migii');
    if (has) store.set('results', results().filter(r => !(r.day === dayKey() && r.mode === 'migii')));
    else { addResult({ lessonId: 'migii', lesson: 'Migii', mode: 'migii', label: 'Luyện Nghe + Đọc TOPIK I trên Migii', note: b.dataset.tick }); markStudied(); }
    renderHome();
  });
}
let PLAN = null;
async function loadPlan() {
  if (PLAN) return PLAN;
  try { const r = await fetch('data/plan.json?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) PLAN = await r.json(); } catch {}
  return PLAN;
}
function planToday(plan) {
  const t = dayKey(); const days = plan.days;
  if (t < days[0].date) return { before: true, d: days[0] };
  if (t > days[days.length - 1].date) return { after: true, d: days[days.length - 1] };
  return { d: days.find(x => x.date === t) };
}
function practiceLinks(plan, d) {
  if (!d.practice) return '';
  return `<ul class="prac">
    <li><a href="${plan.links.listening}" target="_blank" rel="noopener">🎧 ${esc(d.practice.listening)}</a></li>
    <li><a href="${plan.links.reading}" target="_blank" rel="noopener">📖 ${esc(d.practice.reading)}</a></li></ul>`;
}
async function todayCard(ex) {
  const plan = await loadPlan(); if (!plan) return '';
  const { d, before, after } = planToday(plan);
  const idx = INDEX ? INDEX.lessons.map(l => l.id) : [];
  const ready = d.id && idx.includes(d.id);
  const pct = Math.round(100 * Math.max(0, Math.min(30, d.day - (before ? 1 : 0))) / 30);
  return `<section class="today">
    <div class="today-h"><span class="day-badge">${before ? 'Sắp bắt đầu' : after ? 'Hoàn thành ♛' : 'Ngày ' + d.day + '/30'}</span>
      <a class="small" href="#/lo-trinh">Xem lộ trình</a></div>
    <div class="road"><i style="width:${pct}%"></i><span class="crown-pin" style="left:${pct}%">♛</span></div>
    <h3>${before ? 'Ngày 1 bắt đầu ' + fmtDate(d.date) + ': ' : ''}${esc(d.source || d.title)}</h3>
    ${d.type === 'review' ? `<ul class="prac">${d.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <a class="btn block" href="#/on-tap">Vào ôn tập</a>`
      : `<p class="small muted">${d.words.length} từ · ngữ pháp: <span lang="ko">${d.grammar.map(g => esc(g.split(' — ')[0])).join(', ')}</span></p>
        ${ready ? `<a class="btn block" href="#/${d.id}">Học ${esc(d.lesson)} ngay</a>` : `<p class="note">Bài này sẽ được soạn xong tối hôm trước (20:30). Trong lúc chờ, vào Ôn tập nhé.</p>`}
        <p class="small" style="margin:12px 0 4px"><b>Luyện TOPIK trên Migii hôm nay:</b></p>${practiceLinks(plan, d)}`}
    ${extrasHtml(ex)}
  </section>`;
}
async function renderPlan() {
  const plan = await loadPlan(); await loadIndex();
  if (!plan) { $app.innerHTML = '<p class="empty">Chưa có lộ trình.</p>'; return; }
  const t = dayKey(); const ids = INDEX.lessons.map(l => l.id);
  $app.innerHTML = `<h1>Lộ trình 30 ngày</h1>
    <p class="muted">${esc(plan.goal)}. Mỗi ngày: 1 bài từ vựng Migii, 3 mẫu ngữ pháp, 1 phần Nghe + 1 phần Đọc TOPIK I.</p>
    <ol class="plan">${plan.days.map(d => {
      const st = d.date < t ? 'past' : d.date === t ? 'now' : 'next';
      const link = d.id && ids.includes(d.id);
      return `<li class="${st} ${d.type}"><div class="pd"><b>${d.day}</b><span>${fmtDate(d.date).slice(0, -5)}</span></div>
        <div class="pc">${link ? `<a href="#/${d.id}">` : ''}<div class="pt">${esc(d.source || d.title)}</div>${link ? '</a>' : ''}
        <div class="small muted">${d.type === 'review' ? 'Ôn tập + thi thử TOPIK I' : d.words.length + ' từ · <span lang="ko">' + d.grammar.map(g => esc(g.split(' — ')[0])).join(' · ') + '</span>'}</div></div></li>`;
    }).join('')}</ol>`;
  document.querySelector('.plan li.now')?.scrollIntoView({ block: 'center' });
}
function homeSupport(latest, lt, lessons) {
  const today = dayKey(), rs = results().filter(r => r.day === today);
  const pool = lessons.flatMap(L => L.words);
  const due = dueWords(pool).length;
  const did = f => rs.some(f);
  const goals = [
    ['Lướt flashcard bài mới', store.get(`seen.${today}.${latest.id}`, false), `#/${latest.id}/the`],
    ['Luyện từ (1 dạng trở lên)', did(r => r.lessonId === latest.id && VOCAB_MODES.some(m => m[0] === r.mode)), `#/${latest.id}/luyen`],
    ['Làm bài tập ngữ pháp', did(r => r.lessonId === latest.id && r.mode === 'ngu-phap'), `#/${latest.id}/ngu-phap`],
    ['Đặt 3–5 câu', did(r => r.lessonId === latest.id && r.mode === 'dat-cau'), `#/${latest.id}/dat-cau`],
    [due ? `Ôn ${due} từ sắp quên` : 'Ôn từ sắp quên (hôm nay chưa có)', due === 0 || did(r => r.mode === 'on-han'), '#/on-tap'],
    ['Luyện Nghe + Đọc trên Migii (bấm để tick)', did(r => r.mode === 'migii'), '#/', 'migii'],
    ['Viết nhật ký 3 câu', did(r => r.mode === 'nhat-ky'), '#/'],
    ['Copy kết quả gửi Claude', rs.length > 0 && rs.every(r => r.sent), '#/nop-bai'],
  ];
  const doneN = goals.filter(g => g[1]).length;
  const days = new Set(studiedDays()); const st = streak();
  const cal = Array.from({ length: 14 }, (_, k) => { const d = addDays(k - 13); return { d, on: days.has(d), today: d === today }; });
  const dayIdx = Math.floor(Date.now() / 864e5); const wod = pool[dayIdx % pool.length];
  return `
    <section class="support">
      <div class="streak-card">
        <div class="streak-n"><b>${st}</b><span>ngày liên tiếp</span></div>
        <div class="cal" aria-label="14 ngày gần nhất">${cal.map(c => `<i class="${c.on ? 'on' : ''} ${c.today ? 'today' : ''}" title="${fmtDate(c.d)}"></i>`).join('')}</div>
        <div class="small muted">${st ? (st >= 7 ? 'Một tuần không nghỉ, quá đỉnh!' : 'Giữ lửa nhé, mai học tiếp!') : 'Học một phần bất kỳ để bắt đầu chuỗi ngày.'} · Đã thuộc <b>${masteredCount()}</b>/${pool.length} từ</div>
      </div>
      <div class="goals"><div class="goals-h"><h3>Nhiệm vụ hôm nay</h3><span class="small muted">${doneN}/${goals.length}</span></div>
        <div class="goal-bar"><i style="width:${100 * doneN / goals.length}%"></i></div>
        <ul>${goals.map(([t, ok, href, tick]) => `<li class="${ok ? 'ok' : ''}"><a href="${href}" ${tick ? `data-tick="${tick}"` : ''}><span class="tick" aria-hidden="true">${ok ? '✓' : ''}</span>${esc(t)}</a></li>`).join('')}</ul>
        ${doneN === goals.length ? '<p class="cheer" lang="ko">오늘 다 했어요! Xong hết rồi, giỏi quá!</p>' : ''}</div>
      ${wod ? `<div class="wod"><div class="small muted">Từ của ngày</div>
        <div class="wod-k"><span lang="ko">${esc(wod[0])}</span>${soundBtn(wod[0])}</div>
        <div><b>${esc(wod[2])}</b> <span class="muted small">${esc(wod[1])}</span></div>
        ${wod[3] ? `<div class="wod-ex"><span lang="ko">${esc(wod[3])}</span> ${soundBtn(wod[3], 'Nghe câu')}<br><span class="muted small">${esc(wod[4])}</span></div>` : ''}</div>` : ''}
    </section>`;
}
function petals(host) {
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('i'); p.className = 'petal';
    p.style.left = (Math.random() * 100) + '%';
    p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    p.style.animationDuration = (3 + Math.random() * 3) + 's';
    p.style.animationDelay = (Math.random() * 1.5) + 's';
    host.appendChild(p);
  }
}

/* ---------- trang bài học ---------- */
const TABS = [['tu-vung', 'Từ vựng'], ['the', 'Flashcard'], ['luyen', 'Luyện từ'], ['ngu-phap', 'Ngữ pháp'], ['dat-cau', 'Đặt câu']];
async function renderLesson(id, tab) {
  const L = await loadLesson(id); await loadPlan();
  $app.innerHTML = `
    <a class="back" href="#/">${ICON.left.replace('<svg', '<svg width="16" height="16" style="fill:none;stroke:currentColor;stroke-width:2"')} Tất cả bài</a>
    <div class="lesson-head"><span class="kr" lang="ko">${esc(L.krTitle)}</span>
      <div class="muted">${esc(L.lesson)} · ${esc(L.title)}${L.date ? ' · ' + fmtDate(L.date) : ''}</div></div>
    <nav class="tabs" aria-label="Phần của bài">${TABS.map(([k, v]) => `<a href="#/${id}/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${v}</a>`).join('')}</nav>
    <section id="pane"></section>`;
  const pane = document.getElementById('pane');
  ({ 'tu-vung': paneWords, 'the': paneFlash, 'luyen': panePractice, 'ngu-phap': paneGrammar, 'dat-cau': paneSentences }[tab] || paneWords)(pane, L);
  document.querySelector('.tabs a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function paneWords(pane, L) {
  pane.innerHTML = `<input class="searchbox" type="search" placeholder="Tìm từ (Hàn hoặc Việt)…" aria-label="Tìm từ">
    <ul class="words" id="wl"></ul>`;
  const draw = q => {
    q = norm(q);
    const ws = L.words.filter(w => !q || norm(w[0]).includes(q) || norm(w[2]).includes(q) || norm(w[1]).includes(q));
    pane.querySelector('#wl').innerHTML = ws.map(w => `<li>
      ${soundBtn(w[0])}
      <div class="w"><div class="wtop"><span class="k" lang="ko">${esc(w[0])}</span><span class="v">${esc(w[2])}</span></div><span class="r">${esc(w[1])}</span>
        ${w[3] ? `<span class="ex"><span class="k" lang="ko">${esc(w[3])}</span> <button class="icon-btn" style="width:28px;height:28px;vertical-align:middle" data-say="${esc(w[3])}" aria-label="Nghe câu ví dụ">${ICON.sound}</button><span class="vv">${esc(w[4])}</span></span>` : ''}
      </div></li>`).join('') || '<li class="muted">Không tìm thấy từ nào.</li>';
  };
  pane.querySelector('input').addEventListener('input', e => draw(e.target.value));
  draw('');
}

function paneFlash(pane, L, words) {
  let list = (words || L.words).slice(), i = 0, front = 'kr';
  pane.innerHTML = `
    <div class="count-pick" role="group" aria-label="Mặt trước"><span>Mặt trước:</span>
      <button data-front="kr" class="on">Tiếng Hàn</button><button data-front="vi">Tiếng Việt</button></div>
    <div class="flash" id="fc"><div class="flash-inner" role="button" tabindex="0" aria-label="Lật thẻ"></div></div>
    <div class="flash-ctrl">
      <button class="icon-btn" id="prev" aria-label="Thẻ trước">${ICON.left}</button>
      <span class="counter" id="cnt"></span>
      <button class="icon-btn" id="mix" aria-label="Xáo trộn">${ICON.shuffle}</button>
      <button class="icon-btn" id="say" aria-label="Nghe">${ICON.sound}</button>
      <button class="icon-btn" id="next" aria-label="Thẻ sau">${ICON.right}</button>
    </div>`;
  const fc = pane.querySelector('#fc'), inner = fc.querySelector('.flash-inner');
  const draw = () => {
    const w = list[i];
    const krFace = `<div class="big" lang="ko">${esc(w[0])}</div><div class="rom">${esc(w[1])}</div>`;
    const viFace = `<div class="mean">${esc(w[2])}</div>${w[3] ? `<div class="exk" lang="ko">${esc(w[3])}</div><div class="exv">${esc(w[4])}</div>` : ''}`;
    inner.innerHTML = `<div class="face">${front === 'kr' ? krFace : `<div class="mean">${esc(w[2])}</div>`}<span class="hint">Chạm để lật</span></div>
      <div class="face back-f">${front === 'kr' ? viFace : krFace + (w[3] ? `<div class="exk" lang="ko">${esc(w[3])}</div><div class="exv">${esc(w[4])}</div>` : '')}</div>`;
    fc.classList.remove('flip');
    pane.querySelector('#cnt').textContent = `${i + 1} / ${list.length}`;
  };
  let flips = 0;
  const flip = () => {
    if (++flips === 5 && L.id !== 'on-tap') { store.set(`seen.${dayKey()}.${L.id}`, true); markStudied(); toast('Đã tính là lướt flashcard hôm nay ✿'); }
    fc.classList.toggle('flip'); if (fc.classList.contains('flip') || front === 'kr') speak(list[i][0]); };
  inner.addEventListener('click', flip);
  inner.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  pane.querySelector('#prev').onclick = () => { i = (i - 1 + list.length) % list.length; draw(); };
  pane.querySelector('#next').onclick = () => { i = (i + 1) % list.length; draw(); };
  pane.querySelector('#mix').onclick = () => { list = shuffle(list); i = 0; draw(); toast('Đã xáo trộn thẻ'); };
  pane.querySelector('#say').onclick = () => speak(list[i][0]);
  pane.querySelectorAll('[data-front]').forEach(b => b.onclick = () => {
    front = b.dataset.front; pane.querySelectorAll('[data-front]').forEach(x => x.classList.toggle('on', x === b)); draw();
  });
  let sx = null;
  inner.addEventListener('touchstart', e => sx = e.touches[0].clientX, { passive: true });
  inner.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { e.preventDefault(); (dx < 0 ? pane.querySelector('#next') : pane.querySelector('#prev')).click(); } sx = null; });
  draw();
}

/* ---------- luyện từ ---------- */
const VOCAB_MODES = [
  ['viet', 'Kiểm tra viết', 'Nhìn nghĩa, gõ chữ Hàn'],
  ['kv', 'Hàn → Việt', 'Trắc nghiệm chọn nghĩa'],
  ['vk', 'Việt → Hàn', 'Trắc nghiệm chọn từ'],
  ['nghe', 'Nghe chọn từ', 'Nghe phát âm, chọn đúng chữ'],
  ['ghep', 'Ghép cặp', 'Nối từ với nghĩa'],
  ['vidu', 'Điền vào ví dụ', 'Chọn từ còn thiếu trong câu'],
  ['chep', 'Nghe chép câu', 'Nghe câu ví dụ, gõ lại'],
  ['noi', 'Luyện nói', 'Đọc to, web nghe và chấm'],
];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function panePractice(pane, L) {
  let count = store.get('count', 20);
  const draw = () => {
    pane.innerHTML = `
      <div class="count-pick" role="group" aria-label="Số câu"><span>Số câu:</span>
        ${[10, 20, 0].map(n => `<button data-n="${n}" class="${n === count ? 'on' : ''}">${n || 'Tất cả'}</button>`).join('')}</div>
      <div class="modes">${VOCAB_MODES.map(([k, t, d]) => {
        const b = best(L.id, k);
        return `<button class="mode" data-mode="${k}"><b>${t}</b><span>${d}</span>${b !== null ? `<span class="best">Tốt nhất ${b}%</span>` : ''}</button>`;
      }).join('')}
      <a class="mode wide" href="#/${L.id}/ngu-phap" style="text-decoration:none;color:inherit"><b>Bài tập ngữ pháp</b><span>${L.exercises.length} câu: trắc nghiệm, điền, sắp xếp, dịch</span></a></div>`;
    pane.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { count = +b.dataset.n; store.set('count', count); draw(); });
    pane.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => startVocab(pane, L, b.dataset.mode, count, L.words, () => draw()));
  };
  draw();
}

function vocabQuestions(mode, words, pool, n) {
  const chosen = n ? pick(words, Math.min(n, words.length)) : shuffle(words);
  const others = w => pick(pool.filter(x => x[0] !== w[0] && x[2] !== w[2]), 3);
  return chosen.map(w => {
    if (mode === 'viet') return { w, kind: 'input', ask: 'Viết bằng tiếng Hàn', prompt: w[2], promptVi: true,
      check: u => variants(w[0]).some(v => norm(v) === norm(u)) ? 'ok' : variants(w[0]).some(v => tight(v) === tight(u)) ? 'space' : 'no', answer: w[0] };
    if (mode === 'kv') return { w, kind: 'choice', ask: 'Từ này nghĩa là gì?', prompt: w[0], say: true, options: shuffle([w, ...others(w)]).map(x => x[2]), answer: w[2] };
    if (mode === 'vk') return { w, kind: 'choice', ask: 'Chọn từ tiếng Hàn đúng', prompt: w[2], promptVi: true, krOpts: true, options: shuffle([w, ...others(w)]).map(x => x[0]), answer: w[0] };
    if (mode === 'nghe') return { w, kind: 'choice', ask: 'Nghe và chọn từ đúng', listen: true, krOpts: true, options: shuffle([w, ...others(w)]).map(x => x[0]), answer: w[0] };
    if (mode === 'chep') return { w, kind: 'input', ask: `Nghe và gõ lại câu — ${w[4]}`, listen: true, sayText: w[3], long: true, answer: w[3],
      check: u => norm(u) === norm(w[3]) ? 'ok' : tight(u) === tight(w[3]) ? 'space' : 'no' };
    if (mode === 'noi') { const t = Math.random() < .5 && w[3] ? w[3] : plainKr(w[0]);
      return { w, kind: 'speak', ask: `Đọc to — ${t === w[3] ? w[4] : w[2]}`, prompt: t, say: true, answer: t, sentence: t === w[3] }; }
    if (mode === 'vidu') {
      const key = blankKey(w);
      return { w, kind: 'choice', ask: `Chọn từ còn thiếu — ${w[4] || ''}`, prompt: w[3].replace(key, '＿＿'), sentence: true, krOpts: true,
        options: shuffle([w, ...others(w)]).map(x => x[0]), answer: w[0] };
    }
  });
}

function startVocab(pane, L, mode, n, words, onBack, opts = {}) {
  const pool = opts.pool || L.words;
  if (mode === 'ghep') return startMatch(pane, L, words, onBack, opts);
  if (mode === 'vidu') words = words.filter(w => blankKey(w));
  if (mode === 'chep') words = words.filter(w => w[3]);
  if (mode === 'noi' && !SR) { pane.innerHTML = `<div class="note">Trình duyệt này chưa hỗ trợ nhận giọng nói. Hãy mở web bằng <b>Chrome</b> (Android/máy tính) hoặc <b>Safari</b> (iPhone) và cho phép dùng micro nhé.</div><button class="btn line" id="b">Quay lại</button>`; pane.querySelector('#b').onclick = onBack; return; }
  const qs = vocabQuestions(mode, words, pool, n);
  const label = opts.label || VOCAB_MODES.find(m => m[0] === mode)[1];
  runQuiz(pane, qs, {
    title: label,
    onDone: (score, total, log) => {
      log.forEach(x => markWord(x.q.w, x.res === 'ok' || x.res === 'space', x.q.w._lesson || L.lesson));
      addResult({ lessonId: opts.lessonId || L.id, lesson: opts.lessonName || L.lesson, mode: opts.modeKey || mode, label, total, correct: score,
        wrong: log.filter(x => x.res === 'no').map(x => ({ kr: x.q.w[0], vi: x.q.w[2], user: x.user })) });
    },
    onBack, retryWith: wrongs => startVocab(pane, L, mode, 0, wrongs.map(x => x.q.w), onBack, opts),
  });
}

/* chạy một bộ câu hỏi (dùng chung cho từ vựng và ngữ pháp) */
function runQuiz(pane, qs, cfg) {
  let i = 0, score = 0; const log = [];
  if (!qs.length) { pane.innerHTML = '<p class="empty">Chưa có câu hỏi cho phần này.</p>'; return; }
  const next = () => { i++; i < qs.length ? show() : finish(); };
  function show() {
    const q = qs[i];
    pane.innerHTML = `
      <div class="quiz-top"><button class="icon-btn" id="quit" aria-label="Thoát">${ICON.left}</button>
        <div class="bar"><i style="width:${100 * i / qs.length}%"></i></div><span class="counter">${i + 1}/${qs.length}</span></div>
      <div class="qcard">
        <div class="ask">${esc(q.ask)}</div>
        ${q.listen ? `<button class="btn" id="play" style="min-width:140px">${ICON.sound.replace('<svg', '<svg width="22" height="22" style="fill:none;stroke:currentColor;stroke-width:1.8"')} Nghe lại</button>` : ''}
        ${q.prompt ? `<div class="prompt ${q.promptVi ? 'vi' : ''} ${q.sentence ? 'sent' : ''}" ${q.promptVi ? '' : 'lang="ko"'}>${q.html || esc(q.prompt)}${q.say ? soundBtn(q.prompt) : ''}</div>` : ''}
      </div>
      <div id="zone"></div><div id="fb"></div>`;
    pane.querySelector('#quit').onclick = () => cfg.onBack();
    if (q.listen) { pane.querySelector('#play').onclick = () => speak(q.answer); setTimeout(() => speak(q.answer), 250); }
    const zone = pane.querySelector('#zone');
    if (q.kind === 'choice') {
      zone.innerHTML = `<div class="opts">${q.options.map(o => `<button class="opt ${q.krOpts ? 'kr' : ''}" ${q.krOpts ? 'lang="ko"' : ''}>${esc(o)}</button>`).join('')}</div>`;
      zone.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = b.textContent === q.answer;
        zone.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === q.answer) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        settle(ok ? 'ok' : 'no', b.textContent);
      });
    } else if (q.kind === 'input' || q.kind === 'vi') {
      const vi = q.kind === 'vi' || q.viInput;
      zone.innerHTML = `<form id="f"><${vi || q.long ? 'textarea' : 'input'} class="answer-input ${vi ? 'vi-in' : ''}" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" ${vi ? '' : 'lang="ko"'} placeholder="${vi ? 'Gõ câu tiếng Việt…' : 'Gõ tiếng Hàn…'}"></${vi || q.long ? 'textarea' : 'input'}>
        <div class="row" style="margin-top:12px"><button class="btn block" type="submit">Kiểm tra</button></div></form>`;
      const inp = zone.querySelector('#ans'); setTimeout(() => inp.focus(), 50);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && inp.tagName === 'TEXTAREA') { e.preventDefault(); zone.querySelector('form').requestSubmit(); } });
      zone.querySelector('#f').onsubmit = e => {
        e.preventDefault(); const u = inp.value.trim(); if (!u) { inp.focus(); return; }
        inp.disabled = true; zone.querySelector('button').remove(); settle(q.check(u), u);
      };
    } else if (q.kind === 'speak') {
      zone.innerHTML = `<button class="btn block mic" id="mic">${MIC} Bấm rồi nói</button>
        <p class="small muted" id="heard" style="margin-top:10px">Nghe mẫu bằng nút loa, rồi bấm micro và đọc to.</p>
        <div class="row" style="margin-top:6px"><button class="btn line" id="skip" type="button">Bỏ qua câu này</button></div>`;
      const heard = zone.querySelector('#heard'), mic = zone.querySelector('#mic');
      let tries = 0;
      zone.querySelector('#skip').onclick = () => { zone.querySelectorAll('button').forEach(b => b.disabled = true); settle('no', '(bỏ qua)'); };
      mic.onclick = () => {
        let rec; try { rec = new SR(); } catch { heard.textContent = 'Không mở được micro.'; return; }
        rec.lang = 'ko-KR'; rec.maxAlternatives = 5; rec.interimResults = false;
        mic.classList.add('live'); mic.disabled = true; heard.textContent = 'Đang nghe…';
        rec.onresult = e => {
          const alts = [...e.results[0]].map(a => a.transcript);
          const score = Math.max(...alts.map(a => similar(a, q.answer)));
          const said = alts[0];
          if (score >= 0.8) { zone.querySelectorAll('button').forEach(b => b.disabled = true); settle('ok', said); }
          else { tries++; heard.innerHTML = `Web nghe được: <span lang="ko" class="kr">${esc(said)}</span> (${Math.round(score * 100)}% giống). ${tries < 3 ? 'Thử lại nhé!' : ''}`;
            if (tries >= 3) { zone.querySelectorAll('button').forEach(b => b.disabled = true); settle('no', said); } }
        };
        rec.onerror = ev => { heard.textContent = ev.error === 'not-allowed' ? 'Bạn cần cho phép web dùng micro.' : 'Chưa nghe rõ, thử lại nhé.'; };
        rec.onend = () => { mic.classList.remove('live'); mic.disabled = false; };
        try { speechSynthesis.cancel(); rec.start(); } catch { mic.disabled = false; }
      };
    } else if (q.kind === 'order') {
      const built = []; const toks = shuffle(q.tokens.map((t, k) => ({ t, k })));
      zone.innerHTML = `<div class="built" id="built" aria-label="Câu của bạn"></div><div class="chips" id="pool"></div>
        <div class="row" style="margin-top:14px"><button class="btn line" id="clr" type="button">Xóa</button><button class="btn" id="chk" type="button" style="flex:1">Kiểm tra</button></div>`;
      const drawO = () => {
        zone.querySelector('#built').innerHTML = built.map((x, j) => `<button class="chip" data-j="${j}" lang="ko">${esc(x.t)}</button>`).join('');
        zone.querySelector('#pool').innerHTML = toks.map(x => `<button class="chip ${built.includes(x) ? 'used' : ''}" data-k="${x.k}" lang="ko" ${built.includes(x) ? 'disabled' : ''}>${esc(x.t)}</button>`).join('');
        zone.querySelectorAll('#pool .chip').forEach(c => c.onclick = () => { built.push(toks.find(x => x.k === +c.dataset.k)); drawO(); });
        zone.querySelectorAll('#built .chip').forEach(c => c.onclick = () => { built.splice(+c.dataset.j, 1); drawO(); });
      };
      drawO();
      zone.querySelector('#clr').onclick = () => { built.length = 0; drawO(); };
      zone.querySelector('#chk').onclick = () => {
        if (built.length < toks.length) { toast('Hãy dùng hết các thẻ từ'); return; }
        const u = built.map(x => x.t).join(' ');
        zone.querySelectorAll('button').forEach(b => b.disabled = true);
        settle(norm(u) === norm(q.answer) ? 'ok' : 'no', u);
      };
    }
  }
  function settle(res, user) {
    const q = qs[i];
    if (res === 'ok' || res === 'space') score++;
    log.push({ q, res, user });
    const fb = pane.querySelector('#fb');
    const ansHtml = `<span class="k" lang="ko">${esc(q.answerShow || q.answer)}</span>`;
    const head = { ok: 'Chính xác!', space: 'Đúng rồi, chỉ lệch khoảng trắng', no: 'Chưa đúng', rev: 'Đã ghi lại — Claude sẽ chấm câu này' }[res];
    const extra = q.w && q.w[3] ? `<div style="margin-top:6px"><span class="k" lang="ko">${esc(q.w[3])}</span><br><span class="muted">${esc(q.w[4])}</span></div>` : '';
    fb.innerHTML = `<div class="feedback ${res === 'rev' ? 'rev' : res === 'no' ? 'no' : 'ok'}"><b>${head}</b>
      ${res !== 'ok' ? `${res === 'rev' ? 'Đáp án tham khảo' : 'Đáp án'}: ${q.kind === 'vi' ? esc(q.answer) : ansHtml}` : (q.kind !== 'vi' && q.w ? ansHtml + ' — ' + esc(q.w[2]) : '')}
      ${q.explain ? `<div style="margin-top:6px">${esc(q.explain)}</div>` : ''}${extra}</div>
      <button class="btn block" id="go">${i + 1 < qs.length ? 'Câu tiếp' : 'Xem kết quả'}</button>`;
    if (q.w && res !== 'no') speak(q.w[0]);
    const go = fb.querySelector('#go'); go.focus({ preventScroll: true }); go.onclick = next;
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function finish() {
    const graded = log.filter(x => x.res !== 'rev').length;
    cfg.onDone(score, graded, log);
    const wrongs = log.filter(x => x.res === 'no');
    const revs = log.filter(x => x.res === 'rev');
    const pct = graded ? Math.round(100 * score / graded) : 100;
    const msg = pct === 100 ? '완벽해요! Hoàn hảo!' : pct >= 80 ? '잘했어요! Giỏi lắm!' : pct >= 50 ? '좋아요! Thêm chút nữa nhé' : '괜찮아요! Làm lại là nhớ thôi';
    pane.innerHTML = `
      <div class="qcard result-big"><div class="ask">${esc(cfg.title)}</div>
        <div class="score">${score}<small>/${graded}</small></div><p class="cheer" lang="ko">${msg}</p>
        ${revs.length ? `<p class="small muted">+ ${revs.length} câu dịch chờ Claude chấm</p>` : ''}</div>
      ${wrongs.length ? `<h2>Câu chưa đúng</h2><ul class="miss">${wrongs.map(x => `<li><span class="k" lang="ko">${esc(x.q.answerShow || x.q.answer)}</span> ${x.q.w ? '— ' + esc(x.q.w[2]) : '— ' + esc(x.q.prompt || x.q.ask)}<br><span class="you">Bạn: ${esc(x.user)}</span></li>`).join('')}</ul>` : ''}
      <div class="row">${wrongs.length && cfg.retryWith ? '<button class="btn" id="retry">Làm lại câu sai</button>' : ''}
        <button class="btn line" id="again">Làm lại từ đầu</button><button class="btn line" id="back">Xong</button></div>
      <p class="small muted" style="margin-top:16px">Kết quả đã lưu. Cuối buổi vào <a href="#/nop-bai">Nộp bài</a> để copy gửi Claude.</p>`;
    pane.querySelector('#back').onclick = cfg.onBack;
    pane.querySelector('#again').onclick = () => { if (cfg.restart) cfg.restart(); else { i = 0; score = 0; log.length = 0; qs.splice(0, qs.length, ...shuffle(qs)); show(); } };
    pane.querySelector('#retry')?.addEventListener('click', () => cfg.retryWith(wrongs));
    if (pct >= 80) petals(pane.querySelector('.result-big'));
  }
  show();
}

function startMatch(pane, L, words, onBack, opts = {}) {
  const rounds = []; const all = shuffle(words);
  for (let k = 0; k < all.length; k += 6) rounds.push(all.slice(k, k + 6));
  let r = 0, mistakes = 0, sel = null; const missed = new Set();
  const draw = () => {
    const set = rounds[r];
    const left = shuffle(set), right = shuffle(set);
    pane.innerHTML = `<div class="quiz-top"><button class="icon-btn" id="quit" aria-label="Thoát">${ICON.left}</button>
      <div class="bar"><i style="width:${100 * r / rounds.length}%"></i></div><span class="counter">Lượt ${r + 1}/${rounds.length}</span></div>
      <p class="muted small">Chạm một từ tiếng Hàn rồi chạm nghĩa của nó.</p>
      <div class="match">${left.map((w, k) => `<button class="k" lang="ko" data-side="k" data-id="${esc(w[0])}" style="grid-column:1;grid-row:${k + 1}">${esc(w[0])}</button>`).join('')}
        ${right.map((w, k) => `<button data-side="v" data-id="${esc(w[0])}" style="grid-column:2;grid-row:${k + 1}">${esc(w[2])}</button>`).join('')}</div>`;
    pane.querySelector('#quit').onclick = onBack;
    let left_ = set.length;
    pane.querySelectorAll('.match button').forEach(b => b.onclick = () => {
      if (b.dataset.side === 'k') speak(b.dataset.id);
      if (!sel || sel.dataset.side === b.dataset.side) { pane.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); sel = b; b.classList.add('sel'); return; }
      if (sel.dataset.id === b.dataset.id) {
        [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
        sel = null; if (--left_ === 0) { r++; r < rounds.length ? setTimeout(draw, 250) : done(); }
      } else {
        mistakes++; missed.add(sel.dataset.id); missed.add(b.dataset.id);
        [sel, b].forEach(x => { x.classList.add('bad'); setTimeout(() => x.classList.remove('bad', 'sel'), 450); }); sel = null;
      }
    });
  };
  const done = () => {
    const total = words.length, correct = Math.max(0, total - missed.size);
    words.forEach(w => markWord(w, !missed.has(w[0]), L.lesson));
    addResult({ lessonId: opts.lessonId || L.id, lesson: opts.lessonName || L.lesson, mode: 'ghep', label: 'Ghép cặp', total, correct,
      wrong: words.filter(w => missed.has(w[0])).map(w => ({ kr: w[0], vi: w[2], user: '(ghép nhầm)' })) });
    pane.innerHTML = `<div class="qcard result-big"><div class="ask">Ghép cặp</div><div class="score">${correct}<small>/${total}</small></div>
      <p class="cheer" lang="ko">${mistakes ? '좋아요! Nhầm ' + mistakes + ' lần thôi' : '완벽해요! Không nhầm lần nào'}</p></div>
      <div class="row"><button class="btn" id="again">Chơi lại</button><button class="btn line" id="back">Xong</button></div>`;
    pane.querySelector('#again').onclick = () => startMatch(pane, L, words, onBack, opts);
    pane.querySelector('#back').onclick = onBack;
    if (!mistakes) petals(pane.querySelector('.result-big'));
  };
  draw();
}

/* ---------- ngữ pháp ---------- */
function paneGrammar(pane, L) {
  const b = best(L.id, 'ngu-phap');
  pane.innerHTML = `${L.patterns.map(p => `<article class="pattern"><h3 lang="ko">${esc(p.form)}</h3><p>${esc(p.meaning)}</p>
      <ul>${p.examples.map(e => { const [k, v] = e.split(' — '); return `<li>${soundBtn(k)}<span class="ex"><span class="k" lang="ko">${esc(k)}</span><span class="v">${esc(v || '')}</span></span></li>`; }).join('')}</ul></article>`).join('')}
    ${L.practice && PLAN ? `<div class="note" style="background:var(--lav-wash)"><b>Luyện TOPIK trên Migii:</b>${practiceLinks(PLAN, L)}</div>` : ''}
    <button class="btn block" id="start">Làm ${L.exercises.length} bài tập ngữ pháp${b !== null ? ` · tốt nhất ${b}%` : ''}</button>`;
  pane.querySelector('#start').onclick = () => startGrammar(pane, L);
}
function grammarQuestions(L, list) {
  return list.map(e => {
    const kr = e.kr && e.kr !== '___' ? e.kr : '';
    const html = kr ? esc(kr).replace(/_{2,}/g, '<span class="blank">　</span>') : '';
    const base = { ex: e, explain: e.explain, ask: e.q, prompt: kr, html, sentence: true };
    if (e.type === 'read') return { ...base, kind: 'choice', html: '<span class="passage">' + esc(e.kr).replace(/\( ?_{2,} ?\)/g, '( <span class="blank">　</span> )') + '</span>', krOpts: e.options.every(o => /[가-힣]/.test(o)), options: shuffle(e.options), answer: e.answer };
    if (e.type === 'choice') return { ...base, kind: 'choice', krOpts: e.options.every(o => /[가-힣]/.test(o)), options: shuffle(e.options), answer: e.answer };
    if (e.type === 'fill') return { ...base, kind: 'input', answer: e.answer[0], answerShow: e.answer.join(' / '),
      check: u => e.answer.some(a => norm(a) === norm(u)) ? 'ok' : e.answer.some(a => tight(a) === tight(u)) ? 'space' : 'no' };
    if (e.type === 'order') return { ...base, kind: 'order', tokens: e.tokens, answer: e.answer };
    if (e.type === 'translate') return { ...base, prompt: '', html: '', kind: 'input', long: true, answer: e.answer[0], answerShow: e.answer.join('  /  '),
      check: u => e.answer.some(a => norm(a) === norm(u)) ? 'ok' : e.answer.some(a => tight(a) === tight(u)) ? 'space' : 'rev' };
    if (e.type === 'vi') return { ...base, kind: 'vi', answer: e.answer, check: () => 'rev' };
  }).filter(Boolean);
}
function startGrammar(pane, L, list) {
  const back = () => paneGrammar(pane, L);
  runQuiz(pane, grammarQuestions(L, list || L.exercises), {
    title: 'Bài tập ngữ pháp · ' + L.lesson,
    onDone: (score, total, log) => addResult({ lessonId: L.id, lesson: L.lesson, mode: 'ngu-phap', label: 'Bài tập ngữ pháp', total, correct: score,
      wrong: log.filter(x => x.res === 'no').map(x => ({ q: x.q.ex.q, kr: x.q.ex.kr || '', answer: x.q.answerShow || x.q.answer, user: x.user })),
      review: log.filter(x => x.res === 'rev').map(x => ({ type: x.q.ex.type, q: x.q.ex.q, kr: x.q.ex.kr || '', answer: x.q.answerShow || x.q.answer, user: x.user })) }),
    onBack: back, restart: () => startGrammar(pane, L),
    retryWith: wrongs => startGrammar(pane, L, wrongs.map(x => x.q.ex)),
  });
}

/* ---------- đặt câu ---------- */
function paneSentences(pane, L) {
  const key = 'draft.' + L.id; const draft = store.get(key, ['', '', '', '', '']);
  const forms = L.patterns.map(p => p.form);
  const sentToday = results().find(r => r.day === dayKey() && r.lessonId === L.id && r.mode === 'dat-cau');
  pane.innerHTML = `
    <p>Viết 3–5 câu tiếng Hàn dùng <b>mẫu ngữ pháp</b> và <b>từ mới</b> của bài. Claude sẽ sửa từng câu khi bạn nộp.</p>
    <div class="note"><b>Mẫu của bài:</b> <span lang="ko">${forms.map(esc).join(' · ')}</span><br>
      <b>Gợi ý từ:</b> <span lang="ko">${pick(L.words, 6).map(w => esc(plainKr(w[0]))).join(', ')}</span></div>
    <div class="sent-list">${draft.map((s, k) => `<label><span>${k + 1}.</span><textarea class="answer-input" rows="2" lang="ko" data-k="${k}" placeholder="${k < 3 ? 'Câu bắt buộc' : 'Câu thêm (không bắt buộc)'}">${esc(s)}</textarea></label>`).join('')}</div>
    <button class="btn block" id="save">${sentToday ? 'Cập nhật câu đã nộp hôm nay' : 'Nộp câu'}</button>
    ${sentToday ? `<p class="small muted" style="margin-top:10px">Đã lưu lúc ${fmtTime(sentToday.at)}. Vào <a href="#/nop-bai">Nộp bài</a> để copy gửi Claude.</p>` : ''}`;
  pane.querySelectorAll('textarea').forEach(t => t.addEventListener('input', () => { draft[+t.dataset.k] = t.value; store.set(key, draft); }));
  pane.querySelector('#save').onclick = () => {
    const sentences = draft.map(s => s.trim()).filter(Boolean);
    if (sentences.length < 3) { toast('Viết ít nhất 3 câu nhé'); return; }
    const all = results().filter(r => !(r.day === dayKey() && r.lessonId === L.id && r.mode === 'dat-cau'));
    store.set('results', all);
    addResult({ lessonId: L.id, lesson: L.lesson, mode: 'dat-cau', label: 'Đặt câu', grammar: forms.join(', '), sentences });
    toast('Đã lưu câu vào bài nộp'); paneSentences(pane, L);
  };
}

/* ---------- ôn tập ---------- */
async function renderReview(sub) {
  const lessons = await loadAll();
  const pool = lessons.flatMap(L => L.words.map(w => Object.assign(w.slice(), { _lesson: L.lesson })));
  const bank = Object.values(wrongBank()).sort((a, b) => b.n - a.n);
  const wrongWords = bank.map(x => Object.assign(x.w.slice(), { _lesson: x.lesson }));
  const fake = { id: 'on-tap', lesson: 'Ôn tập', words: pool };
  const home = () => renderReview();
  $app.innerHTML = `<h1>Ôn tập</h1><p class="muted">Trộn từ của tất cả các bài, hoặc ôn riêng những từ bạn hay sai.</p><section id="pane"></section>`;
  const pane = document.getElementById('pane');
  const due = dueWords(pool).map(w => Object.assign(w, {}));
  const s = srs(); const fresh = pool.filter(w => !s[w[0]]).length;
  pane.innerHTML = `
    <h2>Ôn từ sắp quên</h2>
    <div class="note" style="background:var(--celadon-wash)">Mỗi từ bạn làm đúng sẽ được hẹn ôn lại sau 1, 2, 4, 7, 15 rồi 30 ngày. Làm sai thì hẹn lại ngay hôm sau. Ôn đúng lúc là cách nhớ lâu nhất.</div>
    ${due.length ? `<p><b>${due.length} từ</b> đến hạn ôn hôm nay.</p>
      <div class="modes"><button class="mode" data-d="kv"><b>Ôn bằng trắc nghiệm</b><span>Hàn → Việt</span></button>
      <button class="mode" data-d="viet"><b>Ôn bằng viết</b><span>Gõ chữ Hàn</span></button></div>`
      : `<p class="small muted">Hôm nay chưa có từ nào đến hạn. ${fresh ? `Còn ${fresh} từ bạn chưa luyện lần nào, làm thử Ôn tổng hợp bên dưới nhé.` : 'Tuyệt vời!'}</p>`}
    <h2>Từ hay sai</h2>
    ${wrongWords.length ? `<p class="small muted">${wrongWords.length} từ. Làm đúng 2 lần liên tiếp thì từ sẽ tự rời danh sách.</p>
      <div class="modes"><button class="mode" data-w="viet"><b>Viết lại từ sai</b><span>Gõ chữ Hàn</span></button>
      <button class="mode" data-w="kv"><b>Trắc nghiệm từ sai</b><span>Hàn → Việt</span></button>
      <button class="mode" data-w="the"><b>Flashcard từ sai</b><span>Lướt nhanh</span></button>
      <button class="mode" data-w="nghe"><b>Nghe từ sai</b><span>Nghe chọn từ</span></button></div>
      <ul class="words" style="margin-top:14px">${wrongWords.slice(0, 30).map(w => `<li>${soundBtn(w[0])}<div class="w"><span class="k" lang="ko">${esc(w[0])}</span><span class="r">${esc(w._lesson)}</span></div><span class="v">${esc(w[2])}</span></li>`).join('')}</ul>`
      : '<p class="note">Chưa có từ sai nào. Làm bài luyện từ, từ nào sai sẽ tự vào đây.</p>'}
    <h2>Ôn tổng hợp</h2>
    <p class="small muted">${pool.length} từ từ ${lessons.length} bài · 20 câu ngẫu nhiên</p>
    <div class="modes">${VOCAB_MODES.map(([k, t, d]) => `<button class="mode" data-m="${k}"><b>${t}</b><span>${d}</span></button>`).join('')}
      <button class="mode wide" data-m="gp"><b>Ngữ pháp tổng hợp</b><span>15 câu trộn từ mọi bài</span></button></div>`;
  pane.querySelectorAll('[data-d]').forEach(b => b.onclick = () =>
    startVocab(pane, fake, b.dataset.d, 0, due, home, { pool, lessonId: 'on-tap', lessonName: 'Ôn từ đến hạn', modeKey: 'on-han', label: 'Ôn từ sắp quên' }));
  pane.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
    if (b.dataset.w === 'the') return paneFlash(pane, fake, wrongWords);
    startVocab(pane, fake, b.dataset.w, 0, wrongWords, home, { pool, lessonId: 'on-tap', lessonName: 'Ôn từ sai', modeKey: 'on-tu-sai', label: 'Ôn từ sai' });
  });
  pane.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const m = b.dataset.m;
    if (m === 'gp') {
      const mix = pick(lessons.flatMap(L => L.exercises.map(e => ({ ...e, q: `[${L.lesson}] ${e.q}` }))), 15);
      const fakeL = { id: 'on-tap', lesson: 'Ôn tổng hợp', exercises: mix, patterns: [] };
      return runQuiz(pane, grammarQuestions(fakeL, mix), {
        title: 'Ngữ pháp tổng hợp', onBack: home, restart: () => b.click(),
        onDone: (score, total, log) => addResult({ lessonId: 'on-tap', lesson: 'Ôn tổng hợp', mode: 'ngu-phap', label: 'Ngữ pháp tổng hợp', total, correct: score,
          wrong: log.filter(x => x.res === 'no').map(x => ({ q: x.q.ex.q, kr: x.q.ex.kr || '', answer: x.q.answerShow || x.q.answer, user: x.user })),
          review: log.filter(x => x.res === 'rev').map(x => ({ type: x.q.ex.type, q: x.q.ex.q, kr: x.q.ex.kr || '', answer: x.q.answerShow || x.q.answer, user: x.user })) }),
      });
    }
    startVocab(pane, fake, m, 20, pool, home, { pool, lessonId: 'on-tap', lessonName: 'Ôn tổng hợp', modeKey: m, label: 'Ôn tổng hợp · ' + VOCAB_MODES.find(x => x[0] === m)[1] });
  });
}

/* ---------- sổ tay ---------- */
const CONS = [['ㄱ','g/k','가'],['ㄴ','n','나'],['ㄷ','d/t','다'],['ㄹ','r/l','라'],['ㅁ','m','마'],['ㅂ','b/p','바'],['ㅅ','s','사'],['ㅇ','câm / ng','아'],['ㅈ','j','자'],['ㅊ','ch','차'],['ㅋ','k','카'],['ㅌ','t','타'],['ㅍ','p','파'],['ㅎ','h','하'],['ㄲ','kk','까'],['ㄸ','tt','따'],['ㅃ','pp','빠'],['ㅆ','ss','싸'],['ㅉ','jj','짜']];
const VOWS = [['ㅏ','a','아'],['ㅑ','ya','야'],['ㅓ','eo','어'],['ㅕ','yeo','여'],['ㅗ','o','오'],['ㅛ','yo','요'],['ㅜ','u','우'],['ㅠ','yu','유'],['ㅡ','eu','으'],['ㅣ','i','이'],['ㅐ','ae','애'],['ㅒ','yae','얘'],['ㅔ','e','에'],['ㅖ','ye','예'],['ㅘ','wa','와'],['ㅙ','wae','왜'],['ㅚ','oe','외'],['ㅝ','wo','워'],['ㅞ','we','웨'],['ㅟ','wi','위'],['ㅢ','ui','의']];
const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const NATIVE = [['하나','1'],['둘','2'],['셋','3'],['넷','4'],['다섯','5'],['여섯','6'],['일곱','7'],['여덟','8'],['아홉','9'],['열','10'],['스물','20'],['서른','30']];
function sinoRead(n) {
  n = Math.floor(n); if (!n) return '영'; if (n >= 1e8) return '';
  const four = x => { let s = ''; [[1000,'천'],[100,'백'],[10,'십'],[1,'']].forEach(([u, name]) => { const d = Math.floor(x / u) % 10; if (d) s += (d === 1 && u > 1 ? '' : SINO[d]) + name; }); return s; };
  const man = Math.floor(n / 10000), rest = n % 10000;
  return (man ? (man === 1 ? '' : four(man)) + '만' : '') + four(rest);
}
function batchim(word) {
  const ch = String(word).trim().replace(/[^가-힣]+$/, '').slice(-1); if (!ch) return null;
  const code = ch.charCodeAt(0) - 0xAC00; if (code < 0 || code > 11171) return null;
  const f = code % 28; return { has: f !== 0, rieul: f === 8 };
}
function renderNotes() {
  $app.innerHTML = `<h1>Sổ tay</h1><p class="muted">Những thứ hay phải tra lại, gom về một chỗ.</p>
    <h2>Gắn tiểu từ cho đúng</h2>
    <p class="small muted">Gõ một danh từ, web xem nó có patchim không và chọn tiểu từ giúp bạn.</p>
    <input class="answer-input" id="pin" lang="ko" placeholder="Ví dụ: 학교, 커피, 서울" autocomplete="off">
    <div id="pout" class="particles"></div>
    <h2>Đọc số Hán Hàn</h2>
    <p class="small muted">Dùng cho năm, tháng, ngày, tiền, số điện thoại, phút.</p>
    <input class="answer-input vi-in" id="nin" inputmode="numeric" placeholder="Gõ một số, ví dụ 2026">
    <div id="nout" class="num-out"></div>
    <div class="num-grid">${SINO.slice(1).map((s, k) => `<button data-say="${s}"><b lang="ko">${s}</b><span>${k + 1}</span></button>`).join('')}
      ${[['십',10],['백',100],['천','1.000'],['만','10.000']].map(([s, v]) => `<button data-say="${s}"><b lang="ko">${s}</b><span>${v}</span></button>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">Nhớ: tháng 6 là <b lang="ko">유월</b>, tháng 10 là <b lang="ko">시월</b>.</p>
    <h2>Số thuần Hàn</h2>
    <p class="small muted">Dùng để đếm đồ vật, tuổi, giờ. Sắp học trong các bài tới.</p>
    <div class="num-grid">${NATIVE.map(([s, v]) => `<button data-say="${s}"><b lang="ko">${s}</b><span>${v}</span></button>`).join('')}</div>
    <h2>Bảng chữ cái</h2>
    <p class="small muted">Chạm vào chữ để nghe (đọc kèm nguyên âm ㅏ cho phụ âm).</p>
    <h3 style="margin:12px 0 8px">Phụ âm</h3>
    <div class="jamo">${CONS.map(([j, r, s]) => `<button data-say="${s}"><b lang="ko">${j}</b><span>${r}</span></button>`).join('')}</div>
    <h3 style="margin:16px 0 8px">Nguyên âm</h3>
    <div class="jamo">${VOWS.map(([j, r, s]) => `<button data-say="${s}"><b lang="ko">${j}</b><span>${r}</span></button>`).join('')}</div>
    <h2>Gõ tiếng Hàn trên điện thoại</h2>
    <ul class="tips">
      <li><b>iPhone:</b> Cài đặt → Cài đặt chung → Bàn phím → Bàn phím → Thêm bàn phím mới → Hàn Quốc → chọn "Standard" (2 hàng chữ giống bàn phím máy tính).</li>
      <li><b>Android (Gboard):</b> Cài đặt Gboard → Ngôn ngữ → Thêm bàn phím → Tiếng Hàn → chọn "2-Bulsik".</li>
      <li>Giữ nút quả địa cầu để đổi qua lại giữa tiếng Việt và tiếng Hàn.</li>
    </ul>`;
  const pin = document.getElementById('pin'), pout = document.getElementById('pout');
  const drawP = () => {
    const w = pin.value.trim().replace(/\s+/g, ''); const b = batchim(w);
    if (!w) { pout.innerHTML = ''; return; }
    if (!b) { pout.innerHTML = '<p class="small muted">Hãy gõ một từ tiếng Hàn.</p>'; return; }
    const rows = [
      ['Chủ đề (thì, là)', b.has ? '은' : '는'], ['Chủ ngữ', b.has ? '이' : '가'], ['Tân ngữ', b.has ? '을' : '를'],
      ['Và', b.has ? '과' : '와'], ['Là (thân mật)', b.has ? '이에요' : '예요'], ['Không phải là', (b.has ? '이' : '가') + ' 아닙니다'],
      ['Bằng / tới', b.has && !b.rieul ? '으로' : '로'], ['Là (trang trọng)', '입니다'],
    ];
    pout.innerHTML = `<p class="small">${b.has ? `<b lang="ko">${esc(w.slice(-1))}</b> có patchim${b.rieul ? ' ㄹ' : ''}` : `<b lang="ko">${esc(w.slice(-1))}</b> không có patchim`}</p>
      <ul class="words">${rows.map(([t, p]) => `<li><div class="w"><div class="wtop"><span class="k" lang="ko">${esc(w)}${esc(p)}</span><span class="v">${t}</span></div></div>${soundBtn(w + p)}</li>`).join('')}</ul>`;
  };
  pin.addEventListener('input', drawP);
  const nin = document.getElementById('nin'), nout = document.getElementById('nout');
  nin.addEventListener('input', () => {
    const n = +nin.value.replace(/\D/g, '');
    if (!nin.value.trim()) { nout.innerHTML = ''; return; }
    const r = sinoRead(n);
    nout.innerHTML = r ? `<span lang="ko">${r}</span> ${soundBtn(r)}` : '<span class="small muted">Số lớn quá, thử số nhỏ hơn 100 triệu nhé.</span>';
  });
}

/* ---------- nộp bài ---------- */
function buildReport(day, list) {
  const L = [`📚 KẾT QUẢ HỌC TIẾNG HÀN — ${fmtDate(day)}`, ''];
  list.forEach(r => {
    if (r.mode === 'nhat-ky') {
      L.push(`📔 Nhật ký (đề: ${r.prompt})`);
      r.sentences.forEach((s, k) => L.push(`  ${k + 1}. ${s}`));
    } else if (r.mode === 'migii') {
      L.push(`🎧📖 Đã làm luyện Nghe + Đọc TOPIK I trên Migii`);
    } else if (r.mode === 'dat-cau') {
      L.push(`✏️ [${r.lesson}] Đặt câu (mẫu: ${r.grammar})`);
      r.sentences.forEach((s, k) => L.push(`  ${k + 1}. ${s}`));
    } else {
      L.push(`• [${r.lesson}] ${r.label}: ${r.correct}/${r.total} (${r.total ? Math.round(100 * r.correct / r.total) : 0}%) — lúc ${fmtTime(r.at)}`);
      (r.wrong || []).forEach(w => L.push(w.q ? `   ✗ ${w.q}${w.kr ? ' | ' + w.kr : ''} → bạn: ${w.user} | đáp án: ${w.answer}` : `   ✗ ${w.kr} (${w.vi}) → bạn: ${w.user}`));
      (r.review || []).forEach(w => L.push(`   ? ${w.q}${w.kr ? ' | ' + w.kr : ''} → bạn: ${w.user} | mẫu: ${w.answer}`));
    }
    L.push('');
  });
  L.push('Nhờ Claude chấm và nhận xét giúp mình nhé! (✗ = sai, ? = câu dịch cần Claude chấm)');
  return L.join('\n');
}
function renderSubmit(dayArg) {
  const day = dayArg || dayKey();
  const list = results().filter(r => r.day === day);
  const days = [...new Set(results().map(r => r.day))].sort().reverse();
  $app.innerHTML = `<h1>Nộp bài</h1>
    <p class="muted">Làm xong thì bấm <b>Copy kết quả</b>, rồi dán vào chat với Claude để được chấm và nhận xét.</p>
    <div class="daypick"><label for="d">Ngày</label><select id="d" class="searchbox" style="margin:0;width:auto">${(days.includes(day) ? days : [day, ...days]).map(d => `<option value="${d}" ${d === day ? 'selected' : ''}>${fmtDate(d)}${d === dayKey() ? ' (hôm nay)' : ''}</option>`).join('')}</select></div>
    ${list.length ? list.map(r => `<div class="entry"><div class="h"><span>${esc(r.lesson)} · ${esc(r.label)}</span>
        <span class="s">${r.sentences ? r.sentences.length + ' câu' : r.mode === 'migii' ? '✓' : `${r.correct}/${r.total}`}</span></div>
        <div class="d">${fmtTime(r.at)}${r.wrong?.length ? ` · ${r.wrong.length} câu sai` : ''}${r.review?.length ? ` · ${r.review.length} câu chờ chấm` : ''}</div></div>`).join('')
      : '<p class="note">Ngày này chưa có bài nào. Vào <a href="#/">Bài học</a> để bắt đầu nhé.</p>'}
    ${list.length ? `<button class="btn block" id="copy">Copy kết quả</button>
      <details style="margin-top:12px"><summary class="small muted">Xem nội dung sẽ gửi</summary><textarea class="preview" readonly id="pv"></textarea></details>` : ''}`;
  document.getElementById('d').onchange = e => { location.hash = '#/nop-bai/' + e.target.value; };
  if (!list.length) return;
  const text = buildReport(day, list);
  document.getElementById('pv').value = text;
  document.getElementById('copy').onclick = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = document.getElementById('pv'); ta.closest('details').open = true; ta.select();
      try { ok = document.execCommand('copy'); } catch {}
    }
    if (ok) {
      const all = results(); all.forEach(r => { if (r.day === day) r.sent = true; }); store.set('results', all); updateBadge();
      toast('Đã copy! Dán vào chat với Claude nhé');
    } else toast('Chưa copy được — hãy chọn và copy trong ô bên dưới');
  };
}

route();
})();
