import {
  supabase,
  STAGES,
  MODE_LABELS,
  getStageMeta,
  formatNumber,
  escapeHtml,
} from './config.js';

const els = {
  // Views
  authView: document.getElementById('admin-auth-view'),
  mainView: document.getElementById('admin-main-view'),

  // Auth
  loginForm: document.getElementById('admin-login-form'),
  emailInput: document.getElementById('admin-email'),
  passwordInput: document.getElementById('admin-password'),
  loginBtn: document.getElementById('admin-login-btn'),
  loginError: document.getElementById('admin-login-error'),
  userEmail: document.getElementById('admin-user-email'),
  logoutBtn: document.getElementById('admin-logout-btn'),

  // Tabs
  tabBtnSessions: document.getElementById('tab-btn-sessions'),
  tabBtnStudents: document.getElementById('tab-btn-students'),
  tabSessions: document.getElementById('tab-sessions'),
  tabStudents: document.getElementById('tab-students'),

  // Create session form
  createForm: document.getElementById('create-session-form'),
  inputWeekNo: document.getElementById('input-week-no'),
  inputMode: document.getElementById('input-mode'),
  inputStageId: document.getElementById('input-stage-id'),
  inputDurationSec: document.getElementById('input-duration-sec'),
  durationPresets: document.querySelectorAll('.duration-preset-btn'),
  inputPin: document.getElementById('input-pin'),
  btnRerollPin: document.getElementById('btn-reroll-pin'),
  inputSessionId: document.getElementById('input-session-id'),
  inputCloseOthers: document.getElementById('input-close-others'),
  btnCreateSession: document.getElementById('btn-create-session'),
  createFeedback: document.getElementById('create-session-feedback'),

  // Active hero
  activeHero: document.getElementById('active-session-hero'),
  noActiveSession: document.getElementById('no-active-session'),
  heroStageTitle: document.getElementById('hero-stage-title'),
  heroSessionMeta: document.getElementById('hero-session-meta'),
  heroSessionId: document.getElementById('hero-session-id'),
  heroPin: document.getElementById('hero-pin'),
  btnCopyPin: document.getElementById('btn-copy-pin'),
  btnCloseActive: document.getElementById('btn-close-active-session'),

  // Monitor
  monitorSessionLabel: document.getElementById('monitor-session-label'),
  monitorCountText: document.getElementById('monitor-count-text'),
  monitorProgressBar: document.getElementById('monitor-progress-bar'),
  monitorAutoRefresh: document.getElementById('monitor-auto-refresh'),
  btnRefreshMonitor: document.getElementById('btn-refresh-monitor'),
  monitorLastUpdated: document.getElementById('monitor-last-updated'),
  monitorShift1Grid: document.getElementById('monitor-shift1-grid'),
  monitorShift2Grid: document.getElementById('monitor-shift2-grid'),
  monitorShift1Count: document.getElementById('monitor-shift1-count'),
  monitorShift2Count: document.getElementById('monitor-shift2-count'),

  // Past sessions
  filterPastMode: document.getElementById('filter-past-mode'),
  pastSessionsTbody: document.getElementById('past-sessions-tbody'),

  // Delete modal
  deleteModal: document.getElementById('delete-log-modal'),
  deleteDesc: document.getElementById('delete-log-desc'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete-log'),
  btnCancelDelete: document.getElementById('btn-cancel-delete-log'),

  // Students manager
  btnSaveAllStudents: document.getElementById('btn-save-all-students'),
  studentsSaveFeedback: document.getElementById('students-save-feedback'),
  studentsTbody: document.getElementById('students-tbody'),
  bulkTextarea: document.getElementById('bulk-paste-textarea'),
  btnBulkPreview: document.getElementById('btn-bulk-preview'),
  btnBulkApply: document.getElementById('btn-bulk-apply'),
  bulkStatus: document.getElementById('bulk-paste-status'),
};

const state = {
  user: null,
  students: [],
  sessions: [],
  activeSession: null,
  monitoredSessionId: null,
  monitoredLogs: [],
  pollTimer: null,
  pendingDeleteLog: null,
};

// ============================================================================
// Helpers
// ============================================================================
function getLocalDateISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateRandomPin() {
  const activePins = new Set(state.sessions.filter((s) => s.is_active).map((s) => s.session_pin));
  for (let i = 0; i < 30; i += 1) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!activePins.has(candidate)) return candidate;
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateSessionId() {
  const week = String(Number(els.inputWeekNo.value || 0)).padStart(2, '0');
  const mode = els.inputMode.value || 'PRACTICE';
  const stage = els.inputStageId.value || 'STAGE_1';
  const dateCompact = getLocalDateISO().replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `W${week}_${mode}_${stage}_${dateCompact}_${rand}`;
}

function showBanner(el, variant, message) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    error: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
  };
  el.className = `text-xs font-bold px-3.5 py-2 rounded-xl ${styles[variant] || styles.info}`;
  el.textContent = message;
  el.classList.remove('hidden');
}

function formatDurationLabel(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} นาที` : `${m} นาที ${s} วิ`;
}

// ============================================================================
// Form Initialization
// ============================================================================
function populateStageDropdown() {
  els.inputStageId.innerHTML = STAGES.map(
    (s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`
  ).join('');
  els.inputStageId.value = 'STAGE_1';
}

function refreshGeneratedFields() {
  els.inputSessionId.value = generateSessionId();
}

function syncDurationPresetHighlight(sec) {
  els.durationPresets.forEach((btn) => {
    const isMatch = Number(btn.dataset.sec) === Number(sec);
    btn.className = isMatch
      ? 'duration-preset-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white transition'
      : 'duration-preset-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 transition';
  });
}

// ============================================================================
// Data Loading
// ============================================================================
async function loadStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('student_id, student_no, full_name, default_shift, is_iep_excluded')
    .order('student_no', { ascending: true });

  if (error) {
    showBanner(els.studentsSaveFeedback, 'error', `โหลดรายชื่อนักเรียนไม่สำเร็จ: ${error.message}`);
    return;
  }

  state.students = data || [];
  renderStudentsTable();
}

async function loadSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('session_id, session_date, week_no, mode, stage_id, session_pin, duration_sec, is_active')
    .order('session_date', { ascending: false })
    .order('week_no', { ascending: false })
    .order('session_id', { ascending: false });

  if (error) {
    showBanner(els.createFeedback, 'error', `โหลดรายการรอบการเล่นไม่สำเร็จ: ${error.message}`);
    return;
  }

  state.sessions = data || [];
  state.activeSession = state.sessions.find((s) => s.is_active) || null;

  // Keep monitored session pointed at active session if none chosen or if active changed
  if (!state.monitoredSessionId || !state.sessions.some((s) => s.session_id === state.monitoredSessionId)) {
    state.monitoredSessionId = state.activeSession?.session_id || state.sessions[0]?.session_id || null;
  }

  renderActiveHero();
  renderPastSessionsTable();
  await loadMonitorLogs();
}

async function loadMonitorLogs() {
  if (!state.monitoredSessionId) {
    state.monitoredLogs = [];
    renderLiveMonitor();
    return;
  }

  const { data, error } = await supabase
    .from('typing_logs')
    .select('log_id, created_at, session_id, student_id, student_no, shift_no, net_wpm, accuracy_pct, words_completed, device_tag')
    .eq('session_id', state.monitoredSessionId);

  if (error) return;
  state.monitoredLogs = data || [];
  els.monitorLastUpdated.textContent = `อัปเดตล่าสุด ${new Date().toLocaleTimeString('th-TH')}`;
  renderLiveMonitor();
}

// ============================================================================
// Rendering: Active Hero, Live Monitor & Past Sessions
// ============================================================================
function renderActiveHero() {
  const active = state.activeSession;
  if (!active) {
    els.activeHero.classList.add('hidden');
    els.noActiveSession.classList.remove('hidden');
    return;
  }

  const stageMeta = getStageMeta(active.stage_id);
  const modeLabel = MODE_LABELS[active.mode] || active.mode;

  els.noActiveSession.classList.add('hidden');
  els.activeHero.classList.remove('hidden');
  els.heroStageTitle.textContent = stageMeta.title;
  els.heroSessionMeta.textContent = `สัปดาห์ที่ ${active.week_no} • ${modeLabel} • ⏱️ ${formatDurationLabel(active.duration_sec)} • วันที่ ${active.session_date}`;
  els.heroSessionId.textContent = `Session ID: ${active.session_id}`;
  els.heroPin.textContent = active.session_pin;
}

function renderLiveMonitor() {
  const session = state.sessions.find((s) => s.session_id === state.monitoredSessionId);
  if (!session) {
    els.monitorSessionLabel.textContent = 'ยังไม่ได้เลือกรอบการเล่น';
    els.monitorCountText.textContent = `ส่งแล้ว 0 / ${state.students.length || 22} คน`;
    els.monitorProgressBar.style.width = '0%';
    els.monitorShift1Grid.innerHTML = '';
    els.monitorShift2Grid.innerHTML = '';
    return;
  }

  const stageMeta = getStageMeta(session.stage_id);
  const modeLabel = MODE_LABELS[session.mode] || session.mode;
  const statusTag = session.is_active ? '🟢 กำลังเปิด' : '⚪ ปิดแล้ว';
  els.monitorSessionLabel.textContent = `${statusTag} • สัปดาห์ที่ ${session.week_no} (${modeLabel}) • ${stageMeta.shortTitle} • PIN: ${session.session_pin}`;

  const logByStudent = new Map(state.monitoredLogs.map((l) => [l.student_id, l]));
  const totalStudents = state.students.length || 22;
  const submittedCount = state.students.filter((st) => logByStudent.has(st.student_id)).length;
  const pct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  els.monitorCountText.textContent = `ส่งแล้ว ${submittedCount} / ${totalStudents} คน`;
  els.monitorProgressBar.style.width = `${pct}%`;

  const shift1 = state.students.filter((s) => (s.default_shift ?? (s.student_no <= 11 ? 1 : 2)) === 1);
  const shift2 = state.students.filter((s) => (s.default_shift ?? (s.student_no <= 11 ? 1 : 2)) === 2);

  const s1Done = shift1.filter((s) => logByStudent.has(s.student_id)).length;
  const s2Done = shift2.filter((s) => logByStudent.has(s.student_id)).length;
  els.monitorShift1Count.textContent = `${s1Done}/${shift1.length}`;
  els.monitorShift2Count.textContent = `${s2Done}/${shift2.length}`;

  const renderCards = (container, list) => {
    container.innerHTML = '';
    for (const student of list) {
      const log = logByStudent.get(student.student_id);
      const card = document.createElement('div');

      if (log) {
        card.className = 'p-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 flex flex-col justify-between gap-2';
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">${escapeHtml(student.student_no)}</span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 text-sm truncate">${escapeHtml(student.full_name)}</div>
                <div class="text-[11px] font-semibold text-emerald-700">✓ ส่งแล้ว • ${escapeHtml(log.device_tag || '-')}</div>
              </div>
            </div>
            <button type="button" data-delete-log="${escapeHtml(log.log_id)}" class="shrink-0 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 px-2 py-0.5 rounded-lg transition">
              ลบเพื่อสอบใหม่
            </button>
          </div>
          <div class="flex items-center gap-2 text-xs font-bold">
            <span class="px-2 py-0.5 rounded-md bg-white text-blue-700 border border-blue-100">${formatNumber(log.net_wpm, 1)} WPM</span>
            <span class="px-2 py-0.5 rounded-md bg-white text-emerald-700 border border-emerald-100">Acc ${formatNumber(log.accuracy_pct, 1)}%</span>
          </div>
        `;
        card.querySelector('[data-delete-log]').addEventListener('click', () => {
          openDeleteModal(student, log);
        });
      } else {
        card.className = 'p-3 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2';
        card.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">${escapeHtml(student.student_no)}</span>
            <span class="font-semibold text-slate-600 text-sm truncate">${escapeHtml(student.full_name)}</span>
          </div>
          <span class="shrink-0 text-[11px] font-semibold text-slate-400">รอส่งคะแนน</span>
        `;
      }

      container.appendChild(card);
    }
  };

  renderCards(els.monitorShift1Grid, shift1);
  renderCards(els.monitorShift2Grid, shift2);
}

function renderPastSessionsTable() {
  const modeFilter = els.filterPastMode.value;
  const rows = state.sessions.filter((s) => modeFilter === 'ALL' || s.mode === modeFilter);

  if (rows.length === 0) {
    els.pastSessionsTbody.innerHTML = `
      <tr><td colspan="8" class="py-8 text-center text-slate-400 text-sm">ยังไม่มีประวัติรอบการเล่น</td></tr>
    `;
    return;
  }

  els.pastSessionsTbody.innerHTML = '';
  for (const s of rows) {
    const meta = getStageMeta(s.stage_id);
    const isMonitored = s.session_id === state.monitoredSessionId;
    const modeColor =
      s.mode === 'PRETEST'
        ? 'bg-purple-100 text-purple-700'
        : s.mode === 'POSTTEST'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-sky-100 text-sky-700';

    const tr = document.createElement('tr');
    tr.className = isMonitored ? 'bg-blue-50/60' : 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-slate-800">สัปดาห์ ${escapeHtml(s.week_no)}</td>
      <td class="py-2.5 px-3 text-slate-600 text-xs">${escapeHtml(s.session_date)}</td>
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${modeColor}">${escapeHtml(s.mode)}</span></td>
      <td class="py-2.5 px-3 font-medium text-slate-700">${escapeHtml(meta.shortTitle)}</td>
      <td class="py-2.5 px-3 font-mono font-extrabold text-slate-900">${escapeHtml(s.session_pin)}</td>
      <td class="py-2.5 px-3 text-xs text-slate-600">${formatDurationLabel(s.duration_sec)}</td>
      <td class="py-2.5 px-3">
        ${
          s.is_active
            ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">● เปิดอยู่</span>'
            : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">ปิดแล้ว</span>'
        }
      </td>
      <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
        <button type="button" data-view-session="${escapeHtml(s.session_id)}" class="px-2.5 py-1 rounded-lg text-xs font-bold ${isMonitored ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700'} transition">
          ${isMonitored ? 'กำลังดู' : 'ดูผลรอบนี้'}
        </button>
        <button type="button" data-toggle-session="${escapeHtml(s.session_id)}" class="px-2.5 py-1 rounded-lg text-xs font-bold ${s.is_active ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} transition">
          ${s.is_active ? 'ปิดรอบ' : 'เปิดอีกครั้ง'}
        </button>
      </td>
    `;

    tr.querySelector('[data-view-session]').addEventListener('click', async () => {
      state.monitoredSessionId = s.session_id;
      renderPastSessionsTable();
      await loadMonitorLogs();
    });

    tr.querySelector('[data-toggle-session]').addEventListener('click', async () => {
      await toggleSessionActive(s);
    });

    els.pastSessionsTbody.appendChild(tr);
  }
}

// ============================================================================
// Actions: Create / Toggle Session & Delete Log
// ============================================================================
async function handleCreateSession(e) {
  e.preventDefault();
  const weekNo = Number(els.inputWeekNo.value);
  const mode = els.inputMode.value;
  const stageId = els.inputStageId.value;
  const durationSec = Number(els.inputDurationSec.value);
  const pin = els.inputPin.value.trim();
  const sessionId = generateSessionId();

  if (!/^\d{4}$/.test(pin)) {
    showBanner(els.createFeedback, 'error', 'รหัส PIN ต้องเป็นตัวเลข 4 หลัก');
    return;
  }
  if (durationSec < 30 || durationSec > 1800) {
    showBanner(els.createFeedback, 'error', 'ระยะเวลาต้องอยู่ระหว่าง 30 ถึง 1800 วินาที');
    return;
  }

  els.btnCreateSession.disabled = true;
  els.btnCreateSession.textContent = 'กำลังเปิดรอบการเล่น...';

  try {
    if (els.inputCloseOthers.checked) {
      await supabase.from('sessions').update({ is_active: false }).eq('is_active', true);
    }

    const { error } = await supabase.from('sessions').insert({
      session_id: sessionId,
      session_date: getLocalDateISO(),
      week_no: weekNo,
      mode,
      stage_id: stageId,
      session_pin: pin,
      duration_sec: durationSec,
      is_active: true,
    });

    if (error) throw error;

    state.monitoredSessionId = sessionId;
    showBanner(els.createFeedback, 'success', `✓ เปิดรอบสำเร็จ! PIN: ${pin}`);
    els.inputPin.value = generateRandomPin();
    refreshGeneratedFields();
    await loadSessions();
  } catch (err) {
    showBanner(els.createFeedback, 'error', `เปิดรอบไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnCreateSession.disabled = false;
    els.btnCreateSession.textContent = '🚀 เปิดรอบการเล่นทันที';
  }
}

async function toggleSessionActive(session) {
  const nextActive = !session.is_active;
  const { error } = await supabase
    .from('sessions')
    .update({ is_active: nextActive })
    .eq('session_id', session.session_id);

  if (error) {
    showBanner(els.createFeedback, 'error', `อัปเดตสถานะไม่สำเร็จ: ${error.message}`);
    return;
  }

  if (nextActive) {
    state.monitoredSessionId = session.session_id;
  }
  await loadSessions();
}

function openDeleteModal(student, log) {
  state.pendingDeleteLog = { student, log };
  els.deleteDesc.innerHTML = `
    ต้องการลบคะแนนของ <strong>เลขที่ ${escapeHtml(student.student_no)} — ${escapeHtml(student.full_name)}</strong>
    (${formatNumber(log.net_wpm, 2)} WPM, ความแม่นยำ ${formatNumber(log.accuracy_pct, 2)}%) ใช่หรือไม่?<br/>
    <span class="text-xs text-slate-500 mt-1 inline-block">หลังจากลบแล้ว นักเรียนจะสามารถเลือกชื่อตนเองเพื่อสอบใหม่ในรอบนี้ได้ทันที</span>
  `;
  els.deleteModal.classList.remove('hidden');
}

async function confirmDeleteLog() {
  if (!state.pendingDeleteLog) return;
  const { log } = state.pendingDeleteLog;
  els.btnConfirmDelete.disabled = true;
  els.btnConfirmDelete.textContent = 'กำลังลบ...';

  try {
    const { error } = await supabase.from('typing_logs').delete().eq('log_id', log.log_id);
    if (error) throw error;
    els.deleteModal.classList.add('hidden');
    state.pendingDeleteLog = null;
    await loadMonitorLogs();
  } catch (err) {
    alert(`ลบคะแนนไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnConfirmDelete.disabled = false;
    els.btnConfirmDelete.textContent = 'ลบคะแนนนี้';
  }
}

// ============================================================================
// Tab 2: Student Roster Manager (22 Students + Bulk Paste)
// ============================================================================
function renderStudentsTable() {
  els.studentsTbody.innerHTML = '';
  for (const st of state.students) {
    const tr = document.createElement('tr');
    tr.dataset.studentId = st.student_id;
    tr.className = 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="py-2 px-2.5 font-extrabold text-slate-700">${escapeHtml(st.student_no)}</td>
      <td class="py-2 px-2.5"><span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(st.student_id)}</span></td>
      <td class="py-2 px-2.5">
        <input type="text" data-field="full_name" value="${escapeHtml(st.full_name)}" class="w-full min-w-[180px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-medium focus:border-blue-500 outline-none" />
      </td>
      <td class="py-2 px-2.5">
        <select data-field="default_shift" class="px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white outline-none">
          <option value="1" ${st.default_shift === 1 ? 'selected' : ''}>ผลัด 1</option>
          <option value="2" ${st.default_shift === 2 ? 'selected' : ''}>ผลัด 2</option>
        </select>
      </td>
      <td class="py-2 px-2.5 text-center">
        <input type="checkbox" data-field="is_iep_excluded" ${st.is_iep_excluded ? 'checked' : ''} class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer" />
      </td>
      <td class="py-2 px-2.5 text-right">
        <button type="button" data-save-row="${escapeHtml(st.student_id)}" class="px-3 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-xs transition">
          บันทึก
        </button>
      </td>
    `;

    tr.querySelector('[data-save-row]').addEventListener('click', () => saveSingleStudentRow(tr, st.student_id));
    els.studentsTbody.appendChild(tr);
  }
}

function readRowValues(tr, studentId) {
  const original = state.students.find((s) => s.student_id === studentId);
  return {
    student_id: studentId,
    student_no: original.student_no,
    full_name: tr.querySelector('[data-field="full_name"]').value.trim() || original.full_name,
    default_shift: Number(tr.querySelector('[data-field="default_shift"]').value),
    is_iep_excluded: tr.querySelector('[data-field="is_iep_excluded"]').checked,
  };
}

async function saveSingleStudentRow(tr, studentId) {
  const btn = tr.querySelector('[data-save-row]');
  const rowData = readRowValues(tr, studentId);
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const { error } = await supabase
      .from('students')
      .update({
        full_name: rowData.full_name,
        default_shift: rowData.default_shift,
        is_iep_excluded: rowData.is_iep_excluded,
      })
      .eq('student_id', studentId);

    if (error) throw error;
    const idx = state.students.findIndex((s) => s.student_id === studentId);
    if (idx !== -1) state.students[idx] = rowData;
    showBanner(els.studentsSaveFeedback, 'success', `✓ บันทึกข้อมูลเลขที่ ${rowData.student_no} (${rowData.full_name}) เรียบร้อยแล้ว`);
    renderLiveMonitor();
  } catch (err) {
    showBanner(els.studentsSaveFeedback, 'error', `บันทึกไม่สำเร็จ: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'บันทึก';
  }
}

async function saveAllStudents() {
  const rows = Array.from(els.studentsTbody.querySelectorAll('tr[data-student-id]'));
  const updates = rows.map((tr) => readRowValues(tr, tr.dataset.studentId));
  if (updates.length === 0) return;

  els.btnSaveAllStudents.disabled = true;
  els.btnSaveAllStudents.textContent = 'กำลังบันทึก...';

  try {
    const { error } = await supabase.from('students').upsert(updates, { onConflict: 'student_id' });
    if (error) throw error;
    state.students = updates;
    showBanner(els.studentsSaveFeedback, 'success', `✓ บันทึกรายชื่อนักเรียนทั้งหมด ${updates.length} คนเรียบร้อยแล้ว`);
    renderLiveMonitor();
  } catch (err) {
    showBanner(els.studentsSaveFeedback, 'error', `บันทึกทั้งหมดไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnSaveAllStudents.disabled = false;
    els.btnSaveAllStudents.textContent = '💾 บันทึกทั้งหมด (Save All)';
  }
}

function parseBulkNames(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Handle Excel paste with "1\tด.ช.สมชาย" or "1. ด.ช.สมชาย"
      if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
        const nonNumeric = parts.find((p) => !/^\d+\.?$/.test(p));
        return nonNumeric || parts[parts.length - 1];
      }
      return line.replace(/^\d+[\.\)\s]+/, '').trim();
    })
    .filter(Boolean);
}

function applyBulkNamesToInputs(names) {
  const rows = Array.from(els.studentsTbody.querySelectorAll('tr[data-student-id]'));
  const count = Math.min(names.length, rows.length);
  for (let i = 0; i < count; i += 1) {
    const input = rows[i].querySelector('[data-field="full_name"]');
    if (input) input.value = names[i];
  }
  return count;
}

// ============================================================================
// Auto-Refresh Polling & Auth Lifecycle
// ============================================================================
function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(() => {
    if (state.user && els.monitorAutoRefresh.checked && !els.tabSessions.classList.contains('hidden')) {
      loadMonitorLogs();
    }
  }, 5000);
}

function stopPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function switchTab(tab) {
  const isSessions = tab === 'sessions';
  els.tabSessions.classList.toggle('hidden', !isSessions);
  els.tabStudents.classList.toggle('hidden', isSessions);

  els.tabBtnSessions.className = isSessions
    ? 'px-4 py-2.5 text-sm font-bold border-b-2 border-blue-600 text-blue-700 transition'
    : 'px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition';
  els.tabBtnStudents.className = !isSessions
    ? 'px-4 py-2.5 text-sm font-bold border-b-2 border-blue-600 text-blue-700 transition'
    : 'px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition';
}

async function enterAdminPanel(user) {
  state.user = user;
  els.userEmail.textContent = user.email || '';
  els.authView.classList.add('hidden');
  els.mainView.classList.remove('hidden');

  await loadStudents();
  await loadSessions();
  els.inputPin.value = generateRandomPin();
  refreshGeneratedFields();
  startPolling();
}

function enterLoginView() {
  state.user = null;
  stopPolling();
  els.mainView.classList.add('hidden');
  els.authView.classList.remove('hidden');
}

// ============================================================================
// Event Bindings & Init
// ============================================================================
function bindEvents() {
  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.loginBtn.disabled = true;
    els.loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
    els.loginError.classList.add('hidden');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: els.emailInput.value.trim(),
        password: els.passwordInput.value,
      });
      if (error) throw error;
      if (data?.user) {
        await enterAdminPanel(data.user);
      }
    } catch (err) {
      els.loginError.textContent = err.message === 'Invalid login credentials'
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : `เข้าสู่ระบบไม่สำเร็จ: ${err.message}`;
      els.loginError.classList.remove('hidden');
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'เข้าสู่ระบบ';
    }
  });

  els.logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    enterLoginView();
  });

  // Tabs
  els.tabBtnSessions.addEventListener('click', () => switchTab('sessions'));
  els.tabBtnStudents.addEventListener('click', () => switchTab('students'));

  // Session form helpers
  els.inputMode.addEventListener('change', () => {
    const mode = els.inputMode.value;
    if (mode === 'PRETEST') {
      els.inputStageId.value = 'PRETEST_A';
    } else if (mode === 'POSTTEST') {
      els.inputStageId.value = 'POSTTEST_A';
    } else if (!els.inputStageId.value.startsWith('STAGE_')) {
      els.inputStageId.value = 'STAGE_1';
    }
    refreshGeneratedFields();
  });

  els.inputWeekNo.addEventListener('input', refreshGeneratedFields);
  els.inputStageId.addEventListener('change', refreshGeneratedFields);

  els.durationPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.inputDurationSec.value = btn.dataset.sec;
      syncDurationPresetHighlight(btn.dataset.sec);
    });
  });

  els.inputDurationSec.addEventListener('input', () => {
    syncDurationPresetHighlight(els.inputDurationSec.value);
  });

  els.inputPin.addEventListener('input', () => {
    els.inputPin.value = els.inputPin.value.replace(/\D/g, '').slice(0, 4);
  });

  els.btnRerollPin.addEventListener('click', () => {
    els.inputPin.value = generateRandomPin();
  });

  els.createForm.addEventListener('submit', handleCreateSession);

  // Active Hero actions
  els.btnCopyPin.addEventListener('click', async () => {
    const pin = state.activeSession?.session_pin;
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      els.btnCopyPin.textContent = '✓ คัดลอกแล้ว';
      setTimeout(() => {
        els.btnCopyPin.textContent = '📋 คัดลอก PIN';
      }, 1500);
    } catch {
      // Fallback ignored
    }
  });

  els.btnCloseActive.addEventListener('click', async () => {
    if (!state.activeSession) return;
    if (!confirm(`ยืนยันการปิดรอบการเล่น PIN ${state.activeSession.session_pin}?`)) return;
    await toggleSessionActive(state.activeSession);
  });

  // Monitor actions
  els.btnRefreshMonitor.addEventListener('click', () => loadMonitorLogs());
  els.filterPastMode.addEventListener('change', () => renderPastSessionsTable());

  // Delete modal
  els.btnCancelDelete.addEventListener('click', () => {
    state.pendingDeleteLog = null;
    els.deleteModal.classList.add('hidden');
  });
  els.deleteModal.addEventListener('click', (e) => {
    if (e.target === els.deleteModal) {
      state.pendingDeleteLog = null;
      els.deleteModal.classList.add('hidden');
    }
  });
  els.btnConfirmDelete.addEventListener('click', confirmDeleteLog);

  // Students manager
  els.btnSaveAllStudents.addEventListener('click', saveAllStudents);

  els.btnBulkPreview.addEventListener('click', () => {
    const names = parseBulkNames(els.bulkTextarea.value);
    if (names.length === 0) {
      showBanner(els.bulkStatus, 'error', 'กรุณาวางรายชื่ออย่างน้อย 1 บรรทัด');
      return;
    }
    const filled = applyBulkNamesToInputs(names);
    showBanner(els.bulkStatus, 'info', `เติมรายชื่อลงตารางแล้ว ${filled} คน กรุณาตรวจสอบแล้วกด "บันทึกทั้งหมด"`);
  });

  els.btnBulkApply.addEventListener('click', async () => {
    const names = parseBulkNames(els.bulkTextarea.value);
    if (names.length === 0) {
      showBanner(els.bulkStatus, 'error', 'กรุณาวางรายชื่ออย่างน้อย 1 บรรทัด');
      return;
    }
    const filled = applyBulkNamesToInputs(names);
    await saveAllStudents();
    showBanner(els.bulkStatus, 'success', `✓ อัปเดตรายชื่อ ${filled} คนลงฐานข้อมูลเรียบร้อยแล้ว`);
  });
}

async function init() {
  populateStageDropdown();
  syncDurationPresetHighlight(300);
  bindEvents();

  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await enterAdminPanel(data.session.user);
  } else {
    enterLoginView();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user && state.user) {
      enterLoginView();
    }
  });
}

init();
