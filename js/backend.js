import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, getFirestore, collection, getDocs, getDoc, doc, addDoc, setDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = { apiKey: 'AIzaSyDexCS7t0BYdfqNniC9lFyffPm1tO7mjvQ', authDomain: 'website-sekoalah.firebaseapp.com', projectId: 'website-sekoalah', storageBucket: 'website-sekoalah.firebasestorage.app', messagingSenderId: '1093168697523', appId: '1:1093168697523:web:58cf059e271595850560c6' };
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true, useFetchStreams: false });
setPersistence(auth, browserLocalPersistence);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date();
const dateValue = value => value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null;
const isoInput = value => { const date = dateValue(value); return date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''; };
const displayDate = value => { const date = dateValue(value); return date ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date) : '-'; };
const displayTime = value => { const date = dateValue(value); return date ? new Intl.DateTimeFormat('id-ID', { timeStyle: 'medium', hour12: false }).format(date) : '-'; };
const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
const money = value => new Intl.NumberFormat('id-ID').format(Number(value || 0));
const optionPoints = option => Math.max(0, Number(option?.points ?? option?.point ?? option?.score ?? 0) || 0);
const normalizedOptionPoints = (option, correct) => correct && optionPoints(option) === 0 ? 10 : optionPoints(option);
const isCorrectOption = option => option?.isCorrect === true || option?.correct === true;
const questionMaxPoints = question => { const options = question.options || []; if (question.type === 'allCorrect') return options.filter(isCorrectOption).reduce((sum, option) => sum + normalizedOptionPoints(option, true), 0); return Math.max(0, ...options.filter(isCorrectOption).map(option => normalizedOptionPoints(option, true))); };
const toast = message => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
const state = { user: null, isAdmin: false, quizzes: [], questions: [], submissions: [], currentQuiz: null, search: '' };

const savedTheme = localStorage.getItem('kelaskita-theme');
if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';

const submissionTableObserver = new MutationObserver(() => {
  state.submissions.sort((a, b) => (dateValue(b.submittedAt)?.getTime() || 0) - (dateValue(a.submittedAt)?.getTime() || 0));
  const table = $('.table');
  if (!table || !$('tbody', table)) return;
  const body = $('tbody', table);
  state.submissions.forEach(item => {
    const row = [...body.children].find(candidate => candidate.children[0]?.textContent === String(item.studentName || '') && candidate.children[3]?.textContent === String(item.quizTitle || ''));
    if (row) body.append(row);
  });
  const header = $('thead tr', table);
  if (header && !header.querySelector('[data-submission-date]')) {
    const dateHeader = document.createElement('th');
    dateHeader.dataset.submissionDate = 'true';
    dateHeader.textContent = 'Tanggal masuk';
    const timeHeader = document.createElement('th');
    timeHeader.dataset.submissionDate = 'true';
    timeHeader.textContent = 'Jam masuk';
    header.children[4]?.before(dateHeader, timeHeader);
  }
  $$('tbody tr', table).forEach(row => {
    if (row.querySelector('[data-submission-date]')) return;
    const item = state.submissions.find(submission =>
      String(submission.studentName || '') === row.children[0]?.textContent
      && String(submission.quizTitle || '') === row.children[3]?.textContent
    );
    if (!item) return;
    const dateCell = document.createElement('td');
    dateCell.dataset.submissionDate = 'true';
    dateCell.textContent = displayDate(item.submittedAt);
    const timeCell = document.createElement('td');
    timeCell.dataset.submissionDate = 'true';
    timeCell.textContent = displayTime(item.submittedAt);
    row.children[4]?.before(dateCell, timeCell);
  });
});
submissionTableObserver.observe($('#app'), { childList: true, subtree: true });

if ($('#themeToggle')) {
  $('#themeToggle').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('kelaskita-theme', dark ? 'dark' : 'light'); $('#themeToggle').textContent = dark ? '☀' : '☼'; };
  $('#themeToggle').textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☼';
}
if ($('#mobileMenu')) {
  $('#mobileMenu').onclick = () => { $('nav').classList.toggle('menu-open'); $('#mobileMenu').textContent = $('nav').classList.contains('menu-open') ? '×' : '☰'; };
  $$('nav button').forEach(button => button.addEventListener('click', () => { $('nav').classList.remove('menu-open'); $('#mobileMenu').textContent = '☰'; }));
}

$$('[data-close-dialog]').forEach(button => button.onclick = () => {
  const dialog = document.getElementById(button.dataset.closeDialog);
  if (dialog?.open) dialog.close();
});

function loading(message = 'Mencari data...') {
  $('#app').innerHTML = `<section class="card loading-screen"><div class="loading-spinner"></div><h2>${esc(message)}</h2><p>Memeriksa koneksi database...</p></section>`;
}

function withTimeout(promise, milliseconds = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Koneksi Firebase timeout setelah 12 detik.')), milliseconds))
  ]);
}

async function firestoreRequest(operation, retries = 2) {
  try {
    return await withTimeout(operation());
  } catch (error) {
    const internal = String(error?.message || '').includes('INTERNAL ASSERTION') || error?.code === 'internal';
    if (internal && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 700));
      return firestoreRequest(operation, retries - 1);
    }
    throw error;
  }
}

function errorMessage(error) {
  if (error?.code === 'permission-denied') return 'Akses ditolak. Pastikan users/{UID} memiliki role admin dan active true.';
  if (error?.code === 'auth/invalid-credential') return 'Email atau password salah.';
  return error?.message || 'Terjadi kesalahan.';
}

async function verifyAdmin(user) {
  if (!user) return false;
  const profile = await getDoc(doc(db, 'users', user.uid));
  const data = profile.data() || {};
  state.adminProfile = { exists: profile.exists(), data };
  return profile.exists() && data.role === 'admin' && (data.active === true || data.isActive === true);
}

let publicQuizUnsubscribe = null;
function loadPublicQuizzes() {
  loading('Memuat kuis publik...');
  publicQuizUnsubscribe?.();
  publicQuizUnsubscribe = onSnapshot(query(collection(db, 'quizzes'), where('published', '==', true)), snapshot => {
    state.quizzes = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.published === true || item.status === 'published');
    renderHome();
  }, error => showError('Data kuis belum bisa dibaca', errorMessage(error)));
}

function quizStatus(quiz) {
  const open = dateValue(quiz.openAt)?.getTime() || 0;
  const close = dateValue(quiz.closeAt)?.getTime() || Infinity;
  if (Date.now() < open) return ['Belum dibuka', false];
  if (Date.now() > close) return ['Sudah ditutup', false];
  return ['Sedang dibuka', true];
}

function renderHome() {
  $('#app').innerHTML = `<section class="hero"><div><span class="eyebrow">PORTAL KUIS SEKOLAH</span><h1>Belajar. Jawab.<br><em>Melangkah lebih jauh.</em></h1><p>Pilih kuis sesuai kelas dan mata pelajaran. Kerjakan dengan jujur, hasilmu tersimpan aman untuk guru.</p></div><div class="hero-note"><span class="eyebrow">TOTAL KUIS AKTIF</span><strong>${state.quizzes.length}</strong><span>kuis tersedia sekarang</span></div></section><div class="toolbar"><input class="search" id="quizSearch" placeholder="Cari judul kuis..."><div class="filters"><button class="filter active" data-filter="all">Semua</button><button class="filter" data-filter="open">Sedang dibuka</button><button class="filter" data-filter="closed">Ditutup</button></div></div><section class="grid" id="quizGrid"></section>`;
  const draw = () => { const filter = $('.filter.active')?.dataset.filter || 'all'; const text = $('#quizSearch').value.toLowerCase(); const list = state.quizzes.filter(q => q.title?.toLowerCase().includes(text)).filter(q => filter === 'all' || (filter === 'open' ? quizStatus(q)[1] : !quizStatus(q)[1])); $('#quizGrid').innerHTML = list.length ? list.map(publicQuizCard).join('') : '<div class="empty">Belum ada kuis sesuai pencarian.</div>'; $$('#quizGrid [data-start]').forEach(button => button.onclick = () => startIdentity(button.dataset.start)); };
   draw();
  clearTimeout(window.quizStatusRefresh);
  const refreshStatus = () => { if ($('#quizGrid')) { draw(); window.quizStatusRefresh = setTimeout(refreshStatus, 1000); } };
  window.quizStatusRefresh = setTimeout(refreshStatus, 1000);
  $('#quizSearch').oninput = draw;
  $$('.filter').forEach(button => button.onclick = () => { $$('.filter').forEach(item => item.classList.remove('active')); button.classList.add('active'); draw(); });
}

function publicQuizCard(quiz) { const [status, open] = quizStatus(quiz); const duration = quiz.duration ? `${quiz.duration} menit` : 'Tanpa batas waktu'; return `<article class="card quiz-card"><span class="status ${open ? 'status-open' : ''}">${status.toUpperCase()}</span><h3>${esc(quiz.title)}</h3><p>${esc(quiz.description || 'Kuis untuk menguji pemahaman kamu.')}</p><div class="meta"><span class="tag">${esc(quiz.subject || 'Umum')}</span><span>${esc(quiz.targetClass || 'Semua kelas')}</span><span>${quiz.totalQuestions || 0} soal</span><span>${duration}</span></div><button class="button ${open ? 'primary' : 'secondary'} full" ${open ? '' : 'disabled'} data-start="${quiz.id}">${open ? 'Mulai kuis' : status}</button></article>`; }

function showError(title, message) { $('#app').innerHTML = `<section class="card error-state"><span class="eyebrow">FIREBASE</span><h2>${esc(title)}</h2><pre>${esc(message)}</pre></section>`; }
function startIdentity(id) { const dialog = $('#identityDialog'); dialog.dataset.quiz = id; dialog.showModal(); }

$('#identityForm').onsubmit = async event => { event.preventDefault(); const name = clean($('#studentName').value).toUpperCase(); const studentClass = clean($('#studentClass').value).toUpperCase(); if (name.length < 2 || !studentClass) return; $('#identityDialog').close(); await beginQuiz($('#identityDialog').dataset.quiz, name, studentClass); };

async function beginQuiz(id, name, studentClass) { const quiz = state.quizzes.find(item => item.id === id); const snapshot = await getDocs(collection(db, `quizzes/${id}/questions`)); state.questions = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); if (quiz.shuffleQuestions) state.questions.sort(() => Math.random() - .5); state.currentQuiz = { quiz, name, studentClass, index: 0, answers: {}, startedAt: Date.now(), deadline: quiz.duration ? Date.now() + quiz.duration * 60000 : null }; renderQuestion(); }
function renderQuestion() { const attempt = state.currentQuiz; const item = state.questions[attempt.index]; if (!item) return submitQuiz(); $('#app').innerHTML = `<section class="quiz-shell"><div class="quiz-head"><div><span class="eyebrow">${esc(attempt.quiz.subject || 'KUIS')} · ${attempt.index + 1}/${state.questions.length}</span><h2>${esc(attempt.quiz.title)}</h2></div>${attempt.deadline ? '<div class="timer" id="timer"></div>' : ''}</div><div class="progress"><i style="width:${(attempt.index / state.questions.length) * 100}%"></i></div><article class="card"><h3>${esc(item.text)}</h3><div>${(item.options || []).map((option, index) => `<button class="option ${attempt.answers[item.id] === option.id ? 'selected' : ''}" data-option="${esc(option.id)}"><b>${String.fromCharCode(65 + index)}.</b>${esc(option.text)}</button>`).join('')}</div><div class="dialog-actions"><button class="button ghost" id="previous" ${attempt.index ? '' : 'disabled'}>Sebelumnya</button><button class="button primary" id="next">${attempt.index === state.questions.length - 1 ? 'Kirim jawaban' : 'Berikutnya'}</button></div></article></section>`; $$('[data-option]').forEach(button => button.onclick = () => { attempt.answers[item.id] = button.dataset.option; renderQuestion(); }); $('#previous').onclick = () => { attempt.index--; renderQuestion(); }; $('#next').onclick = () => { attempt.index++; renderQuestion(); }; if (attempt.deadline) timerTick(); }
function timerTick() { const timer = $('#timer'); if (!timer || !state.currentQuiz) return; const left = Math.max(0, state.currentQuiz.deadline - Date.now()); timer.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; if (left) setTimeout(timerTick, 1000); else submitQuiz(); }

async function submitQuiz() { const attempt = state.currentQuiz; if (!attempt) return; let score = 0; let maxScore = 0; let correct = 0; let wrong = 0; let unansweredCount = 0; state.questions.forEach(question => { const options = question.options || []; maxScore += questionMaxPoints(question); const answer = attempt.answers[question.id]; const correctIds = question.type === 'allCorrect' ? options.filter(isCorrectOption).map(option => option.id) : [options.find(isCorrectOption)?.id]; if (!answer) unansweredCount++; else if (correctIds.includes(answer)) { score += normalizedOptionPoints(options.find(option => option.id === answer), true); correct++; } else wrong++; }); await addDoc(collection(db, 'submissions'), { quizId: attempt.quiz.id, quizTitle: attempt.quiz.title, subject: attempt.quiz.subject || '', studentName: attempt.name, studentClass: attempt.studentClass, answers: attempt.answers, score, total: maxScore, totalScore: score, maxScore, percentage: maxScore ? Math.round(score / maxScore * 100) : 0, correct, correctCount: correct, wrong, wrongCount: wrong, unanswered: unansweredCount, unansweredCount, totalQuestions: state.questions.length, submittedAt: serverTimestamp() }); $('#app').innerHTML = `<section class="card result-card"><span class="eyebrow">JAWABAN TERKIRIM</span><h1>Terima kasih sudah mengerjakan!</h1><p>Jawaban ${esc(attempt.name)} sudah tersimpan.</p>${attempt.quiz.showScore !== false ? `<div class="hero-note"><strong>${score}/${maxScore}</strong><span>${maxScore ? Math.round(score / maxScore * 100) : 0}% · ${correct} benar</span></div>` : '<p>Nilai akan diumumkan oleh guru.</p>'}</section>`; state.currentQuiz = null; }

async function adminData() { const snapshot = await withTimeout(firestoreRequest(() => getDocs(collection(db, 'quizzes')))); state.quizzes = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); return state.quizzes; }
function adminShell(title, content) { $('#app').innerHTML = `<section class="admin-page"><div class="admin-head"><div><span class="eyebrow">AREA ADMIN · ${esc(state.user?.email || '')}</span><h1>${title}</h1></div><button class="button ghost" id="adminLogout">Keluar</button></div><div class="admin-nav"><button data-admin="dashboard">Dashboard</button><button data-admin="quizzes">Kuis</button><button data-admin="submissions">Hasil</button><button data-admin="subjects">Per Mata Pelajaran</button><button data-admin="settings">Pengaturan</button></div>${content}</section>`; $('#adminLogout').onclick = () => signOut(auth); $$('.admin-nav button').forEach(button => button.onclick = () => openAdmin(button.dataset.admin)); }

async function renderDashboard() { const quizzes = await adminData(); const submissions = (await getDocs(collection(db, 'submissions'))).docs.map(item => ({ id: item.id, ...item.data() })); const totalQuestions = quizzes.reduce((sum, quiz) => sum + Number(quiz.totalQuestions || 0), 0); const average = submissions.length ? Math.round(submissions.reduce((sum, item) => sum + Number(item.score || 0) / Math.max(Number(item.total || 1), 1) * 100, 0) / submissions.length) : 0; const subjects = [...new Set(quizzes.map(quiz => quiz.subject).filter(Boolean))]; adminShell('Dashboard', `<div class="stats"><div class="stat">Total kuis<strong>${quizzes.length}</strong></div><div class="stat">Dipublikasikan<strong>${quizzes.filter(q => q.published).length}</strong></div><div class="stat">Draft<strong>${quizzes.filter(q => !q.published).length}</strong></div><div class="stat">Total soal<strong>${totalQuestions}</strong></div><div class="stat">Submission<strong>${submissions.length}</strong></div><div class="stat">Rata-rata nilai<strong>${average}%</strong></div></div><div class="quick-grid"><button class="quick-card" data-admin-action="new">+ Buat kuis</button><button class="quick-card" data-admin-action="quizzes">Kelola kuis / Edit / Hapus</button><button class="quick-card" data-admin-action="submissions">Lihat hasil / Hapus</button><button class="quick-card" data-admin-action="subjects">Hasil per mata pelajaran</button></div><div class="card"><h3>Ringkasan mata pelajaran</h3><div class="subject-list">${subjects.length ? subjects.map(subject => `<div><b>${esc(subject)}</b><span>${quizzes.filter(q => q.subject === subject).length} kuis · ${quizzes.filter(q => q.subject === subject && q.published).length} publik</span></div>`).join('') : '<p class="empty">Belum ada data.</p>'}</div></div>`); $$('[data-admin-action]').forEach(button => button.onclick = () => button.dataset.adminAction === 'new' ? renderQuizForm() : openAdmin(button.dataset.adminAction)); }

async function renderQuizList() { const quizzes = await adminData(); adminShell('Daftar kuis', `<div class="toolbar"><input class="search" id="adminQuizSearch" placeholder="Cari judul kuis..."><button class="button primary" id="newQuiz">+ Buat kuis</button></div><div class="card publish-help"><b>Status publikasi</b><span>Dipublikasikan berarti tampil untuk siswa. Draft tidak tampil.</span></div><div class="grid" id="adminQuizGrid"></div>`); const draw = () => { const text = $('#adminQuizSearch').value.toLowerCase(); $('#adminQuizGrid').innerHTML = quizzes.filter(q => q.title?.toLowerCase().includes(text)).map(quizAdminCard).join('') || '<div class="empty">Belum ada kuis.</div>'; $$('#adminQuizGrid [data-edit]').forEach(button => button.onclick = () => renderQuizForm(button.dataset.edit)); $$('#adminQuizGrid [data-duplicate]').forEach(button => button.onclick = () => duplicateQuiz(button.dataset.duplicate)); $$('#adminQuizGrid [data-remove]').forEach(button => button.onclick = () => removeQuiz(button.dataset.remove)); $$('#adminQuizGrid [data-toggle]').forEach(button => button.onclick = () => togglePublish(button, button.dataset.value === 'true')); }; draw(); $('#adminQuizSearch').oninput = draw; $('#newQuiz').onclick = () => renderQuizForm(); }
function quizAdminCard(quiz) { const published = quiz.published === true || quiz.status === 'published'; return `<article class="card quiz-card"><span class="status ${published ? 'status-open' : ''}">${published ? 'DIPUBLIKASIKAN' : 'DRAFT / TIDAK DIPUBLIKASIKAN'}</span><h3>${esc(quiz.title || 'Tanpa judul')}</h3><p>${esc(quiz.description || 'Tidak ada deskripsi')}</p><div class="meta"><span class="tag">${esc(quiz.subject || 'Tanpa mapel')}</span><span>${quiz.totalQuestions || 0} soal</span><span>${money(quiz.totalPoints || 0)} poin</span></div><div class="card-actions"><button class="button primary" data-edit="${quiz.id}">Edit</button><button class="button secondary" data-duplicate="${quiz.id}">Duplikasi</button><button class="button danger" data-remove="${quiz.id}">Hapus</button></div><button class="button full ${published ? 'danger' : 'primary'}" data-toggle="${quiz.id}" data-value="${published}">${published ? 'Batalkan publikasi' : 'Publikasikan'}</button></article>`; }

function quizFormMarkup(quiz = {}) { return `<form id="quizForm" class="card form-card"><div class="form-grid"><label>Judul kuis<input name="title" required value="${esc(quiz.title)}"></label><label>Mata pelajaran<input name="subject" required value="${esc(quiz.subject)}"></label><label>Kelas target<input name="targetClass" value="${esc(quiz.targetClass)}"></label><label>Ikon<input name="icon" value="${esc(quiz.icon || '📚')}"></label><label>Waktu buka<input name="openAt" type="datetime-local" required value="${isoInput(quiz.openAt)}"></label><label>Waktu tutup<input name="closeAt" type="datetime-local" required value="${isoInput(quiz.closeAt)}"></label><label>Durasi menit<input name="duration" type="number" min="1" value="${quiz.duration || ''}"></label><label>Warna tema<input name="themeColor" type="color" value="${quiz.themeColor || '#176b4d'}"></label><label>Status publikasi<select name="published"><option value="false" ${quiz.published ? '' : 'selected'}>Draft / Tidak dipublikasikan</option><option value="true" ${quiz.published ? 'selected' : ''}>Dipublikasikan</option></select></label></div><label>Deskripsi<textarea name="description" rows="4">${esc(quiz.description)}</textarea></label><div class="check-grid"><label><input name="showScore" type="checkbox" ${quiz.showScore !== false ? 'checked' : ''}> Tampilkan nilai</label><label><input name="showAnswers" type="checkbox" ${quiz.showAnswers ? 'checked' : ''}> Tampilkan jawaban benar</label><label><input name="shuffleQuestions" type="checkbox" ${quiz.shuffleQuestions ? 'checked' : ''}> Acak soal</label><label><input name="shuffleOptions" type="checkbox" ${quiz.shuffleOptions ? 'checked' : ''}> Acak opsi</label><label><input name="allowRetake" type="checkbox" ${quiz.allowRetake ? 'checked' : ''}> Izinkan retake</label></div><div class="dialog-actions"><button type="button" class="button ghost" id="backQuizzes">Batal</button><button class="button primary">Simpan perubahan</button></div></form>`; }
async function renderQuizForm(id) { let quiz = id ? (await getDoc(doc(db, 'quizzes', id))).data() : {}; state.currentQuiz = { id, ...quiz }; adminShell(id ? 'Edit kuis' : 'Buat kuis', `${quizFormMarkup(quiz)}<div id="questionArea"></div>`); $('#backQuizzes').onclick = renderQuizList; $('#quizForm').onsubmit = saveQuiz; if (id) renderQuestionEditor(id); }
async function saveQuiz(event) { event.preventDefault(); const form = new FormData(event.target); const openAt = new Date(form.get('openAt')); const closeAt = new Date(form.get('closeAt')); const wantsPublished = form.get('published') === 'true'; if (!clean(form.get('title')) || !clean(form.get('subject'))) return toast('Judul dan mata pelajaran wajib diisi.'); if (Number.isNaN(openAt.getTime()) || Number.isNaN(closeAt.getTime())) return toast('Waktu buka dan tutup wajib diisi.'); if (closeAt <= openAt) return toast('Waktu tutup harus setelah waktu buka.'); let questionCount = Number(state.currentQuiz.totalQuestions || 0); if (state.currentQuiz.id) { const questionSnapshot = await getDocs(collection(db, `quizzes/${state.currentQuiz.id}/questions`)); questionCount = questionSnapshot.size; } if (wantsPublished && questionCount < 1) return toast('Tambahkan soal sebelum mempublikasikan kuis.'); const data = { title: clean(form.get('title')), subject: clean(form.get('subject')), description: clean(form.get('description')), targetClass: clean(form.get('targetClass')), icon: form.get('icon'), openAt, closeAt, duration: Number(form.get('duration') || 0), themeColor: form.get('themeColor'), showScore: form.get('showScore') === 'on', showAnswers: form.get('showAnswers') === 'on', shuffleQuestions: form.get('shuffleQuestions') === 'on', shuffleOptions: form.get('shuffleOptions') === 'on', allowRetake: form.get('allowRetake') === 'on', published: state.currentQuiz.id ? wantsPublished : false, totalQuestions: questionCount, updatedAt: serverTimestamp() }; if (state.currentQuiz.id) { await setDoc(doc(db, 'quizzes', state.currentQuiz.id), data, { merge: true }); toast(data.published ? 'Perubahan disimpan dan kuis dipublikasikan.' : 'Perubahan disimpan sebagai draft.'); renderQuestionEditor(state.currentQuiz.id); } else { data.createdAt = serverTimestamp(); const ref = await addDoc(collection(db, 'quizzes'), data); toast('Kuis dibuat sebagai draft.'); renderQuizForm(ref.id); } }

async function renderQuestionEditor(quizId) { const snap = await getDocs(collection(db, `quizzes/${quizId}/questions`)); state.questions = snap.docs.map(item => ({ id: item.id, ...item.data() })); const area = $('#questionArea'); area.innerHTML = `<div class="editor-heading"><div><h2>Editor soal (${state.questions.length})</h2><small>Poin jawaban benar kosong akan otomatis menjadi 10.</small></div><div class="editor-actions"><button class="button secondary" id="normalizePoints">Perbaiki poin</button><button class="button primary" id="addQuestion">+ Tambah soal</button></div></div><div class="question-list">${state.questions.map(questionCard).join('') || '<div class="empty">Belum ada soal. Tambah soal pertama.</div>'}</div>`; $('#addQuestion').onclick = () => questionDialog(quizId); $('#normalizePoints').onclick = async () => { for (const question of state.questions) { const options = (question.options || []).map(option => ({ ...option, points: normalizedOptionPoints(option, isCorrectOption(option)) })); await setDoc(doc(db, `quizzes/${quizId}/questions`, question.id), { options, updatedAt: serverTimestamp() }, { merge: true }); } await recalculateQuiz(quizId); toast('Poin jawaban benar sudah diperbaiki.'); renderQuestionEditor(quizId); }; $$('.question-admin').forEach(card => { card.querySelector('[data-question-edit]').onclick = () => questionDialog(quizId, card.dataset.id); card.querySelector('[data-question-delete]').onclick = () => deleteQuestion(quizId, card.dataset.id); }); }
function questionCard(question) { return `<article class="card question-admin" data-id="${question.id}"><span class="eyebrow">${esc(question.type || 'single')} · ${question.options?.length || 0} opsi</span><h3>${esc(question.text)}</h3><p>${(question.options || []).map(option => `${option.isCorrect ? '✓ ' : ''}${esc(option.text)} (${option.points || 0} poin)`).join(' · ')}</p><div class="card-actions"><button class="button secondary" data-question-edit>Edit</button><button class="button danger" data-question-delete>Hapus</button></div></article>`; }
function questionDialog(quizId, questionId) { const question = questionId ? state.questions.find(item => item.id === questionId) : { type: 'single', options: [{ id: 'a', text: '', points: 0 }, { id: 'b', text: '', points: 0 }] }; const dialog = document.createElement('dialog'); dialog.className = 'question-dialog'; dialog.innerHTML = `<form method="dialog" id="questionForm"><h2>${questionId ? 'Edit' : 'Tambah'} soal</h2><label>Pertanyaan<textarea name="text" rows="3">${esc(question.text)}</textarea></label><label>URL gambar (opsional)<input name="imageUrl" value="${esc(question.imageUrl)}"></label><label>Tipe soal<select name="type"><option value="single" ${question.type === 'single' ? 'selected' : ''}>Single</option><option value="allCorrect" ${question.type === 'allCorrect' ? 'selected' : ''}>All correct</option></select></label><div id="optionsEditor">${optionsMarkup(question)}</div><button type="button" class="button secondary" id="addOption">+ Tambah opsi</button><div class="dialog-actions"><button type="button" class="button ghost" id="cancelQuestion">Batal</button><button type="submit" class="button primary">Simpan soal</button></div></form>`; document.body.append(dialog); dialog.showModal(); $('#cancelQuestion', dialog).onclick = () => { dialog.close(); dialog.remove(); }; $('#addOption', dialog).onclick = () => { const count = $$('.option-row', dialog).length; if (count < 6) $('#optionsEditor', dialog).insertAdjacentHTML('beforeend', optionRow({ id: String.fromCharCode(97 + count), text: '', points: 0 }, count)); }; $('#questionForm', dialog).onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target); const text = clean(form.get('text')); const options = $$('.option-row', dialog).map((row, index) => ({ id: String.fromCharCode(97 + index), text: clean($('input[name="optionText"]', row).value), points: Math.max(0, Number($('input[name="optionPoints"]', row).value || 0)), isCorrect: $('input[name="correct"]', row).checked })); if (!text) return toast('Pertanyaan wajib diisi saat menyimpan.'); if (options.length < 2 || options.length > 6 || options.some(option => !option.text)) return toast('Soal harus punya 2-6 opsi berisi teks saat menyimpan.'); if (form.get('type') === 'single' && options.filter(option => option.isCorrect).length !== 1) return toast('Tipe single harus tepat satu jawaban benar.'); if (form.get('type') === 'allCorrect') options.forEach(option => option.isCorrect = true); const data = { text, imageUrl: clean(form.get('imageUrl')), type: form.get('type'), options, updatedAt: serverTimestamp() }; await setDoc(questionId ? doc(db, `quizzes/${quizId}/questions`, questionId) : doc(collection(db, `quizzes/${quizId}/questions`)), data); await recalculateQuiz(quizId); dialog.close(); dialog.remove(); renderQuestionEditor(quizId); }; }
function optionsMarkup(question) { return (question.options || []).map((option, index) => optionRow(option, index)).join(''); }
function optionRow(option, index) { return `<div class="option-row"><b>${String.fromCharCode(65 + index)}</b><input name="optionText" placeholder="Teks opsi" value="${esc(option.text)}"><input name="optionPoints" type="number" min="0" placeholder="Poin" value="${option.points || 0}"><label><input name="correct" type="checkbox" ${option.isCorrect ? 'checked' : ''}> benar</label></div>`; }
async function recalculateQuiz(quizId) { const snap = await getDocs(collection(db, `quizzes/${quizId}/questions`)); const questions = snap.docs.map(item => item.data()); const totalPoints = questions.reduce((sum, question) => sum + questionMaxPoints(question), 0); await setDoc(doc(db, 'quizzes', quizId), { totalQuestions: questions.length, totalPoints, updatedAt: serverTimestamp() }, { merge: true }); }
async function deleteQuestion(quizId, id) { if (!confirm('Hapus soal ini?')) return; await deleteDoc(doc(db, `quizzes/${quizId}/questions`, id)); await recalculateQuiz(quizId); renderQuestionEditor(quizId); }
async function togglePublish(button, publish) { const id = button.dataset.toggle; const oldText = button.textContent; button.disabled = true; button.textContent = 'Menyimpan...'; try { const quiz = (await getDoc(doc(db, 'quizzes', id))).data(); const questions = await getDocs(collection(db, `quizzes/${id}/questions`)); if (publish && questions.empty) throw new Error('Tambahkan minimal satu soal sebelum publikasi.'); await setDoc(doc(db, 'quizzes', id), { published: publish, status: publish ? 'published' : 'draft', totalQuestions: questions.size, updatedAt: serverTimestamp() }, { merge: true }); toast(publish ? 'Kuis berhasil dipublikasikan. Siswa dapat melihat kuis setelah refresh.' : 'Publikasi kuis berhasil dibatalkan.'); await renderQuizList(); } catch (error) { button.disabled = false; button.textContent = oldText; toast(errorMessage(error)); console.error(error); } }
async function duplicateQuiz(id) { const original = (await getDoc(doc(db, 'quizzes', id))).data(); const copy = { ...original, title: `${original.title} (Salinan)`, published: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; delete copy.totalQuestions; const ref = await addDoc(collection(db, 'quizzes'), copy); const questions = await getDocs(collection(db, `quizzes/${id}/questions`)); const batch = writeBatch(db); questions.forEach(item => batch.set(doc(db, `quizzes/${ref.id}/questions`, item.id), item.data())); await batch.commit(); await recalculateQuiz(ref.id); toast('Kuis berhasil diduplikasi.'); renderQuizList(); }
async function removeQuiz(id) { if (!confirm('Hapus kuis ini? Jika sudah punya submission, kuis akan diarsipkan agar riwayat nilai tetap aman.')) return; const button = document.querySelector(`[data-remove="${id}"]`); if (button) { button.disabled = true; button.textContent = 'Memproses...'; } try { const submissionSnapshot = await firestoreRequest(() => getDocs(query(collection(db, 'submissions'), where('quizId', '==', id)))); if (!submissionSnapshot.empty) { await setDoc(doc(db, 'quizzes', id), { published: false, status: 'archived', archived: true, archivedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); toast('Kuis diarsipkan karena memiliki submission. Riwayat nilai tetap aman.'); } else { const questionSnapshot = await firestoreRequest(() => getDocs(collection(db, `quizzes/${id}/questions`))); const batch = writeBatch(db); questionSnapshot.docs.forEach(item => batch.delete(item.ref)); batch.delete(doc(db, 'quizzes', id)); await batch.commit(); toast('Kuis dan semua soalnya berhasil dihapus.'); } await renderQuizList(); } catch (error) { if (button) { button.disabled = false; button.textContent = 'Hapus'; } showError('Kuis gagal dihapus', `${errorMessage(error)}\n\nPastikan login admin masih aktif dan Firestore Rules sudah dipublish.`); console.error(error); } }

async function renderSubmissions(subject = '') { const snapshot = await getDocs(collection(db, 'submissions')); const quizzes = await adminData(); const quizPoints = new Map(); for (const quiz of quizzes) { let total = Number(quiz.totalPoints || 0); if (!total) { const questions = (await getDocs(collection(db, `quizzes/${quiz.id}/questions`))).docs.map(item => item.data()); total = questions.reduce((sum, question) => sum + questionMaxPoints(question), 0); } quizPoints.set(quiz.id, total); } state.submissions = snapshot.docs.map(item => { const data = item.data(); const total = Number(data.total || data.maxScore || quizPoints.get(data.quizId) || 0); const score = Number(data.score ?? data.totalScore ?? 0); return { id: item.id, ...data, score, total, correct: Number(data.correct ?? data.correctCount ?? 0), wrong: Number(data.wrong ?? data.wrongCount ?? 0), unanswered: Number(data.unanswered ?? data.unansweredCount ?? Math.max(0, Number(data.totalQuestions || 0) - Number(data.correct ?? data.correctCount ?? 0) - Number(data.wrong ?? data.wrongCount ?? 0))) }; }).filter(item => !subject || item.subject === subject); adminShell(subject ? `Hasil ${subject}` : 'Rekap submission', `<div class="toolbar"><input class="search" id="submissionSearch" placeholder="Cari nama, mapel, atau kuis..."><button class="button secondary" id="downloadCsv">Download CSV</button><button class="button secondary" id="downloadExcel">Export Excel</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Kelas</th><th>Mapel</th><th>Kuis</th><th>Nilai</th><th>Benar</th><th>Salah</th><th>Kosong</th><th>Aksi</th></tr></thead><tbody id="submissionRows"></tbody></table></div>`); const draw = () => { const text = $('#submissionSearch').value.toLowerCase(); const rows = state.submissions.filter(item => [item.studentName, item.subject, item.quizTitle].join(' ').toLowerCase().includes(text)); $('#submissionRows').innerHTML = rows.map(item => `<tr><td>${esc(item.studentName)}</td><td>${esc(item.studentClass)}</td><td>${esc(item.subject)}</td><td>${esc(item.quizTitle)}</td><td>${item.score}/${item.total}</td><td>${item.correct}</td><td>${item.wrong}</td><td>${item.unanswered}</td><td><button class="button danger small" data-submission-delete="${item.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="9">Belum ada hasil.</td></tr>'; $$('#submissionRows [data-submission-delete]').forEach(button => button.onclick = () => deleteSubmission(button.dataset.submissionDelete)); }; draw(); $('#submissionSearch').oninput = draw; $('#downloadCsv').onclick = () => downloadCSV(state.submissions, subject); $('#downloadExcel').onclick = () => downloadExcel(state.submissions); }
async function renderSubmissionsFast(subject = '') {
  const [snapshot, quizzes] = await withTimeout(Promise.all([
    getDocs(collection(db, 'submissions')),
    getDocs(collection(db, 'quizzes'))
  ]));
  const quizPoints = new Map(quizzes.docs.map(item => [item.id, Number(item.data().totalPoints || 0)]));
  state.submissions = snapshot.docs.map(item => {
    const data = item.data();
    const total = Number(data.total || data.maxScore || quizPoints.get(data.quizId) || 0);
    return {
      id: item.id,
      ...data,
      total,
      score: Number(data.score ?? data.totalScore ?? 0),
      correct: Number(data.correct ?? data.correctCount ?? 0),
      wrong: Number(data.wrong ?? data.wrongCount ?? 0),
      unanswered: Number(data.unanswered ?? data.unansweredCount ?? 0)
    };
  }).filter(item => !subject || item.subject === subject)
    .sort((a, b) => (dateValue(b.submittedAt)?.getTime() || 0) - (dateValue(a.submittedAt)?.getTime() || 0));
  adminShell(subject ? `Hasil ${subject}` : 'Rekap submission', `<div class="toolbar"><input class="search" id="submissionSearch" placeholder="Cari nama, mapel, atau kuis..."><button class="button secondary" id="downloadCsv">Download CSV</button><button class="button secondary" id="downloadExcel">Export Excel</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Kelas</th><th>Mapel</th><th>Kuis</th><th>Nilai</th><th>Benar</th><th>Salah</th><th>Kosong</th><th>Aksi</th></tr></thead><tbody id="submissionRows"></tbody></table></div>`);
  const draw = () => {
    const text = $('#submissionSearch').value.toLowerCase();
    const rows = state.submissions.filter(item => [item.studentName, item.subject, item.quizTitle].join(' ').toLowerCase().includes(text));
    $('#submissionRows').innerHTML = rows.map(item => `<tr><td>${esc(item.studentName)}</td><td>${esc(item.studentClass)}</td><td>${esc(item.subject)}</td><td>${esc(item.quizTitle)}</td><td>${item.score}/${item.total}</td><td>${item.correct}</td><td>${item.wrong}</td><td>${item.unanswered}</td><td><button class="button danger" data-delete-submission="${item.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Belum ada submission.</td></tr>';
    $$('[data-delete-submission]').forEach(button => button.onclick = () => deleteSubmission(button.dataset.deleteSubmission));
  };
  draw();
  $('#submissionSearch').oninput = draw;
  $('#downloadCsv').onclick = () => downloadCSV(state.submissions, subject);
  $('#downloadExcel').onclick = () => downloadExcel(state.submissions);
}
renderSubmissions = renderSubmissionsFast;
function unanswered(item) { return Math.max(0, Number(item.totalQuestions || 0) - Number(item.correct || 0) - Number(item.wrong || 0)); }
async function deleteSubmission(id) { if (!confirm('Hapus submission ini?')) return; await deleteDoc(doc(db, 'submissions', id)); toast('Submission dihapus.'); renderSubmissions(); }
function downloadCSV(rows, subject = '') { const headers = ['Nama', 'Kelas', 'Mata Pelajaran', 'Kuis', 'Nilai', 'Persentase', 'Benar', 'Salah', 'Kosong']; const data = rows.map(item => [item.studentName, item.studentClass, item.subject, item.quizTitle, item.score || 0, item.total ? Math.round(item.score / item.total * 100) : 0, item.correct || 0, item.wrong || 0, unanswered(item)]); const csv = [headers, ...data].map(row => row.map(value => { let text = String(value ?? ''); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); link.download = `hasil-${(subject || 'umum').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`; link.click(); }
function downloadExcel(rows) { downloadCSV(rows); toast('CSV UTF-8 berhasil diunduh. Untuk XLSX asli, tambahkan library xlsx pada halaman.'); }
async function renderSubjects() { const quizzes = await adminData(); const subjects = [...new Set(quizzes.map(item => item.subject).filter(Boolean))]; adminShell('Per mata pelajaran', `<div class="grid">${subjects.map(subject => `<article class="card"><span class="eyebrow">MATA PELAJARAN</span><h3>${esc(subject)}</h3><p>${quizzes.filter(q => q.subject === subject).length} kuis · ${quizzes.filter(q => q.subject === subject && q.published).length} publik</p><button class="button primary full" data-subject="${esc(subject)}">Lihat hasil</button></article>`).join('') || '<div class="empty">Belum ada mata pelajaran.</div>'}</div>`); $$('[data-subject]').forEach(button => button.onclick = () => renderSubmissions(button.dataset.subject)); }
async function renderSettings() { const snapshot = await getDoc(doc(db, 'settings', 'general')); const settings = { appName: 'KelasKita', schoolName: '', logoUrl: '', classes: [], subjects: [], retakeDefault: false, showScoreDefault: true, ...(snapshot.exists() ? snapshot.data() : {}) }; adminShell('Pengaturan aplikasi', `<form id="settingsForm" class="card form-card"><div class="form-grid"><label>Nama aplikasi<input name="appName" value="${esc(settings.appName)}"></label><label>Nama sekolah<input name="schoolName" value="${esc(settings.schoolName)}"></label><label>URL logo<input name="logoUrl" value="${esc(settings.logoUrl)}"></label><label>Daftar kelas, pisahkan koma<input name="classes" value="${esc((settings.classes || []).join(', '))}"></label><label>Daftar mata pelajaran, pisahkan koma<input name="subjects" value="${esc((settings.subjects || []).join(', '))}"></label></div><div class="check-grid"><label><input name="retakeDefault" type="checkbox" ${settings.retakeDefault ? 'checked' : ''}> Retake default</label><label><input name="showScoreDefault" type="checkbox" ${settings.showScoreDefault ? 'checked' : ''}> Tampilkan nilai default</label></div><button class="button primary">Simpan pengaturan</button></form>`); $('#settingsForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target); await setDoc(doc(db, 'settings', 'general'), { appName: form.get('appName'), schoolName: form.get('schoolName'), logoUrl: form.get('logoUrl'), classes: clean(form.get('classes')).split(',').map(clean).filter(Boolean), subjects: clean(form.get('subjects')).split(',').map(clean).filter(Boolean), retakeDefault: form.get('retakeDefault') === 'on', showScoreDefault: form.get('showScoreDefault') === 'on', updatedAt: serverTimestamp() }); toast('Pengaturan disimpan.'); }; }

let adminLoading = false;
let adminRealtimeStarted = false;
let adminRefreshTimer = null;
const stateAdmin = { page: '' };
function startAdminRealtime() {
  if (adminRealtimeStarted) return;
  adminRealtimeStarted = true;
  const refresh = () => {
    clearTimeout(adminRefreshTimer);
    adminRefreshTimer = setTimeout(() => {
      if (!state.user || !state.isAdmin || adminLoading) return;
      if (stateAdmin.page === 'dashboard') renderDashboard();
      if (stateAdmin.page === 'submissions') renderSubmissions();
      if (stateAdmin.page === 'subjects') renderSubjects();
      if (stateAdmin.page === 'quizzes' && $('#adminQuizGrid')) renderQuizList();
    }, 150);
  };
  onSnapshot(collection(db, 'quizzes'), refresh, error => toast(errorMessage(error)));
  onSnapshot(collection(db, 'submissions'), refresh, error => toast(errorMessage(error)));
  onSnapshot(doc(db, 'settings', 'general'), refresh, error => toast(errorMessage(error)));
}
async function openAdmin(page) { if (!state.user) return $('#adminDialog').showModal(); if (!state.isAdmin) { const profile = state.adminProfile || {}; showError('Akses admin ditolak', `UID login: ${state.user.uid}\nDokumen users/${state.user.uid}: ${profile.exists ? 'ada' : 'tidak ada'}\nRole: ${profile.data?.role || '-'}\nactive: ${String(profile.data?.active)}\nisActive: ${String(profile.data?.isActive)}\n\nBuat atau perbaiki dokumen users/${state.user.uid}.`); return; } if (adminLoading) return; adminLoading = true; try { loading('Memuat dashboard admin...'); if (page === 'dashboard') await firestoreRequest(() => renderDashboard()); if (page === 'quizzes') await firestoreRequest(() => renderQuizList()); if (page === 'submissions') await firestoreRequest(() => renderSubmissions()); if (page === 'subjects') await firestoreRequest(() => renderSubjects()); if (page === 'settings') await firestoreRequest(() => renderSettings()); } catch (error) { showError('CRUD admin gagal', `${errorMessage(error)}\n\nUID login: ${state.user.uid}\n\nCoba refresh halaman sekali.`); } finally { adminLoading = false; } }
$('#adminForm').onsubmit = async event => { event.preventDefault(); const email = clean($('#adminEmail').value); const password = $('#adminPassword').value; const button = $('#adminSubmit'); $('#adminError').textContent = ''; if (!email || !password) { $('#adminError').textContent = 'Email dan password wajib diisi.'; return; } button.disabled = true; button.textContent = 'Memeriksa...'; try { await signInWithEmailAndPassword(auth, email, password); $('#adminDialog').close(); } catch (error) { $('#adminError').textContent = errorMessage(error); } finally { button.disabled = false; button.textContent = 'Masuk'; } };
$$('[data-view]').forEach(button => button.onclick = () => { const page = button.dataset.view === 'results' ? 'submissions' : 'dashboard'; stateAdmin.page = page; if (button.dataset.view !== 'home') startAdminRealtime(); return button.dataset.view === 'home' ? renderHome() : openAdmin(page); });
loading();
const authReady = new Promise(resolve => onAuthStateChanged(auth, resolve));
withTimeout(authReady).then(async user => { state.user = user; state.isAdmin = false; if (user) { try { state.isAdmin = await withTimeout(verifyAdmin(user)); } catch (error) { toast(errorMessage(error)); } } $('#adminNav').hidden = !user; $('#adminNav').textContent = state.isAdmin ? 'Admin' : 'Admin Login'; $('#userArea').innerHTML = user ? `<span class="user-chip">${esc(user.email)}</span><button class="button ghost" id="logout">Keluar</button>` : '<button class="button secondary" id="loginAdmin">Admin</button>'; if ($('#logout')) $('#logout').onclick = () => signOut(auth); if ($('#loginAdmin')) $('#loginAdmin').onclick = () => $('#adminDialog').showModal(); if (state.isAdmin) openAdmin('dashboard'); else loadPublicQuizzes(); }).catch(error => showError('Firebase belum tersambung', `${errorMessage(error)}\n\nPeriksa internet, Firebase project ID, Firestore Database, dan Firebase API key.`));
