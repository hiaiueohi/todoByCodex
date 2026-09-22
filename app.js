const STORAGE_KEY = 'sakutto-todo.tasks.v2';
const LEGACY_KEY = 'sakutto-todo.tasks.v1';
const THEME_KEY = 'sakutto-todo.theme.v1';
const NOTIFIED_KEY = 'sakutto-todo.notified.v1';
const $ = selector => document.querySelector(selector);
const form = $('#task-form');
const dialog = $('#task-dialog');
const input = $('#task-input');
const template = $('#task-template');
let selectedDate = dateToISO(new Date());
let calendarDate = new Date(`${selectedDate}T00:00:00`);
let editingTaskId = null;
let tasks = loadTasks();

function dateToISO(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDate(iso) { return new Date(`${iso}T00:00:00`); }
function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || '[]');
    const today = dateToISO(new Date());
    return stored.map(task => ({ ...task, date: task.date || today, recurrence: task.recurrence || 'none', doneDates: task.doneDates || (task.done ? [task.date || today] : []) }));
  } catch { return []; }
}
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function toHalfWidth(value) { return value.replace(/[０-９．]/g, char => char === '．' ? '.' : String.fromCharCode(char.charCodeAt(0) - 0xFEE0)); }
function parseInlineTime(value) {
  const match = value.match(/(?:_|＿)\s*([0-9０-９]{4})\s*[.．]\s*([0-9０-９]{4})\s*$/);
  if (!match) return null;
  const start = toHalfWidth(match[1]); const end = toHalfWidth(match[2]);
  const startTime = `${start.slice(0, 2)}:${start.slice(2)}`; const endTime = `${end.slice(0, 2)}:${end.slice(2)}`;
  if (startTime > '23:59' || endTime > '23:59' || endTime <= startTime) return null;
  return { title: value.slice(0, match.index).trim(), startTime, endTime };
}
function occursOn(task, iso) {
  if (iso < task.date) return false;
  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekly') return parseDate(iso).getDay() === parseDate(task.date).getDay();
  if (task.recurrence === 'monthly') return parseDate(iso).getDate() === parseDate(task.date).getDate();
  return iso === task.date;
}
function tasksOn(iso) { return tasks.filter(task => occursOn(task, iso)); }
function isDone(task, iso) { return task.doneDates.includes(iso); }
function taskTime(task) { return task.startTime ? `${task.startTime}${task.endTime ? ` 〜 ${task.endTime}` : ''}` : '時間未定'; }
function dueMinutes(task) { if (!task.startTime) return null; const start = Number(task.startTime.slice(0, 2)) * 60 + Number(task.startTime.slice(3)); return task.endTime ? Number(task.endTime.slice(0, 2)) * 60 + Number(task.endTime.slice(3)) : start + 30; }
function isOverdue(task, iso) { const now = new Date(); return iso === dateToISO(now) && !isDone(task, iso) && dueMinutes(task) !== null && now.getHours() * 60 + now.getMinutes() >= dueMinutes(task); }
function selectedDateLabel() { return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(parseDate(selectedDate)); }
function recurrenceLabel(value) { return ({ daily: '毎日', weekly: '毎週', monthly: '毎月' })[value] || ''; }

function renderCalendar() {
  const year = calendarDate.getFullYear(); const month = calendarDate.getMonth();
  $('#calendar-heading').textContent = `${year}年${month + 1}月`;
  const grid = $('#calendar-grid'); grid.replaceChildren();
  const firstDay = new Date(year, month, 1).getDay(); const totalDays = new Date(year, month + 1, 0).getDate();
  for (let blank = 0; blank < firstDay; blank += 1) grid.append(document.createElement('span'));
  for (let day = 1; day <= totalDays; day += 1) {
    const iso = dateToISO(new Date(year, month, day)); const button = document.createElement('button');
    button.type = 'button'; button.textContent = day; button.className = 'calendar-day';
    if (iso === selectedDate) button.classList.add('is-selected');
    if (iso === dateToISO(new Date())) button.classList.add('is-today');
    if (tasksOn(iso).length) button.classList.add('has-tasks');
    button.setAttribute('aria-label', `${iso}${tasksOn(iso).length ? `、${tasksOn(iso).length}件のタスク` : ''}`);
    button.addEventListener('click', () => {
      if (iso === selectedDate) { openDialog(); return; }
      selectedDate = iso; calendarDate = parseDate(iso); render();
    });
    grid.append(button);
  }
}
function startOfWeek(iso) {
  const date = parseDate(iso); const offset = (date.getDay() + 6) % 7; date.setDate(date.getDate() - offset); return date;
}
function renderWeekOverview() {
  const container = $('#week-task-groups'); container.replaceChildren(); const monday = startOfWeek(dateToISO(new Date()));
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday); date.setDate(monday.getDate() + index); const iso = dateToISO(date); const tasksForDay = tasksOn(iso).sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
    const group = document.createElement('article'); group.className = `weekday-group${iso === selectedDate ? ' is-selected' : ''}`;
    group.innerHTML = `<button class="weekday-heading" type="button"><span>${['月','火','水','木','金','土','日'][index]}</span><time>${date.getMonth() + 1}/${date.getDate()}</time><b>${tasksForDay.length}</b></button><ul></ul>`;
    group.querySelector('.weekday-heading').addEventListener('click', () => { selectedDate = iso; calendarDate = parseDate(iso); render(); });
    const list = group.querySelector('ul');
    tasksForDay.forEach(task => { const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.textContent = `${task.startTime || '時間未定'} ${task.title}`; button.className = isDone(task, iso) ? 'is-done' : ''; button.addEventListener('click', () => { selectedDate = iso; calendarDate = parseDate(iso); render(); openEditDialog(task); }); item.append(button); list.append(item); });
    if (!tasksForDay.length) { const item = document.createElement('li'); item.className = 'no-week-task'; item.textContent = '予定なし'; list.append(item); }
    container.append(group);
  }
}
function renderSchedule() {
  const scheduled = tasksOn(selectedDate).filter(task => task.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const laneEnds = [];
  const scheduledWithLanes = scheduled.map(task => {
    const start = Number(task.startTime.slice(0, 2)) * 60 + Number(task.startTime.slice(3));
    const end = task.endTime ? Number(task.endTime.slice(0, 2)) * 60 + Number(task.endTime.slice(3)) : start + 30;
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    return { task, lane };
  });
  const scheduleList = $('#schedule-list'); scheduleList.replaceChildren();
  $('#schedule-empty').hidden = true;
  for (let hour = 6; hour <= 22; hour += 1) {
    const slot = document.createElement('li'); slot.className = 'time-slot'; slot.style.setProperty('--slot-top', `${(hour - 6) * 48}px`);
    slot.innerHTML = `<time>${String(hour).padStart(2, '0')}:00</time><div class="slot-line"></div>`; scheduleList.append(slot);
  }
  if (selectedDate === dateToISO(new Date())) {
    const now = new Date(); const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes >= 360 && minutes <= 1380) {
      const line = document.createElement('li'); line.className = 'now-line'; line.style.setProperty('--now-top', `${(minutes - 360) * 0.8}px`);
      line.innerHTML = `<span>${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</span>`; scheduleList.append(line);
    }
  }
  scheduledWithLanes.forEach(({ task, lane }) => {
    const start = Number(task.startTime.slice(0, 2)) * 60 + Number(task.startTime.slice(3));
    const end = task.endTime ? Number(task.endTime.slice(0, 2)) * 60 + Number(task.endTime.slice(3)) : start + 30;
    const visibleStart = Math.max(start, 360); const visibleEnd = Math.min(end, 1380); if (visibleEnd <= visibleStart) return;
    const row = document.createElement('li'); row.className = `schedule-item${isDone(task, selectedDate) ? ' is-done' : ''}`;
    row.style.setProperty('--task-top', `${(visibleStart - 360) * 0.8}px`); row.style.setProperty('--task-height', `${Math.max((visibleEnd - visibleStart) * 0.8, 34)}px`); row.style.left = `calc(58px + ${lane * 12}%)`; row.style.right = '4px'; row.style.zIndex = String(lane + 1);
    row.classList.toggle('is-overdue', isOverdue(task, selectedDate)); row.innerHTML = `<span class="schedule-dot"></span><time>${taskTime(task)}</time><strong></strong>`; row.querySelector('strong').textContent = task.title; scheduleList.append(row);
  });
  $('#schedule-count').textContent = scheduled.length ? `${scheduled.length}件の予定` : '予定なし';
  $('#schedule-heading').textContent = `${selectedDateLabel()}のスケジュール`;
}
function renderTasks() {
  const list = $('#task-list'); const current = tasksOn(selectedDate).sort((a, b) => Number(isDone(a, selectedDate)) - Number(isDone(b, selectedDate)) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  list.replaceChildren(); $('#list-heading').textContent = `${selectedDateLabel()}のタスク`; $('#empty-state').hidden = current.length !== 0;
  current.forEach(task => {
    const node = template.content.cloneNode(true); const item = node.querySelector('.task-item'); const done = isDone(task, selectedDate);
    item.classList.toggle('is-done', done); item.classList.toggle('is-overdue', isOverdue(task, selectedDate)); node.querySelector('.task-title').textContent = task.title; node.querySelector('.task-time').textContent = `${taskTime(task)}${recurrenceLabel(task.recurrence) ? ` ・ ${recurrenceLabel(task.recurrence)}` : ''}`;
    const complete = node.querySelector('.complete-button'); complete.textContent = done ? '完了済み' : '完了する';
    node.querySelector('.task-main').addEventListener('click', () => openEditDialog(task));
    complete.addEventListener('click', () => { task.doneDates = done ? task.doneDates.filter(date => date !== selectedDate) : [...task.doneDates, selectedDate]; saveTasks(); render(); if (!done) showCompletionEffect(); });
    node.querySelector('.delete-button').addEventListener('click', () => { if (task.recurrence !== 'none') { openEditDialog(task); return; } tasks = tasks.filter(item => item.id !== task.id); saveTasks(); render(); });
    list.append(node);
  });
  const doneCount = current.filter(task => isDone(task, selectedDate)).length; const percent = current.length ? Math.round(doneCount / current.length * 100) : 0;
  $('#progress-text').textContent = `${doneCount} / ${current.length} 完了`; $('#progress-percent').textContent = `${percent}%`; $('#progress-ring').style.setProperty('--progress', `${percent}%`);
}
function render() { renderCalendar(); renderWeekOverview(); renderSchedule(); renderTasks(); }
function notifiedTasks() { try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch { return {}; } }
function updateNotificationButton() {
  const button = $('#notification-button'); const message = $('#notification-message'); button.disabled = false; button.classList.remove('is-enabled');
  if (!window.isSecureContext || !('Notification' in window)) { button.textContent = '通知を使うには'; message.textContent = 'HTTPSで公開するか、スマホではホーム画面に追加したアプリとして開いてください。'; return; }
  if (Notification.permission === 'granted') { button.textContent = '通知は有効です'; button.classList.add('is-enabled'); message.textContent = '終了時刻を過ぎても未完了の予定をお知らせします。'; }
  else if (Notification.permission === 'denied') { button.textContent = '通知がブロック中'; message.textContent = 'ブラウザまたは端末の設定から、このサイトの通知を許可してください。'; }
}
async function sendOverdueNotification(task, date) {
  const title = '未完了のタスクがあります'; const body = `「${task.title}」の予定時刻を過ぎています。`;
  try { const registration = await navigator.serviceWorker.ready; await registration.showNotification(title, { body, icon: './icons/icon-192.svg', tag: `todo-${date}-${task.id}`, renotify: false }); }
  catch { new Notification(title, { body, icon: './icons/icon-192.svg', tag: `todo-${date}-${task.id}` }); }
}
function checkOverdueTasks() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(); const today = dateToISO(now); const nowMinutes = now.getHours() * 60 + now.getMinutes(); const sent = notifiedTasks(); let changed = false;
  tasksOn(today).forEach(task => {
    if (isDone(task, today) || !task.startTime) return;
    const due = dueMinutes(task); const key = `${today}:${task.id}`;
    if (nowMinutes >= due && !sent[key]) { sent[key] = true; changed = true; sendOverdueNotification(task, today); }
  });
  if (changed) localStorage.setItem(NOTIFIED_KEY, JSON.stringify(sent));
}

function resetDialog() { editingTaskId = null; form.reset(); $('#task-date').value = selectedDate; $('#dialog-title').textContent = 'タスクを追加'; form.querySelector('.add-button').textContent = '追加する'; $('#remove-repeat').hidden = true; }
function openDialog() { resetDialog(); dialog.showModal(); setTimeout(() => input.focus(), 80); }
function openEditDialog(task) { editingTaskId = task.id; input.value = task.title; $('#task-date').value = task.date; $('#start-time').value = task.startTime || ''; $('#end-time').value = task.endTime || ''; $('#repeat-select').value = task.recurrence; $('#dialog-title').textContent = 'タスクを編集'; form.querySelector('.add-button').textContent = '保存する'; $('#remove-repeat').hidden = task.recurrence === 'none'; dialog.showModal(); setTimeout(() => input.focus(), 80); }
function closeDialog() { dialog.close(); resetDialog(); }
function showCompletionEffect() { const effect = document.createElement('div'); effect.className = 'completion-effect'; effect.setAttribute('aria-hidden', 'true'); effect.innerHTML = '<span>✓</span><i></i><i></i><i></i><i></i><i></i><i></i><b>完了！</b>'; document.body.append(effect); effect.addEventListener('animationend', event => { if (event.target === effect) effect.remove(); }); }

$('#open-add').addEventListener('click', openDialog); $('#close-dialog').addEventListener('click', closeDialog); dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
$('#previous-month').addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1); renderCalendar(); });
$('#next-month').addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1); renderCalendar(); });
$('#remove-repeat').addEventListener('click', () => { const task = tasks.find(item => item.id === editingTaskId); if (!task) return; task.recurrence = 'none'; task.date = selectedDate; task.doneDates = task.doneDates.filter(date => date === selectedDate); saveTasks(); closeDialog(); render(); });
$('#notification-button').addEventListener('click', async () => {
  if (!window.isSecureContext || !('Notification' in window)) { alert('通知を使うには、HTTPSで公開するか、localhostでアプリを開いてください。スマホではホーム画面に追加したPWAとして開くと利用できます。'); return; }
  if (Notification.permission === 'denied') { alert('通知がブロックされています。ブラウザまたは端末の設定から、このサイトの通知を許可してください。'); return; }
  await Notification.requestPermission(); updateNotificationButton(); checkOverdueTasks();
});
form.addEventListener('submit', event => {
  event.preventDefault(); const inline = parseInlineTime(input.value.trim()); const title = inline?.title || input.value.trim(); if (!title) return;
  const data = new FormData(form); const startTime = inline?.startTime || data.get('startTime'); const endTime = inline?.endTime || data.get('endTime');
  if (startTime && endTime && endTime <= startTime) { $('#end-time').setCustomValidity('終了時刻は開始時刻より後にしてください。'); $('#end-time').reportValidity(); return; } $('#end-time').setCustomValidity('');
  const existing = tasks.find(task => task.id === editingTaskId); const values = { title, date: data.get('date'), startTime, endTime, recurrence: data.get('recurrence') };
  if (existing) Object.assign(existing, values); else tasks.push({ id: crypto.randomUUID(), ...values, doneDates: [], createdAt: Date.now() });
  selectedDate = values.date; calendarDate = parseDate(values.date); saveTasks(); closeDialog(); render();
});
function setupTheme() { const saved = localStorage.getItem(THEME_KEY); if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); $('#theme-button').addEventListener('click', () => { const dark = document.documentElement.classList.toggle('dark'); localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); }); }
$('#today-label').textContent = 'タップして予定を追加'; setupTheme(); updateNotificationButton(); render(); checkOverdueTasks();
setInterval(() => { if (selectedDate === dateToISO(new Date())) { renderSchedule(); renderTasks(); } checkOverdueTasks(); }, 60_000);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
