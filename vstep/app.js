/* Học VSTEP B2 — sổ học theo ngày. Không cần máy chủ: dữ liệu trong /data, tiến độ lưu trên máy (khóa 'vs.' để không đụng web tiếng Hàn). */
(() => {
'use strict';

const $app = document.getElementById('app');
const cache = {};
let INDEX = null;

/* ---------- lưu trữ trên máy ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('vs.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('vs.' + k, JSON.stringify(v)); } catch {} },
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
/* "colour (color)" → ["colour (color)","colour","color"] — chấp nhận cả hai cách viết */
const variants = kr => { const m = String(kr).match(/^(.*?)\s*\((.*)\)\s*$/); const out = [kr]; if (m) out.push(m[1], m[2]); return out; };
/* phần của từ xuất hiện nguyên vẹn trong câu ví dụ (không phân biệt hoa thường; từ đã chia thì bỏ qua) */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blankKey = w => {
  if (!w[3]) return null;
  for (const v of variants(w[0]).map(v => v.replace(/[.!?]$/, '').trim()).filter(Boolean)) {
    const m = w[3].match(new RegExp('\\b' + reEsc(v) + '\\b', 'i')); if (m) return m[0];
  }
  return null;
};
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

/* ---------- đọc tiếng Anh ---------- */
let koVoice = null;
function loadVoice() { try { const vs = speechSynthesis.getVoices(); koVoice = vs.find(v => /^en[-_]US/i.test(v.lang) && /natural|google|samantha|aria|jenny/i.test(v.name)) || vs.find(v => /^en[-_](US|GB)/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; } catch {} }
if ('speechSynthesis' in window) { loadVoice(); speechSynthesis.onvoiceschanged = loadVoice; }
function speak(text, rate = 0.85) {
  if (!('speechSynthesis' in window)) { toast('Trình duyệt này chưa hỗ trợ đọc'); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plainKr(text));
    u.lang = 'en-US'; u.rate = rate; if (koVoice) u.voice = koVoice;
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
const PIG = (cls = 'pig') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="M15 22 10 7l15 8z" fill="#FFB3C8" stroke="#E9839F" stroke-width="2" stroke-linejoin="round"/><path d="M49 22l5-15-15 8z" fill="#FFB3C8" stroke="#E9839F" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="36" r="22" fill="#FFCADA" stroke="#E9839F" stroke-width="2"/><path d="M46 8l6 3.2-6 3.2zM58 8l-6 3.2 6 3.2z" fill="#5AA9F0" stroke="#2F7CC4" stroke-width="1.2" stroke-linejoin="round"/><circle cx="52" cy="11.2" r="2" fill="#2F7CC4"/><circle cx="23" cy="31" r="3" fill="#3B2A35"/><circle cx="41" cy="31" r="3" fill="#3B2A35"/><circle cx="24" cy="30" r="1" fill="#fff"/><circle cx="42" cy="30" r="1" fill="#fff"/><ellipse cx="16.5" cy="39" rx="4" ry="2.4" fill="#FF8FB0" opacity=".55"/><ellipse cx="47.5" cy="39" rx="4" ry="2.4" fill="#FF8FB0" opacity=".55"/><ellipse cx="32" cy="42" rx="9" ry="6.5" fill="#FFA3BE" stroke="#E9839F" stroke-width="1.6"/><ellipse cx="28.6" cy="42" rx="1.6" ry="2.4" fill="#C9587E"/><ellipse cx="35.4" cy="42" rx="1.6" ry="2.4" fill="#C9587E"/><path d="M28.5 51q3.5 2.6 7 0" fill="none" stroke="#C9587E" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const CHEERS = ['🐷 Heo con cố lên — you can do it!', '🐷 Slow and steady — chậm mà chắc', '🐷 One step closer to B2 — hôm nay thêm một bước', '🐷 Practice makes perfect — luyện nhiều là giỏi', '🐷 Believe in yourself — tin vào bản thân nha'];
const enTitle = l => l.enTitle || l.title;
async function renderHome() {
  const idx = await loadIndex();
  const ls = idx.lessons.slice();
  if (!ls.length) { $app.innerHTML = '<p class="empty">Chưa có bài nào.</p>'; return; }
  const latest = ls[ls.length - 1];
  const lt = await loadLesson(latest.id);
  const todayDone = results().filter(r => r.day === dayKey()).length;
  const cheer = CHEERS[new Date().getDate() % CHEERS.length];
  const ex = await todayExtras();
  $app.innerHTML = `
    ${ex && ex.quote ? `<section class="quote" aria-label="Câu nói hôm nay">
      <div class="q-label">☁ Quote of the day ☁</div>
      <p class="q-kr" lang="en">${esc(ex.quote.en)}</p>
      <p class="q-vi">${esc(ex.quote.vi)}</p>
      ${soundBtn(ex.quote.en, 'Nghe câu nói')}
    </section>` : ''}
    <section class="hero" aria-label="Bài mới nhất">
      <span class="ghost" lang="en" aria-hidden="true">B2</span>
      <span class="tiara" aria-hidden="true">${PIG('pig hero-pig')}</span>
      <span class="spark s1" aria-hidden="true">✦</span><span class="spark s2" aria-hidden="true">☁</span><span class="spark s3" aria-hidden="true">✦</span>
      <div class="when">${latest.date ? 'Bài ngày ' + fmtDate(latest.date) : 'Bài mới nhất'}</div>
      <span class="hangul" lang="en">${esc(enTitle(latest))}</span>
      <div class="vi">${esc(latest.lesson)} · ${esc(latest.title)}</div>
      <div class="stats"><span><b>${lt.words.length}</b> từ</span><span><b>${lt.patterns.length}</b> ngữ pháp</span><span><b>${lt.exercises.length}</b> bài tập</span></div>
      <div class="row"><a class="btn light" href="#/${latest.id}">Vào học</a><a class="btn line" style="color:#fff;border-color:rgba(255,255,255,.35)" href="#/${latest.id}/luyen">Làm bài luôn</a></div>
    </section>
    <p class="cheer">${esc(cheer)}</p>
    ${await todayCard(ex)}
    ${homeSupport(latest, lt, await loadAll())}
    ${todayDone ? `<p class="note">Hôm nay bạn đã làm <b>${todayDone}</b> phần. Xong thì vào <a href="#/nop-bai">Nộp bài</a> để copy kết quả gửi Claude nhé.</p>` : ''}
    <h2>Các ngày đã học</h2>
    <ol class="timeline">
      ${ls.slice().reverse().map(l => {
        const modes = ['viet', 'kv', 'vk', 'nghe', 'ghep', 'ngu-phap', 'writing', 'speaking'];
        const done = modes.filter(m => best(l.id, m) !== null || results().some(r => r.lessonId === l.id && r.mode === m));
        const n = l.lesson.replace(/\D/g, '');
        return `<li data-n="${n}" class="${done.length >= 4 ? 'done' : ''}">
          <a class="lesson-link" href="#/${l.id}">
            <div class="t"><span class="kr" lang="en">${esc(enTitle(l))}</span><span class="small muted">${l.date ? fmtDate(l.date) : ''}</span></div>
            <div class="meta">${esc(l.lesson)} · ${esc(l.title)} · ${l.words} từ · ${l.exercises} bài tập</div>
            <div class="dots" aria-label="Đã làm ${done.length}/${modes.length} dạng bài">${modes.map(m => `<i class="${done.includes(m) ? 'on' : ''}"></i>`).join('')}</div>
          </a></li>`;
      }).join('')}
    </ol>`;
  petals($app.querySelector('.hero'));
  bindHomeExtras(ex);
}
/* góc học mỗi ngày: lấy từ "corner" của bài hôm nay (hoặc bài mới nhất) */
async function todayExtras() {
  const plan = await loadPlan(); const idx = await loadIndex();
  let id = null;
  if (plan) { const { d } = planToday(plan); if (d && d.id && idx.lessons.some(l => l.id === d.id)) id = d.id; }
  if (!id && idx.lessons.length) id = idx.lessons[idx.lessons.length - 1].id;
  if (!id) return null;
  const L = await loadLesson(id);
  return L.corner ? { ...L.corner, day: L.day || L.lesson } : null;
}
function extrasHtml(ex) {
  if (!ex) return '';
  const draft = store.get('diary.' + dayKey(), '');
  const saved = results().find(r => r.day === dayKey() && r.mode === 'nhat-ky');
  return `<div class="extras">
    <h3 class="ex-h">🐷 Góc heo con hôm nay</h3>
    ${ex.pron ? `<details open><summary>🗣️ Phát âm: ${esc(ex.pron.title)}</summary>
      <p class="small">${esc(ex.pron.rule)}</p>
      <ul class="ex-list">${ex.pron.examples.map(e => `<li><span lang="en">${esc(e)}</span>${soundBtn(e.split(/[→(/]/)[0].trim())}</li>`).join('')}</ul></details>` : ''}
    ${ex.phrases ? `<details><summary>💬 3 cụm ăn điểm</summary>
      <ul class="ex-list">${ex.phrases.map(([k, v]) => `<li><span><span lang="en" class="kr">${esc(k)}</span><br><span class="muted small">${esc(v)}</span></span>${soundBtn(k)}</li>`).join('')}</ul></details>` : ''}
    ${ex.mistake ? `<details><summary>🚫 Lỗi người Việt hay mắc</summary><p class="small">${esc(ex.mistake)}</p></details>` : ''}
    ${ex.tip ? `<details><summary>🎯 Mẹo thi VSTEP</summary><p class="small">${esc(ex.tip)}</p></details>` : ''}
    ${ex.diary ? `<details ${saved ? '' : 'open'}><summary>📔 Nhật ký 3 câu${saved ? ' ✓' : ''}</summary>
      <p class="small"><b>Đề:</b> ${esc(ex.diary)}</p>
      <textarea class="answer-input" id="diary" rows="4" lang="en" placeholder="Write 3–5 sentences in English…">${esc(saved ? saved.sentences.join('\n') : draft)}</textarea>
      <button class="btn block" id="diarySave" style="margin-top:10px">${saved ? 'Cập nhật nhật ký' : 'Lưu nhật ký vào bài nộp'}</button></details>` : ''}
  </div>`;
}
function bindHomeExtras(ex) {
  const ta = document.getElementById('diary'); if (!ta || !ex) return;
  ta.addEventListener('input', () => store.set('diary.' + dayKey(), ta.value));
  document.getElementById('diarySave').onclick = () => {
    const sentences = ta.value.split(/\n+|(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length < 3) { toast('Viết ít nhất 3 câu nhé heo con'); return; }
    store.set('results', results().filter(r => !(r.day === dayKey() && r.mode === 'nhat-ky')));
    addResult({ lessonId: 'nhat-ky', lesson: 'Ngày ' + ex.day, mode: 'nhat-ky', label: 'Nhật ký', prompt: ex.diary, sentences });
    markStudied(); toast('Đã lưu nhật ký 🐷'); renderHome();
  };
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
const N_DAYS = () => (PLAN ? PLAN.days.length : 30);
async function todayCard(ex) {
  const plan = await loadPlan(); if (!plan) return extrasHtml(ex) ? `<section class="today">${extrasHtml(ex)}</section>` : '';
  const { d, before, after } = planToday(plan); const N = plan.days.length;
  const idx = INDEX ? INDEX.lessons.map(l => l.id) : [];
  const ready = d.id && idx.includes(d.id);
  const pct = Math.round(100 * Math.max(0, Math.min(N, d.day - (before ? 1 : 0))) / N);
  return `<section class="today">
    <div class="today-h"><span class="day-badge">${before ? 'Sắp bắt đầu' : after ? 'Về đích B2 🎉' : 'Ngày ' + d.day + '/' + N}</span>
      <a class="small" href="#/lo-trinh">Xem lộ trình</a></div>
    <div class="road"><i style="width:${pct}%"></i><span class="crown-pin" style="left:${pct}%">${PIG('pig pin-pig')}</span></div>
    <h3>${before ? 'Ngày 1 bắt đầu ' + fmtDate(d.date) + ': ' : ''}${esc(d.title)}${d.topicEn ? ` <span class="muted small" lang="en">· ${esc(d.topicEn)}</span>` : ''}</h3>
    ${d.type !== 'learn' ? `<ul class="prac">${(d.tasks || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <a class="btn block" href="#/on-tap">Vào ôn tập</a>`
      : `<p class="small muted">Ngữ pháp: <span lang="en">${(d.grammar || []).map(g => esc(g.split(' — ')[0])).join(' · ')}</span>${d.skill ? `<br>Kỹ năng: ${esc(d.skill)}` : ''}</p>
        ${ready ? `<a class="btn block" href="#/${d.id}">Học ${esc(d.lesson)} ngay</a>` : `<p class="note">Bài này sẽ được soạn xong tối hôm trước (20:45). Trong lúc chờ, vào Ôn tập nhé.</p>`}`}
    ${extrasHtml(ex)}
  </section>`;
}
async function renderPlan() {
  const plan = await loadPlan(); await loadIndex();
  if (!plan) { $app.innerHTML = '<p class="empty">Chưa có lộ trình.</p>'; return; }
  const t = dayKey(); const ids = INDEX.lessons.map(l => l.id);
  $app.innerHTML = `<h1>Lộ trình ${plan.days.length} ngày</h1>
    <p class="muted">${esc(plan.goal)}</p>
    <ol class="plan">${plan.days.map(d => {
      const st = d.date < t ? 'past' : d.date === t ? 'now' : 'next';
      const link = d.id && ids.includes(d.id);
      return `<li class="${st} ${d.type}"><div class="pd"><b>${d.day}</b><span>${fmtDate(d.date).slice(0, -5)}</span></div>
        <div class="pc">${link ? `<a href="#/${d.id}">` : ''}<div class="pt">${esc(d.title)}</div>${link ? '</a>' : ''}
        <div class="small muted">${d.type !== 'learn' ? esc((d.tasks || [])[0] || 'Ôn tập') : '<span lang="en">' + (d.grammar || []).map(g => esc(g.split(' — ')[0])).join(' · ') + '</span>' + (d.skill ? ' · ' + esc(d.skill) : '')}</div></div></li>`;
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
    ['Làm bài tập ngữ pháp + đọc hiểu', did(r => r.lessonId === latest.id && r.mode === 'ngu-phap'), `#/${latest.id}/ngu-phap`],
    ['Viết bài (Writing)', did(r => r.lessonId === latest.id && r.mode === 'writing'), `#/${latest.id}/viet-bai`],
    ['Luyện nói (Speaking)', did(r => r.lessonId === latest.id && r.mode === 'speaking'), `#/${latest.id}/noi-bai`],
    [due ? `Ôn ${due} từ sắp quên` : 'Ôn từ sắp quên (hôm nay chưa có)', due === 0 || did(r => r.mode === 'on-han'), '#/on-tap'],
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
        <div class="small muted">${st ? (st >= 7 ? 'Một tuần không nghỉ, heo con đỉnh quá!' : 'Giữ lửa nhé, mai học tiếp!') : 'Học một phần bất kỳ để bắt đầu chuỗi ngày.'} · Đã thuộc <b>${masteredCount()}</b>/${pool.length} từ</div>
      </div>
      <div class="goals"><div class="goals-h"><h3>Nhiệm vụ hôm nay</h3><span class="small muted">${doneN}/${goals.length}</span></div>
        <div class="goal-bar"><i style="width:${100 * doneN / goals.length}%"></i></div>
        <ul>${goals.map(([t, ok, href]) => `<li class="${ok ? 'ok' : ''}"><a href="${href}"><span class="tick" aria-hidden="true">${ok ? '✓' : ''}</span>${esc(t)}</a></li>`).join('')}</ul>
        ${doneN === goals.length ? '<p class="cheer">All done! Xong hết rồi, giỏi quá 🐷</p>' : ''}</div>
      ${wod ? `<div class="wod"><div class="small muted">Từ của ngày</div>
        <div class="wod-k"><span lang="en">${esc(wod[0])}</span>${soundBtn(wod[0])}</div>
        <div><b>${esc(wod[2])}</b> <span class="muted small">${esc(wod[1])}</span></div>
        ${wod[3] ? `<div class="wod-ex"><span lang="en">${esc(wod[3])}</span> ${soundBtn(wod[3], 'Nghe câu')}<br><span class="muted small">${esc(wod[4])}</span></div>` : ''}</div>` : ''}
    </section>`;
}
/* bong bóng bay lên (thay cho cánh hoa) */
function petals(host) {
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('i'); p.className = 'petal';
    p.style.left = (Math.random() * 100) + '%';
    p.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
    const s = 8 + Math.random() * 10; p.style.width = p.style.height = s + 'px';
    p.style.animationDuration = (3 + Math.random() * 3) + 's';
    p.style.animationDelay = (Math.random() * 1.5) + 's';
    host.appendChild(p);
  }
}

/* ---------- trang bài học ---------- */
const TABS = [['tu-vung', 'Từ vựng'], ['the', 'Flashcard'], ['luyen', 'Luyện từ'], ['ngu-phap', 'Ngữ pháp'], ['viet-bai', 'Viết'], ['noi-bai', 'Nói']];
async function renderLesson(id, tab) {
  const L = await loadLesson(id); await loadPlan();
  $app.innerHTML = `
    <a class="back" href="#/">${ICON.left.replace('<svg', '<svg width="16" height="16" style="fill:none;stroke:currentColor;stroke-width:2"')} Tất cả bài</a>
    <div class="lesson-head"><span class="kr" lang="en">${esc(enTitle(L))}</span>
      <div class="muted">${esc(L.lesson)} · ${esc(L.title)}${L.date ? ' · ' + fmtDate(L.date) : ''}</div></div>
    <nav class="tabs" aria-label="Phần của bài">${TABS.map(([k, v]) => `<a href="#/${id}/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${v}</a>`).join('')}</nav>
    <section id="pane"></section>`;
  const pane = document.getElementById('pane');
  ({ 'tu-vung': paneWords, 'the': paneFlash, 'luyen': panePractice, 'ngu-phap': paneGrammar, 'viet-bai': paneWriting, 'noi-bai': paneSpeaking }[tab] || paneWords)(pane, L);
  document.querySelector('.tabs a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function paneWords(pane, L) {
  pane.innerHTML = `<input class="searchbox" type="search" placeholder="Tìm từ (Anh hoặc Việt)…" aria-label="Tìm từ">
    <ul class="words" id="wl"></ul>`;
  const draw = q => {
    q = norm(q);
    const ws = L.words.filter(w => !q || norm(w[0]).includes(q) || norm(w[2]).includes(q) || norm(w[1]).includes(q));
    pane.querySelector('#wl').innerHTML = ws.map(w => `<li>
      ${soundBtn(w[0])}
      <div class="w"><div class="wtop"><span class="k" lang="en">${esc(w[0])}</span><span class="v">${esc(w[2])}</span></div><span class="r">${esc(w[1])}</span>
        ${w[3] ? `<span class="ex"><span class="k" lang="en">${esc(w[3])}</span> <button class="icon-btn" style="width:28px;height:28px;vertical-align:middle" data-say="${esc(w[3])}" aria-label="Nghe câu ví dụ">${ICON.sound}</button><span class="vv">${esc(w[4])}</span></span>` : ''}
      </div></li>`).join('') || '<li class="muted">Không tìm thấy từ nào.</li>';
  };
  pane.querySelector('input').addEventListener('input', e => draw(e.target.value));
  draw('');
}

function paneFlash(pane, L, words) {
  let list = (words || L.words).slice(), i = 0, front = 'kr';
  pane.innerHTML = `
    <div class="count-pick" role="group" aria-label="Mặt trước"><span>Mặt trước:</span>
      <button data-front="kr" class="on">Tiếng Anh</button><button data-front="vi">Tiếng Việt</button></div>
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
    const krFace = `<div class="big" lang="en">${esc(w[0])}</div><div class="rom">${esc(w[1])}</div>`;
    const viFace = `<div class="mean">${esc(w[2])}</div>${w[3] ? `<div class="exk" lang="en">${esc(w[3])}</div><div class="exv">${esc(w[4])}</div>` : ''}`;
    inner.innerHTML = `<div class="face">${front === 'kr' ? krFace : `<div class="mean">${esc(w[2])}</div>`}<span class="hint">Chạm để lật</span></div>
      <div class="face back-f">${front === 'kr' ? viFace : krFace + (w[3] ? `<div class="exk" lang="en">${esc(w[3])}</div><div class="exv">${esc(w[4])}</div>` : '')}</div>`;
    fc.classList.remove('flip');
    pane.querySelector('#cnt').textContent = `${i + 1} / ${list.length}`;
  };
  let flips = 0;
  const flip = () => {
    if (++flips === 5 && L.id !== 'on-tap') { store.set(`seen.${dayKey()}.${L.id}`, true); markStudied(); toast('Đã tính là lướt flashcard hôm nay 🐷'); }
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
  ['viet', 'Kiểm tra viết', 'Nhìn nghĩa, gõ từ tiếng Anh'],
  ['kv', 'Anh → Việt', 'Trắc nghiệm chọn nghĩa'],
  ['vk', 'Việt → Anh', 'Trắc nghiệm chọn từ'],
  ['nghe', 'Nghe chọn từ', 'Nghe phát âm, chọn đúng từ'],
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
    if (mode === 'viet') return { w, kind: 'input', ask: 'Viết từ tiếng Anh', prompt: w[2], promptVi: true,
      check: u => variants(w[0]).some(v => norm(v) === norm(u)) ? 'ok' : variants(w[0]).some(v => tight(v) === tight(u)) ? 'space' : 'no', answer: w[0] };
    if (mode === 'kv') return { w, kind: 'choice', ask: 'Từ này nghĩa là gì?', prompt: w[0], say: true, options: shuffle([w, ...others(w)]).map(x => x[2]), answer: w[2] };
    if (mode === 'vk') return { w, kind: 'choice', ask: 'Chọn từ tiếng Anh đúng', prompt: w[2], promptVi: true, krOpts: true, options: shuffle([w, ...others(w)]).map(x => x[0]), answer: w[0] };
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
        ${q.prompt ? `<div class="prompt ${q.promptVi ? 'vi' : ''} ${q.sentence ? 'sent' : ''}" ${q.promptVi ? '' : 'lang="en"'}>${q.html || esc(q.prompt)}${q.say ? soundBtn(q.prompt) : ''}</div>` : ''}
      </div>
      <div id="zone"></div><div id="fb"></div>`;
    pane.querySelector('#quit').onclick = () => cfg.onBack();
    if (q.listen) { pane.querySelector('#play').onclick = () => speak(q.answer); setTimeout(() => speak(q.answer), 250); }
    const zone = pane.querySelector('#zone');
    if (q.kind === 'choice') {
      zone.innerHTML = `<div class="opts">${q.options.map(o => `<button class="opt ${q.krOpts ? 'kr' : ''}" ${q.krOpts ? 'lang="en"' : ''}>${esc(o)}</button>`).join('')}</div>`;
      zone.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = b.textContent === q.answer;
        zone.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === q.answer) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        settle(ok ? 'ok' : 'no', b.textContent);
      });
    } else if (q.kind === 'input' || q.kind === 'vi') {
      const vi = q.kind === 'vi' || q.viInput;
      zone.innerHTML = `<form id="f"><${vi || q.long ? 'textarea' : 'input'} class="answer-input ${vi ? 'vi-in' : ''}" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" ${vi ? '' : 'lang="en"'} placeholder="${vi ? 'Gõ câu tiếng Việt…' : 'Gõ tiếng Anh…'}"></${vi || q.long ? 'textarea' : 'input'}>
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
        rec.lang = 'en-US'; rec.maxAlternatives = 5; rec.interimResults = false;
        mic.classList.add('live'); mic.disabled = true; heard.textContent = 'Đang nghe…';
        rec.onresult = e => {
          const alts = [...e.results[0]].map(a => a.transcript);
          const score = Math.max(...alts.map(a => similar(a, q.answer)));
          const said = alts[0];
          if (score >= 0.8) { zone.querySelectorAll('button').forEach(b => b.disabled = true); settle('ok', said); }
          else { tries++; heard.innerHTML = `Web nghe được: <span lang="en" class="kr">${esc(said)}</span> (${Math.round(score * 100)}% giống). ${tries < 3 ? 'Thử lại nhé!' : ''}`;
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
        zone.querySelector('#built').innerHTML = built.map((x, j) => `<button class="chip" data-j="${j}" lang="en">${esc(x.t)}</button>`).join('');
        zone.querySelector('#pool').innerHTML = toks.map(x => `<button class="chip ${built.includes(x) ? 'used' : ''}" data-k="${x.k}" lang="en" ${built.includes(x) ? 'disabled' : ''}>${esc(x.t)}</button>`).join('');
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
    const ansHtml = `<span class="k" lang="en">${esc(q.answerShow || q.answer)}</span>`;
    const head = { ok: 'Chính xác!', space: 'Đúng rồi, chỉ lệch khoảng trắng', no: 'Chưa đúng', rev: 'Đã ghi lại — Claude sẽ chấm câu này' }[res];
    const extra = q.w && q.w[3] ? `<div style="margin-top:6px"><span class="k" lang="en">${esc(q.w[3])}</span><br><span class="muted">${esc(q.w[4])}</span></div>` : '';
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
    const msg = pct === 100 ? 'Perfect! Hoàn hảo! 🐷' : pct >= 80 ? 'Well done! Giỏi lắm!' : pct >= 50 ? 'Good job! Thêm chút nữa nhé' : 'Keep going! Làm lại là nhớ thôi';
    pane.innerHTML = `
      <div class="qcard result-big"><div class="ask">${esc(cfg.title)}</div>
        <div class="score">${score}<small>/${graded}</small></div><p class="cheer" lang="en">${msg}</p>
        ${revs.length ? `<p class="small muted">+ ${revs.length} câu dịch chờ Claude chấm</p>` : ''}</div>
      ${wrongs.length ? `<h2>Câu chưa đúng</h2><ul class="miss">${wrongs.map(x => `<li><span class="k" lang="en">${esc(x.q.answerShow || x.q.answer)}</span> ${x.q.w ? '— ' + esc(x.q.w[2]) : '— ' + esc(x.q.prompt || x.q.ask)}<br><span class="you">Bạn: ${esc(x.user)}</span></li>`).join('')}</ul>` : ''}
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
      <p class="muted small">Chạm một từ tiếng Anh rồi chạm nghĩa của nó.</p>
      <div class="match">${left.map((w, k) => `<button class="k" lang="en" data-side="k" data-id="${esc(w[0])}" style="grid-column:1;grid-row:${k + 1}">${esc(w[0])}</button>`).join('')}
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
      <p class="cheer" lang="en">${mistakes ? 'Nice! Nhầm ' + mistakes + ' lần thôi' : 'Perfect! Không nhầm lần nào'}</p></div>
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
  pane.innerHTML = `${L.patterns.map(p => `<article class="pattern"><h3 lang="en">${esc(p.form)}</h3><p>${esc(p.meaning)}</p>
      <ul>${p.examples.map(e => { const [k, v] = e.split(' — '); return `<li>${soundBtn(k)}<span class="ex"><span class="k" lang="en">${esc(k)}</span><span class="v">${esc(v || '')}</span></span></li>`; }).join('')}</ul></article>`).join('')}
    <button class="btn block" id="start">Làm ${L.exercises.length} bài tập ngữ pháp${b !== null ? ` · tốt nhất ${b}%` : ''}</button>`;
  pane.querySelector('#start').onclick = () => startGrammar(pane, L);
}
function grammarQuestions(L, list) {
  return list.map(e => {
    e = e.en !== undefined && e.kr === undefined ? { ...e, kr: e.en } : e;
    const kr = e.kr && e.kr !== '___' ? e.kr : '';
    const html = kr ? esc(kr).replace(/_{2,}/g, '<span class="blank">　</span>') : '';
    const base = { ex: e, explain: e.explain, ask: e.q, prompt: kr, html, sentence: true };
    if (e.type === 'read') return { ...base, kind: 'choice', html: '<span class="passage">' + esc(e.kr).replace(/\( ?_{2,} ?\)/g, '( <span class="blank">　</span> )') + '</span>', krOpts: false, options: shuffle(e.options), answer: e.answer };
    if (e.type === 'choice') return { ...base, kind: 'choice', krOpts: false, options: shuffle(e.options), answer: e.answer };
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

/* ---------- viết bài (VSTEP Writing) ---------- */
const wordCount = s => (String(s).match(/[A-Za-z0-9'’-]+/g) || []).length;
function timerBox(host, minutes, label) {
  let left = minutes * 60, t = null;
  host.innerHTML = `<div class="timer"><span class="t-label">${esc(label)}</span><b class="t-left">${pad(minutes)}:00</b><button class="btn line small-btn" type="button">Bắt đầu</button></div>`;
  const b = host.querySelector('button'), out = host.querySelector('.t-left');
  const draw = () => { out.textContent = `${pad(Math.floor(Math.max(0, left) / 60))}:${pad(Math.max(0, left) % 60)}`; host.firstChild.classList.toggle('over', left <= 0); };
  b.onclick = () => {
    if (t) { clearInterval(t); t = null; b.textContent = 'Tiếp tục'; return; }
    b.textContent = 'Tạm dừng';
    t = setInterval(() => { left--; draw(); if (left === 0) toast('Hết giờ rồi! Viết nốt câu cuối nhé'); if (!document.body.contains(host)) clearInterval(t); }, 1000);
  };
  return { used: () => minutes * 60 - left };
}
function paneWriting(pane, L) {
  const W = L.writing; if (!W) { pane.innerHTML = '<p class="empty">Bài này chưa có đề viết.</p>'; return; }
  const key = 'wdraft.' + L.id; const draft = store.get(key, '');
  const saved = results().find(r => r.day === dayKey() && r.lessonId === L.id && r.mode === 'writing');
  pane.innerHTML = `
    <article class="pattern task"><div class="task-tag">VSTEP Writing · Task ${esc(W.task)} · ${W.task == 1 ? 'Thư / email' : 'Bài luận'}</div>
      <h3>${esc(W.title)}</h3>
      <p class="prompt-en" lang="en">${esc(W.prompt).replace(/\n/g, '<br>')}</p>
      <p class="small muted">Yêu cầu: ít nhất <b>${W.words}</b> từ · khoảng <b>${W.minutes}</b> phút${W.task == 1 ? ' · chiếm 1/3 điểm Viết' : ' · chiếm 2/3 điểm Viết'}</p></article>
    ${W.outline ? `<details class="hint-box"><summary>🧭 Dàn ý gợi ý</summary><ol>${W.outline.map(o => `<li>${esc(o)}</li>`).join('')}</ol></details>` : ''}
    ${W.phrases ? `<details class="hint-box"><summary>✨ Cụm từ nên dùng</summary><ul class="ex-list">${W.phrases.map(p => { const [k, v] = p.split(' — '); return `<li><span><span lang="en" class="kr">${esc(k)}</span>${v ? `<br><span class="muted small">${esc(v)}</span>` : ''}</span>${soundBtn(k)}</li>`; }).join('')}</ul></details>` : ''}
    <div id="tm"></div>
    <textarea class="answer-input essay" id="essay" lang="en" spellcheck="false" placeholder="Start writing here…">${esc(saved ? saved.text : draft)}</textarea>
    <div class="wc"><span id="wc">0 từ</span><span class="muted small" id="wcNeed"></span></div>
    <button class="btn block" id="save">${saved ? 'Cập nhật bài viết hôm nay' : 'Nộp bài viết'}</button>
    ${saved ? `<p class="small muted" style="margin-top:10px">Đã lưu lúc ${fmtTime(saved.at)}. Vào <a href="#/nop-bai">Nộp bài</a> để copy gửi Claude chấm theo tiêu chí VSTEP.</p>` : '<p class="small muted" style="margin-top:10px">Claude sẽ chấm theo 4 tiêu chí VSTEP: hoàn thành nhiệm vụ, tổ chức bài, từ vựng, ngữ pháp.</p>'}`;
  const tm = timerBox(pane.querySelector('#tm'), W.minutes, 'Đồng hồ viết');
  const ta = pane.querySelector('#essay'), wc = pane.querySelector('#wc'), need = pane.querySelector('#wcNeed');
  const upd = () => { const n = wordCount(ta.value); wc.textContent = n + ' từ'; wc.classList.toggle('ok', n >= W.words); need.textContent = n >= W.words ? 'Đủ số từ ✓' : `còn ${W.words - n} từ nữa`; };
  ta.addEventListener('input', () => { store.set(key, ta.value); upd(); }); upd();
  pane.querySelector('#save').onclick = () => {
    const text = ta.value.trim(); const n = wordCount(text);
    if (n < 40) { toast('Viết thêm chút nữa rồi nộp nhé'); return; }
    store.set('results', results().filter(r => !(r.day === dayKey() && r.lessonId === L.id && r.mode === 'writing')));
    addResult({ lessonId: L.id, lesson: L.lesson, mode: 'writing', label: `Writing Task ${W.task}`, task: W.task, prompt: W.prompt, text, words: n, need: W.words, seconds: tm.used() });
    markStudied(); toast('Đã lưu bài viết 🐷'); paneWriting(pane, L);
  };
}

/* ---------- luyện nói (VSTEP Speaking) ---------- */
function paneSpeaking(pane, L) {
  const S = L.speaking; if (!S) { pane.innerHTML = '<p class="empty">Bài này chưa có đề nói.</p>'; return; }
  const key = 'sdraft.' + L.id; let text = store.get(key, '');
  const saved = results().find(r => r.day === dayKey() && r.lessonId === L.id && r.mode === 'speaking');
  if (saved && !text) text = saved.text;
  pane.innerHTML = `
    <article class="pattern task"><div class="task-tag">VSTEP Speaking · Part ${esc(S.part)} · ${{ 1: 'Tương tác xã hội', 2: 'Thảo luận giải pháp', 3: 'Phát triển chủ đề' }[S.part] || ''}</div>
      <h3>${esc(S.title)}</h3>
      <p class="prompt-en" lang="en">${esc(S.prompt).replace(/\n/g, '<br>')}</p>
      ${S.questions ? `<ul class="ex-list">${S.questions.map(q => `<li><span lang="en">${esc(q)}</span>${soundBtn(q, 'Nghe câu hỏi')}</li>`).join('')}</ul>` : ''}
      ${S.prep ? `<p class="small muted">Chuẩn bị ${S.prep} phút · nói khoảng ${S.minutes} phút</p>` : `<p class="small muted">Nói khoảng ${S.minutes} phút</p>`}</article>
    ${S.ideas ? `<details class="hint-box"><summary>💡 Ý tưởng & cụm từ</summary><ul class="ex-list">${S.ideas.map(p => `<li><span lang="en">${esc(p)}</span>${soundBtn(p)}</li>`).join('')}</ul></details>` : ''}
    <div id="tm"></div>
    ${SR ? `<button class="btn block mic" id="mic">${MIC} Bấm để nói (web ghi lại lời bạn)</button>
      <p class="small muted" id="st" style="margin:8px 0">Nói liền một mạch như đi thi. Bấm lại để dừng. Bạn có thể sửa chữ web nghe nhầm ở ô dưới.</p>`
      : '<p class="note">Trình duyệt này chưa nghe được giọng nói. Hãy tự nói to theo đồng hồ, rồi ghi tóm tắt ý chính vào ô dưới (hoặc mở bằng Chrome/Safari).</p>'}
    <textarea class="answer-input essay" id="tr" lang="en" rows="7" placeholder="Lời bạn nói sẽ hiện ở đây…">${esc(text)}</textarea>
    <div class="wc"><span id="wc">0 từ</span></div>
    <button class="btn block" id="save">${saved ? 'Cập nhật bài nói hôm nay' : 'Nộp bài nói'}</button>`;
  const tm = timerBox(pane.querySelector('#tm'), S.minutes, 'Đồng hồ nói');
  const ta = pane.querySelector('#tr'), wc = pane.querySelector('#wc');
  const upd = () => { wc.textContent = wordCount(ta.value) + ' từ'; };
  ta.addEventListener('input', () => { store.set(key, ta.value); upd(); }); upd();
  const mic = pane.querySelector('#mic');
  if (mic) {
    let rec = null, base = '';
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      try { rec = new SR(); } catch { toast('Không mở được micro'); return; }
      rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
      base = ta.value.trim() ? ta.value.trim() + ' ' : '';
      mic.classList.add('live'); mic.innerHTML = `${MIC} Đang nghe… bấm để dừng`;
      rec.onresult = e => {
        let fin = '', tmp = '';
        for (let k = 0; k < e.results.length; k++) (e.results[k].isFinal ? (fin += e.results[k][0].transcript + ' ') : (tmp += e.results[k][0].transcript));
        ta.value = (base + fin + tmp).replace(/\s+/g, ' '); store.set(key, ta.value); upd();
      };
      rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Bạn cần cho phép web dùng micro'); };
      rec.onend = () => { rec = null; mic.classList.remove('live'); mic.innerHTML = `${MIC} Bấm để nói tiếp`; };
      try { speechSynthesis.cancel(); rec.start(); } catch { rec = null; }
    };
  }
  pane.querySelector('#save').onclick = () => {
    const t = ta.value.trim(); if (wordCount(t) < 15) { toast('Nói (hoặc ghi) thêm chút nữa nhé'); return; }
    store.set('results', results().filter(r => !(r.day === dayKey() && r.lessonId === L.id && r.mode === 'speaking')));
    addResult({ lessonId: L.id, lesson: L.lesson, mode: 'speaking', label: `Speaking Part ${S.part}`, part: S.part, prompt: S.prompt + (S.questions ? ' | ' + S.questions.join(' | ') : ''), text: t, words: wordCount(t), seconds: tm.used() });
    markStudied(); toast('Đã lưu bài nói 🐷'); paneSpeaking(pane, L);
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
      <div class="modes"><button class="mode" data-d="kv"><b>Ôn bằng trắc nghiệm</b><span>Anh → Việt</span></button>
      <button class="mode" data-d="viet"><b>Ôn bằng viết</b><span>Gõ từ tiếng Anh</span></button></div>`
      : `<p class="small muted">Hôm nay chưa có từ nào đến hạn. ${fresh ? `Còn ${fresh} từ bạn chưa luyện lần nào, làm thử Ôn tổng hợp bên dưới nhé.` : 'Tuyệt vời!'}</p>`}
    <h2>Từ hay sai</h2>
    ${wrongWords.length ? `<p class="small muted">${wrongWords.length} từ. Làm đúng 2 lần liên tiếp thì từ sẽ tự rời danh sách.</p>
      <div class="modes"><button class="mode" data-w="viet"><b>Viết lại từ sai</b><span>Gõ từ tiếng Anh</span></button>
      <button class="mode" data-w="kv"><b>Trắc nghiệm từ sai</b><span>Anh → Việt</span></button>
      <button class="mode" data-w="the"><b>Flashcard từ sai</b><span>Lướt nhanh</span></button>
      <button class="mode" data-w="nghe"><b>Nghe từ sai</b><span>Nghe chọn từ</span></button></div>
      <ul class="words" style="margin-top:14px">${wrongWords.slice(0, 30).map(w => `<li>${soundBtn(w[0])}<div class="w"><span class="k" lang="en">${esc(w[0])}</span><span class="r">${esc(w._lesson)}</span></div><span class="v">${esc(w[2])}</span></li>`).join('')}</ul>`
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

/* ---------- sổ tay VSTEP ---------- */
const EXAM = [
  ['🎧 Nghe', '~40 phút', '35 câu, 3 phần: thông báo/hướng dẫn (8) · 3 hội thoại (12) · 3 bài giảng (15). Chỉ nghe 1 lần.'],
  ['📖 Đọc', '60 phút', '40 câu, 4 bài đọc (độ khó tăng dần từ B1 đến C1).'],
  ['✍️ Viết', '60 phút', 'Task 1: thư/email ≥ 120 từ (~20 phút, 1/3 điểm). Task 2: bài luận ≥ 250 từ (~40 phút, 2/3 điểm).'],
  ['🗣️ Nói', '~12 phút', 'Part 1: tương tác xã hội (2 chủ đề) · Part 2: chọn giải pháp và giải thích · Part 3: phát triển chủ đề theo sơ đồ ý, có câu hỏi thêm.'],
];
const LINKERS = [
  ['Thêm ý', ['Furthermore,', 'In addition,', 'Moreover,', 'Not only … but also …']],
  ['Đối lập', ['However,', 'Nevertheless,', 'On the other hand,', 'Although / Even though …', 'Whereas …']],
  ['Nguyên nhân – kết quả', ['As a result,', 'Consequently,', 'Therefore,', 'This leads to …', 'Owing to / Due to …']],
  ['Ví dụ', ['For instance,', 'For example,', 'A case in point is …', 'such as …']],
  ['Nêu ý kiến', ['In my opinion,', 'From my perspective,', 'I strongly believe that …', 'It seems to me that …']],
  ['Kết luận', ['In conclusion,', 'To sum up,', 'All things considered,', 'On balance,']],
];
const LETTER = [
  ['Mở thư', 'Dear Mr Smith, / Dear Linh,', 'Thư trang trọng dùng Mr/Ms + họ; thư thân mật dùng tên.'],
  ['Lý do viết', 'I am writing to complain about / enquire about / apply for …', 'Câu đầu tiên nói ngay mục đích.'],
  ['Thân thư', 'Firstly, … In addition, … Finally, …', 'Trả lời ĐỦ mọi ý đề yêu cầu, mỗi ý một đoạn ngắn.'],
  ['Đề nghị', 'I would be grateful if you could … / I would appreciate it if …', 'Nêu điều bạn muốn người nhận làm.'],
  ['Kết thư', 'I look forward to hearing from you.', 'Câu chốt quen thuộc, luôn ăn điểm.'],
  ['Ký tên', 'Yours sincerely, (biết tên) · Yours faithfully, (Dear Sir/Madam) · Best wishes, (thân mật)', 'Đề thường yêu cầu không ghi tên thật.'],
];
const ESSAY = [
  ['Mở bài (2–3 câu)', 'Paraphrase đề + nêu rõ quan điểm / nội dung sẽ bàn.'],
  ['Thân bài 1 (5–7 câu)', 'Câu chủ đề → giải thích → ví dụ cụ thể → câu chốt.'],
  ['Thân bài 2 (5–7 câu)', 'Ý thứ hai hoặc mặt còn lại, cùng cấu trúc.'],
  ['Kết bài (2–3 câu)', 'Tóm lại ý chính + nhắc lại quan điểm, không thêm ý mới.'],
];
const SPEAK = [
  ['Part 1', 'Trả lời 3 câu hỏi cho mỗi chủ đề, mỗi câu 2–3 câu: trả lời thẳng → lý do → ví dụ nhỏ.'],
  ['Part 2', '1 phút chuẩn bị. Chọn 1 trong 3 giải pháp, nói vì sao chọn và vì sao không chọn 2 cái còn lại.'],
  ['Part 3', '1 phút chuẩn bị. Phát triển các ý trong sơ đồ + thêm 1 ý của bạn, rồi trả lời câu hỏi mở rộng.'],
];
function renderNotes() {
  $app.innerHTML = `<h1>Sổ tay VSTEP</h1><p class="muted">Những thứ hay phải tra lại khi ôn VSTEP B2, gom về một chỗ.</p>
    <h2>Cấu trúc đề VSTEP.3-5</h2>
    <ul class="words">${EXAM.map(([k, t, d]) => `<li><div class="w"><div class="wtop"><span class="k">${k}</span><span class="v">${t}</span></div><span class="r">${d}</span></div></li>`).join('')}</ul>
    <h2>Quy đổi điểm</h2>
    <div class="band"><div><b>4.0 – 5.5</b><span>B1 · Bậc 3</span></div><div class="b2"><b>6.0 – 8.0</b><span>B2 · Bậc 4 🐷</span></div><div><b>8.5 – 10</b><span>C1 · Bậc 5</span></div></div>
    <p class="small muted">Mỗi kỹ năng chấm thang 10, làm tròn đến 0,5. Điểm chung là trung bình 4 kỹ năng. Dưới 4.0 thì không xét bậc.</p>
    <h2>Tính nhanh điểm trung bình</h2>
    <div class="calc">${['Nghe', 'Đọc', 'Viết', 'Nói'].map((s, k) => `<label><span>${s}</span><input class="answer-input vi-in" type="number" min="0" max="10" step="0.5" data-sk="${k}" value="${store.get('sk' + k, '')}"></label>`).join('')}</div>
    <div id="calcOut" class="num-out"></div>
    <h2>Khung viết thư (Task 1)</h2>
    <ul class="words">${LETTER.map(([t, e, n]) => `<li>${soundBtn(e.split(' / ')[0].split(' (')[0])}<div class="w"><div class="wtop"><span class="v" style="max-width:none">${t}</span></div><span class="k" lang="en" style="font-size:16px">${esc(e)}</span><span class="r">${esc(n)}</span></div></li>`).join('')}</ul>
    <h2>Khung bài luận (Task 2)</h2>
    <ul class="words">${ESSAY.map(([t, n]) => `<li><div class="w"><span class="k" style="font-size:16px">${t}</span><span class="r">${n}</span></div></li>`).join('')}</ul>
    <p class="small muted">Dạng đề hay gặp: Agree/Disagree · Discuss both views · Advantages & Disadvantages · Causes/Problems & Solutions.</p>
    <h2>Từ nối ăn điểm</h2>
    ${LINKERS.map(([t, ws]) => `<h3 style="margin:14px 0 6px">${t}</h3><div class="chips">${ws.map(w => `<button class="chip" lang="en" data-say="${esc(w)}">${esc(w)}</button>`).join('')}</div>`).join('')}
    <h2>Chiến thuật Nói</h2>
    <ul class="words">${SPEAK.map(([t, n]) => `<li><div class="w"><span class="k" style="font-size:16px">${t}</span><span class="r">${n}</span></div></li>`).join('')}</ul>
    <h2>Mẹo nhỏ</h2>
    <ul class="tips">
      <li><b>Nghe:</b> đọc câu hỏi trước khi băng chạy, gạch từ khóa; đáp án thường bị paraphrase chứ không lặp nguyên văn.</li>
      <li><b>Đọc:</b> làm câu hỏi chi tiết trước, câu hỏi ý chính và từ vựng trong ngữ cảnh để sau; không dừng quá lâu ở một câu.</li>
      <li><b>Viết:</b> chia giờ 20 phút Task 1, 40 phút Task 2; chừa 3 phút soát lỗi chia động từ, số ít/số nhiều, mạo từ.</li>
      <li><b>Nói:</b> đừng học thuộc cả bài; học cụm mở đầu và cụm nối, nói chậm rõ còn hơn nói nhanh vấp.</li>
    </ul>`;
  const ins = [...document.querySelectorAll('[data-sk]')], out = document.getElementById('calcOut');
  const calc = () => {
    const v = ins.map(i => i.value === '' ? null : Math.max(0, Math.min(10, +i.value)));
    ins.forEach((i, k) => store.set('sk' + k, i.value));
    if (v.some(x => x === null)) { out.innerHTML = '<span class="small muted">Nhập đủ 4 kỹ năng để xem bậc.</span>'; return; }
    const avg = Math.round(2 * v.reduce((a, b) => a + b, 0) / 4) / 2;
    const lv = avg >= 8.5 ? 'C1' : avg >= 6 ? 'B2 🎉' : avg >= 4 ? 'B1' : 'chưa đạt bậc';
    out.innerHTML = `${avg.toFixed(1)} <span class="small" style="font-weight:600">→ ${lv}</span>`;
  };
  ins.forEach(i => i.addEventListener('input', calc)); calc();
}

/* ---------- nộp bài ---------- */
function buildReport(day, list) {
  const L = [`📚 KẾT QUẢ HỌC VSTEP B2 — ${fmtDate(day)}`, ''];
  list.forEach(r => {
    if (r.mode === 'nhat-ky') {
      L.push(`📔 Nhật ký (đề: ${r.prompt})`);
      r.sentences.forEach((s, k) => L.push(`  ${k + 1}. ${s}`));
    } else if (r.mode === 'writing') {
      L.push(`✍️ [${r.lesson}] ${r.label} — ${r.words} từ (yêu cầu ≥ ${r.need})${r.seconds ? ', viết trong ' + Math.round(r.seconds / 60) + ' phút' : ''}`);
      L.push(`   Đề: ${r.prompt.replace(/\n/g, ' ')}`);
      L.push('   ---', ...r.text.split(/\n+/).map(p => '   ' + p), '   ---');
    } else if (r.mode === 'speaking') {
      L.push(`🗣️ [${r.lesson}] ${r.label} — ${r.words} từ (bản ghi lời nói)`);
      L.push(`   Đề: ${r.prompt.replace(/\n/g, ' ')}`);
      L.push(`   Bài nói: ${r.text}`);
    } else {
      L.push(`• [${r.lesson}] ${r.label}: ${r.correct}/${r.total} (${r.total ? Math.round(100 * r.correct / r.total) : 0}%) — lúc ${fmtTime(r.at)}`);
      (r.wrong || []).forEach(w => L.push(w.q ? `   ✗ ${w.q}${w.kr ? ' | ' + w.kr : ''} → bạn: ${w.user} | đáp án: ${w.answer}` : `   ✗ ${w.kr} (${w.vi}) → bạn: ${w.user}`));
      (r.review || []).forEach(w => L.push(`   ? ${w.q}${w.kr ? ' | ' + w.kr : ''} → bạn: ${w.user} | mẫu: ${w.answer}`));
    }
    L.push('');
  });
  L.push('Nhờ Claude chấm và nhận xét giúp mình nhé! (✗ = sai, ? = câu dịch cần Claude chấm, ✍️/🗣️ = chấm theo tiêu chí VSTEP)');
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
        <span class="s">${r.sentences ? r.sentences.length + ' câu' : r.text ? r.words + ' từ' : `${r.correct}/${r.total}`}</span></div>
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
