const STORAGE_KEY = 'sakutto-todo.tasks.v1';
const THEME_KEY = 'sakutto-todo.theme.v1';
let selectedPeriod = 'today';
let tasks = loadTasks();

const $ = (selector) => document.querySelector(selector);
const list = $('#task-list');
const empty = $('#empty-state');
const dialog = $('#task-dialog');
const input = $('#task-input');
const template = $('#task-template');
const labels = { today: '今日のタスク', week: '今週のタスク', later: 'いつかやるタスク' };

function loadTasks() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function activeTasks(period) { return tasks.filter(task => task.period === period); }
function taskTime(task) { return task.startTime ? `${task.startTime}${task.endTime ? ` 〜 ${task.endTime}` : ''}` : '時間未定'; }
function updateCounts() { for (const period of Object.keys(labels)) $(`#count-${period}`).textContent = activeTasks(period).filter(t => !t.done).length; }

function renderSchedule() {
  const scheduled = activeTasks('today').filter(task => task.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const scheduleList = $('#schedule-list');
  scheduleList.replaceChildren();
  $('#schedule-empty').hidden = scheduled.length > 0;
  $('#schedule-count').textContent = scheduled.length ? `${scheduled.length}件の予定` : '予定なし';
  scheduled.forEach(task => {
    const row = document.createElement('li');
    row.className = `schedule-item${task.done ? ' is-done' : ''}`;
    row.innerHTML = `<time>${taskTime(task)}</time><span></span><strong></strong>`;
    row.querySelector('strong').textContent = task.title;
    scheduleList.append(row);
  });
}

function render() {
  list.replaceChildren();
  const current = activeTasks(selectedPeriod);
  $('#list-heading').textContent = labels[selectedPeriod];
  empty.hidden = current.length !== 0;
  current.sort((a, b) => Number(a.done) - Number(b.done) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || b.createdAt - a.createdAt).forEach(task => {
    const node = template.content.cloneNode(true);
    const item = node.querySelector('.task-item');
    const complete = node.querySelector('.complete-button');
    item.classList.toggle('is-done', task.done);
    node.querySelector('.task-title').textContent = task.title;
    node.querySelector('.task-time').textContent = taskTime(task);
    complete.textContent = task.done ? '完了済み' : '完了する';
    complete.setAttribute('aria-label', `${task.title}を${task.done ? '未完了に戻す' : '完了にする'}`);
    complete.addEventListener('click', () => { task.done = !task.done; saveTasks(); render(); });
    node.querySelector('.delete-button').addEventListener('click', () => { tasks = tasks.filter(t => t.id !== task.id); saveTasks(); render(); });
    list.append(node);
  });
  const today = activeTasks('today'); const done = today.filter(t => t.done).length; const percent = today.length ? Math.round(done / today.length * 100) : 0;
  $('#progress-text').textContent = `${done} / ${today.length} 完了`; $('#progress-percent').textContent = `${percent}%`;
  $('#progress-ring').style.setProperty('--progress', `${percent}%`); $('#progress-ring').setAttribute('aria-label', `完了率 ${percent}%`);
  $('#clear-completed').hidden = !current.some(t => t.done); updateCounts(); renderSchedule();
}

function openDialog() { dialog.showModal(); setTimeout(() => input.focus(), 80); }
function closeDialog() { dialog.close(); }
function updateTimeHint() {
  const isToday = document.querySelector('input[name="period"]:checked').value === 'today';
  $('#time-hint').textContent = isToday ? '時刻を入れると、上のスケジュールにも表示されます。' : '時刻は登録されますが、スケジュールに表示されるのは「今日」のタスクです。';
}
$('#open-add').addEventListener('click', openDialog); $('#close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
document.querySelectorAll('input[name="period"]').forEach(radio => radio.addEventListener('change', updateTimeHint));
$('#task-form').addEventListener('submit', event => {
  event.preventDefault(); const title = input.value.trim(); if (!title) return;
  const formData = new FormData(event.currentTarget); const period = formData.get('period');
  const startTime = formData.get('startTime'); const endTime = formData.get('endTime');
  if (startTime && endTime && endTime <= startTime) { $('#end-time').setCustomValidity('終了時刻は開始時刻より後にしてください。'); $('#end-time').reportValidity(); return; }
  $('#end-time').setCustomValidity('');
  tasks.push({ id: crypto.randomUUID(), title, period, startTime, endTime, done: false, createdAt: Date.now() });
  saveTasks(); selectedPeriod = period; document.querySelector('.filter.is-active').classList.remove('is-active'); document.querySelector(`[data-period="${period}"]`).classList.add('is-active');
  event.currentTarget.reset(); closeDialog(); render();
});
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { selectedPeriod = button.dataset.period; document.querySelector('.filter.is-active').classList.remove('is-active'); button.classList.add('is-active'); render(); }));
$('#clear-completed').addEventListener('click', () => { tasks = tasks.filter(task => !(task.period === selectedPeriod && task.done)); saveTasks(); render(); });
function setupTheme() { const saved = localStorage.getItem(THEME_KEY); if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); $('#theme-button').addEventListener('click', () => { const dark = document.documentElement.classList.toggle('dark'); localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); }); }
$('#today-label').textContent = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
setupTheme(); updateTimeHint(); render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
