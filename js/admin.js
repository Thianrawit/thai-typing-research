import {
  supabase,
  STAGES,
  MODE_LABELS,
  getStageMeta,
  formatNumber,
  escapeHtml,
  getShiftGroupMeta,
} from './config.js';
import { icon } from './icons.js';

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
  tabStudentsLabel: document.getElementById('tab-students-label'),
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
  btnDeleteActive: document.getElementById('btn-delete-active-session'),

  // Monitor
  monitorHeadingLabel: document.getElementById('monitor-heading-label'),
  monitorSessionLabel: document.getElementById('monitor-session-label'),
  monitorCountText: document.getElementById('monitor-count-text'),
  monitorProgressBar: document.getElementById('monitor-progress-bar'),
  monitorAutoRefresh: document.getElementById('monitor-auto-refresh'),
  btnRefreshMonitor: document.getElementById('btn-refresh-monitor'),
  monitorLastUpdated: document.getElementById('monitor-last-updated'),
  monitorShift1Title: document.getElementById('monitor-shift1-title'),
  monitorShift2Title: document.getElementById('monitor-shift2-title'),
  monitorShift1Grid: document.getElementById('monitor-shift1-grid'),
  monitorShift2Grid: document.getElementById('monitor-shift2-grid'),
  monitorShift1Count: document.getElementById('monitor-shift1-count'),
  monitorShift2Count: document.getElementById('monitor-shift2-count'),

  // Past sessions
  filterPastMode: document.getElementById('filter-past-mode'),
  pastSessionsTbody: document.getElementById('past-sessions-tbody'),

  // Delete log modal
  deleteModal: document.getElementById('delete-log-modal'),
  deleteDesc: document.getElementById('delete-log-desc'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete-log'),
  btnCancelDelete: document.getElementById('btn-cancel-delete-log'),

  // Delete session modal
  deleteSessionModal: document.getElementById('delete-session-modal'),
  deleteSessionDesc: document.getElementById('delete-session-desc'),
  btnConfirmDeleteSession: document.getElementById('btn-confirm-delete-session'),
  btnCancelDeleteSession: document.getElementById('btn-cancel-delete-session'),

  // Delete student modal
  deleteStudentModal: document.getElementById('delete-student-modal'),
  deleteStudentDesc: document.getElementById('delete-student-desc'),
  inputDeleteStudentRebalance: document.getElementById('input-delete-student-rebalance'),
  btnConfirmDeleteStudent: document.getElementById('btn-confirm-delete-student'),
  btnCancelDeleteStudent: document.getElementById('btn-cancel-delete-student'),

  // Students manager
  addStudentForm: document.getElementById('add-student-form'),
  inputNewStudentName: document.getElementById('input-new-student-name'),
  inputNewStudentShift: document.getElementById('input-new-student-shift'),
  inputNewStudentIep: document.getElementById('input-new-student-iep'),
  btnAddStudent: document.getElementById('btn-add-student'),
  studentsHeadingTitle: document.getElementById('students-heading-title'),
  btnSaveAllStudents: document.getElementById('btn-save-all-students'),
  reorderBar: document.getElementById('reorder-bar'),
  reorderStatusText: document.getElementById('reorder-status-text'),
  inputReorderRebalance: document.getElementById('input-reorder-rebalance'),
  btnSaveOrder: document.getElementById('btn-save-order'),
  studentsSaveFeedback: document.getElementById('students-save-feedback'),
  studentsTbody: document.getElementById('students-tbody'),
  bulkPasteDesc: document.getElementById('bulk-paste-desc'),
  bulkTextarea: document.getElementById('bulk-paste-textarea'),
  btnBulkPreview: document.getElementById('btn-bulk-preview'),
  btnBulkApply: document.getElementById('btn-bulk-apply'),
  bulkStatus: document.getElementById('bulk-paste-status'),
};

const state = {
  user: null,
  students: [],
  orderDirty: false,
  sessions: [],
  activeSession: null,
  monitoredSessionId: null,
  monitoredLogs: [],
  pollTimer: null,
  pendingDeleteLog: null,
  pendingDeleteSession: null,
  pendingDeleteStudent: null,
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
  const iconName = variant === 'success' ? 'checkCircle' : variant === 'error' ? 'alertTriangle' : 'check';
  el.className = `inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl ${styles[variant] || styles.info}`;
  el.innerHTML = `${icon(iconName, 'w-4 h-4')}<span>${escapeHtml(message)}</span>`;
  el.classList.remove('hidden');
}

function formatDurationLabel(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} นาที` : `${m} นาที ${s} วิ`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

async function handleCopyButtonFeedback(button, textToCopy, idleHtml) {
  if (!textToCopy) return;
  try {
    await copyTextToClipboard(textToCopy);
    button.innerHTML = `${icon('check', 'w-4 h-4 text-emerald-600')}<span>คัดลอกแล้ว</span>`;
    clearTimeout(button._copyTimer);
    button._copyTimer = setTimeout(() => {
      button.innerHTML = idleHtml;
    }, 1800);
  } catch {
    // Clipboard unavailable
  }
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
function updateDynamicRosterLabels() {
  const n = state.students.length;
  els.tabStudentsLabel.textContent = `จัดการรายชื่อนักเรียน (${n} คน)`;
  els.monitorHeadingLabel.textContent = `ติดตามการส่งคะแนนแบบสด (${n} คน)`;
  els.studentsHeadingTitle.textContent = `รายชื่อนักเรียนชั้น ป.6 (${n} คน)`;
  els.bulkPasteDesc.textContent =
    n > 0
      ? `คัดลอกรายชื่อนักเรียนสูงสุด ${n} บรรทัดจาก Excel หรือ Word มาวางด้านล่าง ระบบจะเรียงใส่เลขที่ 1–${n} ให้อัตโนมัติ (รองรับทั้งแบบมีเลขที่นำหน้าและเฉพาะชื่อ)`
      : 'ยังไม่มีรายชื่อนักเรียนในระบบ กรุณาเพิ่มนักเรียนด้านบนก่อนใช้งานการวางรายชื่อแบบกลุ่ม';
  els.btnBulkApply.textContent = n > 0 ? `อัปเดตทันที (${n} คน)` : 'อัปเดตทันที';
}

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
  state.orderDirty = false;
  updateDynamicRosterLabels();
  renderStudentsTable();
  updateReorderBarUI();
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
  els.heroSessionMeta.innerHTML = `
    <span>สัปดาห์ที่ ${escapeHtml(active.week_no)}</span>
    <span>•</span>
    <span>${escapeHtml(modeLabel)}</span>
    <span>•</span>
    <span class="inline-flex items-center gap-1">${icon('clock', 'w-3.5 h-3.5')}<span>${escapeHtml(formatDurationLabel(active.duration_sec))}</span></span>
    <span>•</span>
    <span>วันที่ ${escapeHtml(active.session_date)}</span>
  `;
  els.heroSessionId.textContent = `Session ID: ${active.session_id}`;
  els.heroPin.textContent = active.session_pin;
}

function renderLiveMonitor() {
  const totalStudents = state.students.length;
  const shift1Meta = getShiftGroupMeta(state.students, 1);
  const shift2Meta = getShiftGroupMeta(state.students, 2);

  els.monitorShift1Title.textContent = shift1Meta.title;
  els.monitorShift2Title.textContent = shift2Meta.title;

  const session = state.sessions.find((s) => s.session_id === state.monitoredSessionId);
  if (!session) {
    els.monitorSessionLabel.textContent = 'ยังไม่ได้เลือกรอบการเล่น';
    els.monitorCountText.textContent = `ส่งแล้ว 0 / ${totalStudents} คน`;
    els.monitorProgressBar.style.width = '0%';
    els.monitorShift1Count.textContent = `0/${shift1Meta.count}`;
    els.monitorShift2Count.textContent = `0/${shift2Meta.count}`;
    els.monitorShift1Grid.innerHTML = '';
    els.monitorShift2Grid.innerHTML = '';
    return;
  }

  const stageMeta = getStageMeta(session.stage_id);
  const modeLabel = MODE_LABELS[session.mode] || session.mode;
  const statusBadge = session.is_active
    ? `<span class="inline-flex items-center gap-1 text-emerald-700 font-bold"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>กำลังเปิด</span>`
    : `<span class="inline-flex items-center gap-1 text-slate-500 font-bold"><span class="w-2 h-2 rounded-full bg-slate-400"></span>ปิดแล้ว</span>`;
  els.monitorSessionLabel.innerHTML = `${statusBadge} <span>• สัปดาห์ที่ ${escapeHtml(session.week_no)} (${escapeHtml(modeLabel)}) • ${escapeHtml(stageMeta.shortTitle)} • PIN: ${escapeHtml(session.session_pin)}</span>`;

  const logByStudent = new Map(state.monitoredLogs.map((l) => [l.student_id, l]));
  const submittedCount = state.students.filter((st) => logByStudent.has(st.student_id)).length;
  const pct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  els.monitorCountText.textContent = `ส่งแล้ว ${submittedCount} / ${totalStudents} คน`;
  els.monitorProgressBar.style.width = `${pct}%`;

  const s1Done = shift1Meta.list.filter((s) => logByStudent.has(s.student_id)).length;
  const s2Done = shift2Meta.list.filter((s) => logByStudent.has(s.student_id)).length;
  els.monitorShift1Count.textContent = `${s1Done}/${shift1Meta.count}`;
  els.monitorShift2Count.textContent = `${s2Done}/${shift2Meta.count}`;

  const renderCards = (container, list) => {
    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<div class="col-span-full text-center py-4 text-xs text-slate-400">ไม่มีนักเรียนในผลัดนี้</div>';
      return;
    }
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
                <div class="font-bold text-slate-900 text-sm whitespace-normal break-words leading-snug">${escapeHtml(student.full_name)}</div>
                <div class="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">${icon('check', 'w-3 h-3')}<span>ส่งแล้ว • ${escapeHtml(log.device_tag || '-')}</span></div>
              </div>
            </div>
            <button type="button" data-delete-log="${escapeHtml(log.log_id)}" class="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 px-2 py-0.5 rounded-lg transition">
              ${icon('trash2', 'w-3 h-3')}
              <span>ลบเพื่อสอบใหม่</span>
            </button>
          </div>
          <div class="flex items-center gap-2 text-xs font-bold">
            <span class="px-2 py-0.5 rounded-md bg-white text-blue-700 border border-blue-100">${formatNumber(log.net_wpm, 1)} WPM</span>
            <span class="px-2 py-0.5 rounded-md bg-white text-emerald-700 border border-emerald-100">Acc ${formatNumber(log.accuracy_pct, 1)}%</span>
          </div>
        `;
        card.querySelector('[data-delete-log]').addEventListener('click', () => {
          openDeleteLogModal(student, log);
        });
      } else {
        card.className = 'p-3 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2';
        card.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">${escapeHtml(student.student_no)}</span>
            <span class="font-semibold text-slate-600 text-sm whitespace-normal break-words leading-snug">${escapeHtml(student.full_name)}</span>
          </div>
          <span class="shrink-0 text-[11px] font-semibold text-slate-400">รอส่งคะแนน</span>
        `;
      }

      container.appendChild(card);
    }
  };

  renderCards(els.monitorShift1Grid, shift1Meta.list);
  renderCards(els.monitorShift2Grid, shift2Meta.list);
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

    const copyBtnIdleHtml = `${icon('copy', 'w-3.5 h-3.5')}<span>คัดลอกรหัส</span>`;

    const tr = document.createElement('tr');
    tr.className = isMonitored ? 'bg-blue-50/60' : 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">สัปดาห์ ${escapeHtml(s.week_no)}</td>
      <td class="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">${escapeHtml(s.session_date)}</td>
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${modeColor}">${escapeHtml(s.mode)}</span></td>
      <td class="py-2.5 px-3 font-medium text-slate-700">${escapeHtml(meta.shortTitle)}</td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        <div class="inline-flex items-center gap-1.5">
          <span class="font-mono font-extrabold text-slate-900">${escapeHtml(s.session_pin)}</span>
          <button type="button" data-copy-pin="${escapeHtml(s.session_pin)}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 text-[11px] font-bold transition">
            ${copyBtnIdleHtml}
          </button>
        </div>
      </td>
      <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">${formatDurationLabel(s.duration_sec)}</td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        ${
          s.is_active
            ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>เปิดอยู่</span>'
            : '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>ปิดแล้ว</span>'
        }
      </td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <div class="inline-flex items-center gap-1.5">
          <button type="button" data-view-session="${escapeHtml(s.session_id)}" class="px-2.5 py-1 rounded-lg text-xs font-bold ${isMonitored ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700'} transition">
            ${isMonitored ? 'กำลังดู' : 'ดูผลรอบนี้'}
          </button>
          <button type="button" data-toggle-session="${escapeHtml(s.session_id)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${s.is_active ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} transition">
            ${s.is_active ? icon('lock', 'w-3.5 h-3.5') : icon('unlock', 'w-3.5 h-3.5')}
            <span>${s.is_active ? 'ปิดรอบ' : 'เปิดอีกครั้ง'}</span>
          </button>
          <button type="button" data-delete-session="${escapeHtml(s.session_id)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200 transition">
            ${icon('trash2', 'w-3.5 h-3.5')}
            <span>ลบรหัสรอบ</span>
          </button>
        </div>
      </td>
    `;

    const copyBtn = tr.querySelector('[data-copy-pin]');
    copyBtn.addEventListener('click', () => {
      handleCopyButtonFeedback(copyBtn, s.session_pin, copyBtnIdleHtml);
    });

    tr.querySelector('[data-view-session]').addEventListener('click', async () => {
      state.monitoredSessionId = s.session_id;
      renderPastSessionsTable();
      await loadMonitorLogs();
    });

    tr.querySelector('[data-toggle-session]').addEventListener('click', async () => {
      await toggleSessionActive(s);
    });

    tr.querySelector('[data-delete-session]').addEventListener('click', () => {
      openDeleteSessionModal(s);
    });

    els.pastSessionsTbody.appendChild(tr);
  }
}

// ============================================================================
// Actions: Create / Toggle / Delete Session & Delete Log
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
  els.btnCreateSession.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังเปิดรอบการเล่น...</span>`;

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
    showBanner(els.createFeedback, 'success', `เปิดรอบสำเร็จ! PIN: ${pin}`);
    els.inputPin.value = generateRandomPin();
    refreshGeneratedFields();
    await loadSessions();
  } catch (err) {
    showBanner(els.createFeedback, 'error', `เปิดรอบไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnCreateSession.disabled = false;
    els.btnCreateSession.innerHTML = `${icon('play', 'w-4 h-4')}<span>เปิดรอบการเล่นทันที</span>`;
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

function openDeleteLogModal(student, log) {
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
  els.btnConfirmDelete.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังลบ...</span>`;

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
    els.btnConfirmDelete.innerHTML = `${icon('trash2', 'w-4 h-4')}<span>ลบคะแนนนี้</span>`;
  }
}

function openDeleteSessionModal(session) {
  state.pendingDeleteSession = session;
  const meta = getStageMeta(session.stage_id);
  const modeLabel = MODE_LABELS[session.mode] || session.mode;
  els.deleteSessionDesc.innerHTML = `
    <p>คุณกำลังจะลบรอบการเล่นต่อไปนี้ออกจากฐานข้อมูล:</p>
    <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
      <div><strong>รหัสรอบ (Session ID):</strong> <span class="font-mono text-slate-800">${escapeHtml(session.session_id)}</span></div>
      <div><strong>รหัส PIN:</strong> <span class="font-mono font-extrabold text-rose-700 text-sm">${escapeHtml(session.session_pin)}</span></div>
      <div><strong>รายละเอียด:</strong> สัปดาห์ที่ ${escapeHtml(session.week_no)} • ${escapeHtml(modeLabel)} • ${escapeHtml(meta.shortTitle)}</div>
    </div>
  `;
  els.deleteSessionModal.classList.remove('hidden');
}

async function confirmDeleteSession() {
  if (!state.pendingDeleteSession) return;
  const target = state.pendingDeleteSession;
  els.btnConfirmDeleteSession.disabled = true;
  els.btnConfirmDeleteSession.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังลบรหัสรอบ...</span>`;

  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('session_id', target.session_id);

    if (error) throw error;

    if (state.monitoredSessionId === target.session_id) {
      state.monitoredSessionId = null;
    }
    els.deleteSessionModal.classList.add('hidden');
    state.pendingDeleteSession = null;
    showBanner(els.createFeedback, 'success', `ลบรหัสรอบ ${target.session_id} (PIN ${target.session_pin}) เรียบร้อยแล้ว`);
    await loadSessions();
  } catch (err) {
    alert(`ลบรหัสรอบไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnConfirmDeleteSession.disabled = false;
    els.btnConfirmDeleteSession.innerHTML = `${icon('trash2', 'w-4 h-4')}<span>ยืนยันลบรหัสรอบถาวร</span>`;
  }
}

// ============================================================================
// Tab 2: Student Roster Manager (Add / Reorder / Delete RPCs + Bulk Paste)
// NEVER updates student_no directly from client JS
// ============================================================================
function syncInputsIntoState() {
  const rows = Array.from(els.studentsTbody.querySelectorAll('tr[data-student-id]'));
  const byId = new Map(state.students.map((s) => [s.student_id, s]));
  for (const tr of rows) {
    const id = tr.dataset.studentId;
    const item = byId.get(id);
    if (!item) continue;
    const nameInput = tr.querySelector('[data-field="full_name"]');
    const shiftSelect = tr.querySelector('[data-field="default_shift"]');
    const iepInput = tr.querySelector('[data-field="is_iep_excluded"]');
    if (nameInput) item.full_name = nameInput.value.trim() || item.full_name;
    if (shiftSelect) item.default_shift = Number(shiftSelect.value);
    if (iepInput) item.is_iep_excluded = iepInput.checked;
  }
}

function updateReorderBarUI() {
  if (state.orderDirty) {
    els.reorderBar.className = 'flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 transition-colors';
    els.reorderStatusText.className = 'text-xs font-extrabold text-amber-900';
    els.reorderStatusText.textContent = 'ลำดับรายชื่อมีการเปลี่ยนแปลง! คลิก "บันทึกลำดับเลขที่ใหม่" เพื่ออัปเดตเลขที่และประวัติคะแนนให้ตรงกัน';
  } else {
    els.reorderBar.className = 'flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 transition-colors';
    els.reorderStatusText.className = 'text-xs font-bold text-slate-700';
    els.reorderStatusText.textContent = 'ใช้ปุ่มลูกศรขึ้น/ลงในตารางเพื่อสลับลำดับเลขที่ แล้วกดบันทึก';
  }
}

function moveStudentRow(index, delta) {
  const targetIdx = index + delta;
  if (targetIdx < 0 || targetIdx >= state.students.length) return;
  syncInputsIntoState();
  const [moved] = state.students.splice(index, 1);
  state.students.splice(targetIdx, 0, moved);
  state.orderDirty = true;
  renderStudentsTable();
  updateReorderBarUI();
}

function renderStudentsTable() {
  els.studentsTbody.innerHTML = '';
  const total = state.students.length;

  if (total === 0) {
    els.studentsTbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400 text-sm">ยังไม่มีรายชื่อนักเรียนในระบบ</td></tr>';
    return;
  }

  state.students.forEach((st, idx) => {
    const proposedNo = idx + 1;
    const isOrderChanged = state.orderDirty && proposedNo !== Number(st.student_no);
    const tr = document.createElement('tr');
    tr.dataset.studentId = st.student_id;
    tr.className = isOrderChanged ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50';

    tr.innerHTML = `
      <td class="py-2 px-2 whitespace-nowrap">
        <div class="inline-flex items-center gap-0.5">
          <button type="button" data-move-up="${idx}" ${idx === 0 ? 'disabled' : ''} title="เลื่อนขึ้น" class="p-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
            ${icon('arrowUp', 'w-3.5 h-3.5')}
          </button>
          <button type="button" data-move-down="${idx}" ${idx === total - 1 ? 'disabled' : ''} title="เลื่อนลง" class="p-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
            ${icon('arrowDown', 'w-3.5 h-3.5')}
          </button>
        </div>
      </td>
      <td class="py-2 px-2 font-extrabold whitespace-nowrap">
        ${
          isOrderChanged
            ? `<span class="text-slate-400 line-through text-xs mr-1">${escapeHtml(st.student_no)}</span><span class="text-indigo-700">${proposedNo}</span>`
            : `<span class="text-slate-700">${escapeHtml(st.student_no)}</span>`
        }
      </td>
      <td class="py-2 px-2"><span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(st.student_id)}</span></td>
      <td class="py-2 px-2">
        <input type="text" data-field="full_name" value="${escapeHtml(st.full_name)}" class="w-full min-w-[170px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-medium focus:border-blue-500 outline-none" />
      </td>
      <td class="py-2 px-2">
        <select data-field="default_shift" class="px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white outline-none">
          <option value="1" ${Number(st.default_shift) === 1 ? 'selected' : ''}>ผลัด 1</option>
          <option value="2" ${Number(st.default_shift) === 2 ? 'selected' : ''}>ผลัด 2</option>
        </select>
      </td>
      <td class="py-2 px-2 text-center">
        <input type="checkbox" data-field="is_iep_excluded" ${st.is_iep_excluded ? 'checked' : ''} class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer" />
      </td>
      <td class="py-2 px-2 text-right whitespace-nowrap">
        <div class="inline-flex items-center gap-1">
          <button type="button" data-save-row="${escapeHtml(st.student_id)}" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-xs transition">
            บันทึก
          </button>
          <button type="button" data-delete-student="${escapeHtml(st.student_id)}" title="ลบนักเรียน" class="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition">
            ${icon('trash2', 'w-3.5 h-3.5')}
          </button>
        </div>
      </td>
    `;

    tr.querySelector('[data-move-up]').addEventListener('click', () => moveStudentRow(idx, -1));
    tr.querySelector('[data-move-down]').addEventListener('click', () => moveStudentRow(idx, 1));
    tr.querySelector('[data-save-row]').addEventListener('click', () => saveSingleStudentRow(tr, st.student_id));
    tr.querySelector('[data-delete-student]').addEventListener('click', () => openDeleteStudentModal(st));
    els.studentsTbody.appendChild(tr);
  });
}

function readRowEditableFields(tr, studentId) {
  const original = state.students.find((s) => s.student_id === studentId);
  return {
    full_name: tr.querySelector('[data-field="full_name"]').value.trim() || original.full_name,
    default_shift: Number(tr.querySelector('[data-field="default_shift"]').value),
    is_iep_excluded: tr.querySelector('[data-field="is_iep_excluded"]').checked,
  };
}

async function saveSingleStudentRow(tr, studentId) {
  const btn = tr.querySelector('[data-save-row]');
  const editable = readRowEditableFields(tr, studentId);
  const original = state.students.find((s) => s.student_id === studentId);
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const { error } = await supabase
      .from('students')
      .update(editable)
      .eq('student_id', studentId);

    if (error) throw error;
    const idx = state.students.findIndex((s) => s.student_id === studentId);
    if (idx !== -1) state.students[idx] = { ...state.students[idx], ...editable };
    showBanner(els.studentsSaveFeedback, 'success', `บันทึกข้อมูลเลขที่ ${original.student_no} (${editable.full_name}) เรียบร้อยแล้ว`);
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
  if (rows.length === 0) return;

  els.btnSaveAllStudents.disabled = true;
  els.btnSaveAllStudents.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังบันทึก...</span>`;

  try {
    // Update only editable fields (full_name, default_shift, is_iep_excluded); NEVER touch student_no
    const tasks = rows.map((tr) => {
      const studentId = tr.dataset.studentId;
      const editable = readRowEditableFields(tr, studentId);
      return supabase
        .from('students')
        .update(editable)
        .eq('student_id', studentId)
        .then(({ error }) => {
          if (error) throw error;
          const idx = state.students.findIndex((s) => s.student_id === studentId);
          if (idx !== -1) state.students[idx] = { ...state.students[idx], ...editable };
        });
    });

    await Promise.all(tasks);
    showBanner(els.studentsSaveFeedback, 'success', `บันทึกรายชื่อนักเรียนทั้งหมด ${rows.length} คนเรียบร้อยแล้ว`);
    renderLiveMonitor();
  } catch (err) {
    showBanner(els.studentsSaveFeedback, 'error', `บันทึกทั้งหมดไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnSaveAllStudents.disabled = false;
    els.btnSaveAllStudents.innerHTML = `${icon('save', 'w-4 h-4')}<span>บันทึกทั้งหมด (Save All)</span>`;
  }
}

async function handleAddStudent(e) {
  e.preventDefault();
  const fullName = els.inputNewStudentName.value.trim();
  const defaultShift = Number(els.inputNewStudentShift.value);
  const isIep = els.inputNewStudentIep.checked;

  if (!fullName) {
    showBanner(els.studentsSaveFeedback, 'error', 'กรุณากรอกชื่อ-นามสกุลนักเรียน');
    return;
  }

  els.btnAddStudent.disabled = true;
  els.btnAddStudent.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังเพิ่ม...</span>`;

  try {
    const { error } = await supabase.rpc('add_student', {
      p_full_name: fullName,
      p_default_shift: defaultShift,
      p_is_iep_excluded: isIep,
    });
    if (error) throw error;

    els.inputNewStudentName.value = '';
    els.inputNewStudentIep.checked = false;
    await loadStudents();
    await loadMonitorLogs();
    showBanner(els.studentsSaveFeedback, 'success', `เพิ่มนักเรียน "${fullName}" เข้าระบบเรียบร้อยแล้ว (รวม ${state.students.length} คน)`);
  } catch (err) {
    showBanner(els.studentsSaveFeedback, 'error', `เพิ่มนักเรียนไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnAddStudent.disabled = false;
    els.btnAddStudent.innerHTML = `${icon('userPlus', 'w-4 h-4')}<span>เพิ่มนักเรียน</span>`;
  }
}

async function handleSaveOrder() {
  if (state.students.length === 0) return;
  const studentIds = state.students.map((s) => s.student_id);
  const rebalanceShifts = els.inputReorderRebalance.checked;

  els.btnSaveOrder.disabled = true;
  els.btnSaveOrder.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังจัดลำดับเลขที่...</span>`;

  try {
    const { error } = await supabase.rpc('reorder_students', {
      p_student_ids: studentIds,
      p_rebalance_shifts: rebalanceShifts,
    });
    if (error) throw error;

    await loadStudents();
    await loadMonitorLogs();
    showBanner(els.studentsSaveFeedback, 'success', 'บันทึกลำดับเลขที่ใหม่และซิงค์ประวัติคะแนนเรียบร้อยแล้ว');
  } catch (err) {
    showBanner(els.studentsSaveFeedback, 'error', `บันทึกลำดับเลขที่ไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnSaveOrder.disabled = false;
    els.btnSaveOrder.innerHTML = `${icon('check', 'w-4 h-4')}<span>บันทึกลำดับเลขที่ใหม่</span>`;
  }
}

function openDeleteStudentModal(student) {
  state.pendingDeleteStudent = student;
  els.inputDeleteStudentRebalance.checked = true;
  els.deleteStudentDesc.innerHTML = `
    <p>ต้องการลบนักเรียนคนนี้ออกจากห้องเรียนใช่หรือไม่?</p>
    <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
      <div><strong>เลขที่ปัจจุบัน:</strong> เลขที่ ${escapeHtml(student.student_no)}</div>
      <div><strong>ชื่อ-นามสกุล:</strong> <strong class="text-slate-900">${escapeHtml(student.full_name)}</strong></div>
      <div><strong>รหัสนักเรียน:</strong> <span class="font-mono text-slate-600">${escapeHtml(student.student_id)}</span></div>
    </div>
  `;
  els.deleteStudentModal.classList.remove('hidden');
}

async function confirmDeleteStudent() {
  if (!state.pendingDeleteStudent) return;
  const target = state.pendingDeleteStudent;
  const rebalance = els.inputDeleteStudentRebalance.checked;

  els.btnConfirmDeleteStudent.disabled = true;
  els.btnConfirmDeleteStudent.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังลบและปรับเลขที่...</span>`;

  try {
    const { error } = await supabase.rpc('delete_student_and_renumber', {
      p_student_id: target.student_id,
      p_rebalance_shifts: rebalance,
    });
    if (error) throw error;

    els.deleteStudentModal.classList.add('hidden');
    state.pendingDeleteStudent = null;
    await loadStudents();
    await loadSessions();
    showBanner(
      els.studentsSaveFeedback,
      'success',
      `ลบเลขที่ ${target.student_no} (${target.full_name}) และปรับเลขที่นักเรียนที่เหลือ (${state.students.length} คน) เรียบร้อยแล้ว`
    );
  } catch (err) {
    alert(`ลบนักเรียนไม่สำเร็จ: ${err.message}`);
  } finally {
    els.btnConfirmDeleteStudent.disabled = false;
    els.btnConfirmDeleteStudent.innerHTML = `${icon('trash2', 'w-4 h-4')}<span>ยืนยันลบนักเรียน</span>`;
  }
}

function parseBulkNames(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
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
  return { filled: count, totalRows: rows.length, pastedCount: names.length };
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
    ? 'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 border-blue-600 text-blue-700 transition'
    : 'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition';
  els.tabBtnStudents.className = !isSessions
    ? 'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 border-blue-600 text-blue-700 transition'
    : 'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition';
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

  els.tabBtnSessions.addEventListener('click', () => switchTab('sessions'));
  els.tabBtnStudents.addEventListener('click', () => switchTab('students'));

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

  // Active Hero actions: Copy PIN, Close Session, Delete Session
  const heroCopyIdle = `${icon('copy', 'w-4 h-4')}<span>คัดลอกรหัส</span>`;
  els.btnCopyPin.addEventListener('click', () => {
    const pin = state.activeSession?.session_pin;
    handleCopyButtonFeedback(els.btnCopyPin, pin, heroCopyIdle);
  });

  els.btnCloseActive.addEventListener('click', async () => {
    if (!state.activeSession) return;
    if (!confirm(`ยืนยันการปิดรอบการเล่น PIN ${state.activeSession.session_pin}?`)) return;
    await toggleSessionActive(state.activeSession);
  });

  els.btnDeleteActive.addEventListener('click', () => {
    if (!state.activeSession) return;
    openDeleteSessionModal(state.activeSession);
  });

  // Monitor actions
  els.btnRefreshMonitor.addEventListener('click', () => loadMonitorLogs());
  els.filterPastMode.addEventListener('change', () => renderPastSessionsTable());

  // Delete log modal
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

  // Delete session modal
  els.btnCancelDeleteSession.addEventListener('click', () => {
    state.pendingDeleteSession = null;
    els.deleteSessionModal.classList.add('hidden');
  });
  els.deleteSessionModal.addEventListener('click', (e) => {
    if (e.target === els.deleteSessionModal) {
      state.pendingDeleteSession = null;
      els.deleteSessionModal.classList.add('hidden');
    }
  });
  els.btnConfirmDeleteSession.addEventListener('click', confirmDeleteSession);

  // Delete student modal
  els.btnCancelDeleteStudent.addEventListener('click', () => {
    state.pendingDeleteStudent = null;
    els.deleteStudentModal.classList.add('hidden');
  });
  els.deleteStudentModal.addEventListener('click', (e) => {
    if (e.target === els.deleteStudentModal) {
      state.pendingDeleteStudent = null;
      els.deleteStudentModal.classList.add('hidden');
    }
  });
  els.btnConfirmDeleteStudent.addEventListener('click', confirmDeleteStudent);

  // Students manager
  els.addStudentForm.addEventListener('submit', handleAddStudent);
  els.btnSaveOrder.addEventListener('click', handleSaveOrder);
  els.btnSaveAllStudents.addEventListener('click', saveAllStudents);

  els.btnBulkPreview.addEventListener('click', () => {
    const names = parseBulkNames(els.bulkTextarea.value);
    if (names.length === 0) {
      showBanner(els.bulkStatus, 'error', 'กรุณาวางรายชื่ออย่างน้อย 1 บรรทัด');
      return;
    }
    const { filled, totalRows, pastedCount } = applyBulkNamesToInputs(names);
    const extraNote = pastedCount > totalRows ? ` (เกินจำนวนปัจจุบัน ${pastedCount - totalRows} รายชื่อ)` : '';
    showBanner(els.bulkStatus, 'info', `เติมรายชื่อลงตารางแล้ว ${filled} / ${totalRows} คน${extraNote} กรุณาตรวจสอบแล้วกด "บันทึกทั้งหมด"`);
  });

  els.btnBulkApply.addEventListener('click', async () => {
    const names = parseBulkNames(els.bulkTextarea.value);
    if (names.length === 0) {
      showBanner(els.bulkStatus, 'error', 'กรุณาวางรายชื่ออย่างน้อย 1 บรรทัด');
      return;
    }
    const { filled, totalRows } = applyBulkNamesToInputs(names);
    await saveAllStudents();
    showBanner(els.bulkStatus, 'success', `อัปเดตรายชื่อ ${filled} / ${totalRows} คนลงฐานข้อมูลเรียบร้อยแล้ว`);
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
