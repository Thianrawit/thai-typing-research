import {
  supabase,
  MODE_LABELS,
  getStageMeta,
  getDeviceTag,
  setDeviceTag,
  generateUUID,
  formatNumber,
  roundTo,
  escapeHtml,
} from './config.js';
import { soundEngine } from './sound.js';
import { getWordsForSession } from './words.js';
import { KedmaneeKeyboard } from './keyboard.js';
import { icon } from './icons.js';

const PENDING_LOGS_KEY = 'thai_typing_pending_logs';
const COMBINING_MARKS = new Set([
  'ั', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ฺ',
  '่', '้', '๊', '๋', '็', '์', 'ํ',
]);
const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
  'Backspace', 'Delete', 'Enter', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ContextMenu', 'NumLock',
  'ScrollLock', 'Pause', 'PrintScreen', 'Dead', 'Process', 'Unidentified',
]);

// ============================================================================
// Thai Grapheme Cluster Segmentation (Native OpenType Shaping Safe)
// ============================================================================
const thaiSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('th', { granularity: 'grapheme' })
    : null;

function segmentThaiClusters(word) {
  let rawSegments = [];
  if (thaiSegmenter) {
    for (const seg of thaiSegmenter.segment(word)) {
      rawSegments.push(seg.segment);
    }
  } else {
    const matches = word.match(/[^\u0E31\u0E34-\u0E3A\u0E47-\u0E4E][\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]*/g);
    rawSegments = matches || Array.from(word);
  }

  // Ensure standalone SARA AM (U+0E33) stays inside its preceding consonant+tone cluster
  // so OpenType ccmp/mark/mkmk renders words like "น้ำ" or "กำ" without mark collision
  const merged = [];
  for (const seg of rawSegments) {
    if (seg === '\u0E33' && merged.length > 0) {
      merged[merged.length - 1] += seg;
    } else {
      merged.push(seg);
    }
  }

  const clusters = [];
  let cursor = 0;
  for (const text of merged) {
    const chars = Array.from(text);
    const startIdx = cursor;
    const endIdx = cursor + chars.length - 1;
    clusters.push({ text, chars, startIdx, endIdx });
    cursor += chars.length;
  }
  return clusters;
}

// ============================================================================
// DOM References
// ============================================================================
const screens = {
  pin: document.getElementById('screen-pin'),
  roster: document.getElementById('screen-roster'),
  game: document.getElementById('screen-game'),
  summary: document.getElementById('screen-summary'),
};

const els = {
  // Screen 1
  pinForm: document.getElementById('pin-form'),
  pinInput: document.getElementById('pin-input'),
  pinSubmitBtn: document.getElementById('pin-submit-btn'),
  pinError: document.getElementById('pin-error'),
  pinOfflineBanner: document.getElementById('pin-offline-banner'),
  pinOfflineText: document.getElementById('pin-offline-text'),
  pinOfflineRetry: document.getElementById('pin-offline-retry'),
  deviceTagBtn: document.getElementById('device-tag-btn'),
  deviceTagLabel: document.getElementById('device-tag-label'),
  deviceModal: document.getElementById('device-modal'),
  devicePresets: document.getElementById('device-presets'),
  deviceCustomInput: document.getElementById('device-custom-input'),
  deviceSaveBtn: document.getElementById('device-save-btn'),
  deviceCancelBtn: document.getElementById('device-cancel-btn'),

  // Screen 2
  rosterSessionBadge: document.getElementById('roster-session-badge'),
  rosterStageTitle: document.getElementById('roster-stage-title'),
  rosterDurationLabel: document.getElementById('roster-duration-label'),
  rosterProgressLabel: document.getElementById('roster-progress-label'),
  rosterRefreshBtn: document.getElementById('roster-refresh-btn'),
  rosterBackPinBtn: document.getElementById('roster-back-pin-btn'),
  shift1Grid: document.getElementById('shift1-grid'),
  shift2Grid: document.getElementById('shift2-grid'),
  shift1Count: document.getElementById('shift1-count'),
  shift2Count: document.getElementById('shift2-count'),
  confirmModal: document.getElementById('confirm-student-modal'),
  confirmStudentNo: document.getElementById('confirm-student-no'),
  confirmStudentName: document.getElementById('confirm-student-name'),
  confirmStudentShift: document.getElementById('confirm-student-shift'),
  confirmStartBtn: document.getElementById('confirm-start-btn'),
  confirmCancelBtn: document.getElementById('confirm-cancel-btn'),

  // Screen 3
  hudStudentNo: document.getElementById('hud-student-no'),
  hudStudentName: document.getElementById('hud-student-name'),
  hudModeBadge: document.getElementById('hud-mode-badge'),
  hudStageBadge: document.getElementById('hud-stage-badge'),
  hudTimer: document.getElementById('hud-timer'),
  hudWpm: document.getElementById('hud-wpm'),
  hudAcc: document.getElementById('hud-acc'),
  hudCombo: document.getElementById('hud-combo'),
  hudMuteBtn: document.getElementById('hud-mute-btn'),
  langWarningBanner: document.getElementById('lang-warning-banner'),
  guideModeBadge: document.getElementById('guide-mode-badge'),
  wordCard: document.getElementById('word-card'),
  currentWordDisplay: document.getElementById('current-word-display'),
  charStepStrip: document.getElementById('char-step-strip'),
  nextWordsPreview: document.getElementById('next-words-preview'),
  startPromptHint: document.getElementById('start-prompt-hint'),
  keyboardContainer: document.getElementById('virtual-keyboard-container'),

  // Screen 4
  summaryStars: document.getElementById('summary-stars'),
  summaryStudentLabel: document.getElementById('summary-student-label'),
  summaryStageLabel: document.getElementById('summary-stage-label'),
  summaryNetWpm: document.getElementById('summary-net-wpm'),
  summaryGrossWpm: document.getElementById('summary-gross-wpm'),
  summaryAcc: document.getElementById('summary-acc'),
  summaryWords: document.getElementById('summary-words'),
  summaryCombo: document.getElementById('summary-combo'),
  summaryWarnings: document.getElementById('summary-warnings'),
  summarySaveStatus: document.getElementById('summary-save-status'),
  summaryRetryBtn: document.getElementById('summary-retry-btn'),
  logoutCountdownWrap: document.getElementById('logout-countdown-wrap'),
  logoutCountdownSec: document.getElementById('logout-countdown-sec'),
  logoutProgressBar: document.getElementById('logout-progress-bar'),
  returnRosterBtn: document.getElementById('return-roster-btn'),
};

// ============================================================================
// Application State
// ============================================================================
const state = {
  currentScreen: 'pin',
  pin: '',
  session: null,
  students: [],
  pendingStudent: null,
  selectedStudent: null,
  keyboard: null,

  // Gameplay state
  isPlaying: false,
  timerStarted: false,
  timerIntervalId: null,
  startedAtMs: 0,
  words: [],
  wordIndex: 0,
  currentChars: [],
  currentClusters: [],
  charIndex: 0,
  hasErrorOnChar: false,

  totalKeystrokes: 0,
  correctChars: 0,
  errorKeystrokes: 0,
  wordsCompleted: 0,
  currentCombo: 0,
  maxCombo: 0,
  engLangWarnings: 0,
  weakKeys: {},

  langBannerTimer: null,
  shakeTimer: null,

  // Summary / Logout state
  lastPayload: null,
  logoutIntervalId: null,
  logoutRemainingSec: 15,
};

// ============================================================================
// Screen Switching & Utilities
// ============================================================================
function showScreen(name) {
  state.currentScreen = name;
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

function formatTimer(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function extractRpcErrorText(error) {
  if (!error) return '';
  return `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.trim();
}

function normalizeRpcData(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

// ============================================================================
// Offline Submission Queue (localStorage)
// ============================================================================
function readPendingLogs() {
  try {
    const raw = localStorage.getItem(PENDING_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingLogs(list) {
  try {
    localStorage.setItem(PENDING_LOGS_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

function enqueuePendingLog(payload) {
  const list = readPendingLogs();
  const exists = list.some((item) => item.p_log_id === payload.p_log_id);
  if (!exists) {
    list.push(payload);
    writePendingLogs(list);
  }
}

function removePendingLog(logId) {
  const list = readPendingLogs().filter((item) => item.p_log_id !== logId);
  writePendingLogs(list);
}

async function submitSinglePayload(payload) {
  const { data, error } = await supabase.rpc('submit_typing_log', payload);
  if (error) {
    const errText = extractRpcErrorText(error);
    if (errText.includes('ALREADY_SUBMITTED')) {
      return { ok: true, permanentStatus: 'already_submitted', errorText: errText };
    }
    if (errText.includes('SESSION_CLOSED_OR_INVALID')) {
      return { ok: false, retryable: false, code: 'SESSION_CLOSED_OR_INVALID', errorText: errText };
    }
    if (errText.includes('STUDENT_NOT_FOUND')) {
      return { ok: false, retryable: false, code: 'STUDENT_NOT_FOUND', errorText: errText };
    }
    return { ok: false, retryable: true, code: 'NETWORK_OR_SERVER', errorText: errText };
  }

  const res = normalizeRpcData(data);
  if (res && (res.status === 'saved' || res.status === 'already_saved')) {
    return { ok: true, status: res.status };
  }
  return { ok: true, status: 'saved' };
}

async function flushPendingLogsOnStartup() {
  const queue = readPendingLogs();
  if (queue.length === 0) {
    els.pinOfflineBanner.classList.add('hidden');
    return;
  }

  els.pinOfflineBanner.classList.remove('hidden');
  els.pinOfflineText.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>พบคะแนนค้างส่ง ${queue.length} รายการ กำลังส่งอัตโนมัติ...</span>`;
  els.pinOfflineRetry.classList.add('hidden');

  let flushed = 0;
  for (const payload of queue) {
    try {
      const result = await submitSinglePayload(payload);
      if (result.ok || result.code === 'STUDENT_NOT_FOUND') {
        removePendingLog(payload.p_log_id);
        flushed += 1;
      }
    } catch {
      // Keep in queue for later retry
    }
  }

  const remaining = readPendingLogs().length;
  if (remaining === 0) {
    els.pinOfflineBanner.classList.remove('bg-amber-50', 'border-amber-200', 'text-amber-800');
    els.pinOfflineBanner.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-800');
    els.pinOfflineText.innerHTML = `${icon('checkCircle', 'w-4 h-4')}<span>ส่งคะแนนค้างส่งสำเร็จครบ ${flushed} รายการแล้ว</span>`;
    setTimeout(() => els.pinOfflineBanner.classList.add('hidden'), 4500);
  } else {
    els.pinOfflineBanner.classList.remove('bg-emerald-50', 'border-emerald-200', 'text-emerald-800');
    els.pinOfflineBanner.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-800');
    els.pinOfflineText.innerHTML = `${icon('alertTriangle', 'w-4 h-4')}<span>ยังมีคะแนนค้างส่งในเครื่อง ${remaining} รายการ (รอสัญญาณเน็ต/เปิดรอบ)</span>`;
    els.pinOfflineRetry.classList.remove('hidden');
  }
}

// ============================================================================
// Device Tag Modal
// ============================================================================
function initDeviceTagUI() {
  els.deviceTagLabel.textContent = getDeviceTag();

  els.devicePresets.innerHTML = '';
  for (let i = 1; i <= 12; i += 1) {
    const tag = `PC-${String(i).padStart(2, '0')}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tag;
    btn.className = 'py-2 px-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 font-bold text-sm text-slate-700 transition';
    btn.addEventListener('click', () => {
      const saved = setDeviceTag(tag);
      els.deviceTagLabel.textContent = saved;
      els.deviceModal.classList.add('hidden');
    });
    els.devicePresets.appendChild(btn);
  }

  els.deviceTagBtn.addEventListener('click', () => {
    els.deviceCustomInput.value = getDeviceTag();
    els.deviceModal.classList.remove('hidden');
    els.deviceCustomInput.focus();
  });

  els.deviceCancelBtn.addEventListener('click', () => {
    els.deviceModal.classList.add('hidden');
  });

  els.deviceSaveBtn.addEventListener('click', () => {
    const saved = setDeviceTag(els.deviceCustomInput.value);
    els.deviceTagLabel.textContent = saved;
    els.deviceModal.classList.add('hidden');
  });

  els.deviceModal.addEventListener('click', (e) => {
    if (e.target === els.deviceModal) els.deviceModal.classList.add('hidden');
  });
}

// ============================================================================
// Screen 1 -> Screen 2: Verify PIN & Load Full-Width Roster (Fix 4)
// ============================================================================
async function fetchSessionAndRoster(pin) {
  const { data, error } = await supabase.rpc('verify_session_and_get_roster', {
    p_pin: pin,
  });

  if (error) {
    const text = extractRpcErrorText(error);
    if (text.includes('INVALID_OR_CLOSED_PIN')) {
      throw new Error('รหัส PIN ไม่ถูกต้อง หรือคุณครูปิดรอบการเล่นนี้แล้ว');
    }
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }

  const payload = normalizeRpcData(data);
  if (!payload || !payload.session || !Array.isArray(payload.students)) {
    throw new Error('รหัส PIN ไม่ถูกต้อง หรือไม่พบข้อมูลรอบการเล่น');
  }

  return payload;
}

function renderRoster() {
  const session = state.session;
  const stageMeta = getStageMeta(session.stage_id);
  const modeLabel = MODE_LABELS[session.mode] || session.mode;
  const students = [...state.students].sort((a, b) => a.student_no - b.student_no);

  const completedTotal = students.filter((s) => s.has_completed).length;
  const mins = Math.floor(session.duration_sec / 60);
  const remSec = session.duration_sec % 60;
  const durText = remSec === 0 ? `${mins} นาที` : `${mins} นาที ${remSec} วินาที`;

  els.rosterSessionBadge.textContent = `สัปดาห์ที่ ${session.week_no} • ${modeLabel}`;
  els.rosterDurationLabel.innerHTML = `${icon('clock', 'w-3.5 h-3.5 text-slate-500')}<span>${escapeHtml(durText)}</span>`;
  els.rosterProgressLabel.innerHTML = `${icon('checkCircle', 'w-3.5 h-3.5')}<span>ส่งแล้ว ${completedTotal} / ${students.length} คน</span>`;
  els.rosterStageTitle.textContent = stageMeta.title;

  const shift1 = students.filter((s) => (s.default_shift ?? (s.student_no <= 11 ? 1 : 2)) === 1);
  const shift2 = students.filter((s) => (s.default_shift ?? (s.student_no <= 11 ? 1 : 2)) === 2);

  const s1Done = shift1.filter((s) => s.has_completed).length;
  const s2Done = shift2.filter((s) => s.has_completed).length;
  els.shift1Count.textContent = `${s1Done}/${shift1.length} คน`;
  els.shift2Count.textContent = `${s2Done}/${shift2.length} คน`;

  const renderList = (container, list) => {
    container.innerHTML = '';
    for (const student of list) {
      const btn = document.createElement('button');
      btn.type = 'button';

      if (student.has_completed) {
        btn.disabled = true;
        btn.className = 'w-full text-left py-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-between gap-3';
        btn.innerHTML = `
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="w-8 h-8 rounded-lg bg-slate-200 text-slate-500 font-bold text-sm flex items-center justify-center shrink-0">${escapeHtml(student.student_no)}</span>
            <span class="font-semibold text-sm md:text-base whitespace-normal break-words text-left leading-snug line-through">${escapeHtml(student.full_name)}</span>
          </div>
          <span class="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">${icon('check', 'w-3.5 h-3.5')}<span>เล่นครบแล้ว</span></span>
        `;
      } else {
        btn.className = 'w-full text-left py-2.5 px-3.5 rounded-xl border-2 border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/70 active:scale-[0.99] transition flex items-center justify-between gap-3 shadow-2xs';
        btn.innerHTML = `
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-extrabold text-sm flex items-center justify-center shrink-0">${escapeHtml(student.student_no)}</span>
            <span class="font-bold text-slate-800 text-sm md:text-base whitespace-normal break-words text-left leading-snug">${escapeHtml(student.full_name)}</span>
          </div>
          <span class="shrink-0 text-blue-500">${icon('chevronRight', 'w-5 h-5')}</span>
        `;
        btn.addEventListener('click', () => openConfirmStudentModal(student));
      }

      container.appendChild(btn);
    }
  };

  renderList(els.shift1Grid, shift1);
  renderList(els.shift2Grid, shift2);
}

function openConfirmStudentModal(student) {
  state.pendingStudent = student;
  const shiftNo = student.default_shift ?? (student.student_no <= 11 ? 1 : 2);
  els.confirmStudentNo.textContent = String(student.student_no);
  els.confirmStudentName.textContent = `ยืนยันตัวตน: เลขที่ ${student.student_no} — ${student.full_name}`;
  els.confirmStudentShift.textContent = `ผลัดที่ ${shiftNo} • เครื่อง ${getDeviceTag()}`;
  els.confirmModal.classList.remove('hidden');
  els.confirmStartBtn.focus();
}

// ============================================================================
// Screen 3: Gameplay Engine (Grapheme-Cluster Display + Strict-Stop Unicode)
// ============================================================================
function getEffectiveGuideMode(session) {
  if (session.mode === 'PRETEST' || session.mode === 'POSTTEST') {
    return 'NONE';
  }
  const meta = getStageMeta(session.stage_id);
  return meta.guideMode || 'FULL';
}

function updateMuteButtonUI() {
  const muted = soundEngine.isMuted();
  els.hudMuteBtn.innerHTML = muted
    ? icon('volumeX', 'w-5 h-5 text-slate-500')
    : icon('volume2', 'w-5 h-5 text-slate-700');
  els.hudMuteBtn.title = muted ? 'เปิดเสียง' : 'ปิดเสียง';
}

function loadCurrentWord(word) {
  const target = word || 'ก';
  state.currentChars = Array.from(target);
  state.currentClusters = segmentThaiClusters(target);
  state.charIndex = 0;
  state.hasErrorOnChar = false;
}

function startGameplay(student) {
  state.selectedStudent = student;
  els.confirmModal.classList.add('hidden');

  if (!state.keyboard) {
    state.keyboard = new KedmaneeKeyboard(els.keyboardContainer);
  }

  const session = state.session;
  const stageMeta = getStageMeta(session.stage_id);
  const guideMode = getEffectiveGuideMode(session);

  state.keyboard.setGuideMode(guideMode);

  state.isPlaying = true;
  state.timerStarted = false;
  state.startedAtMs = 0;
  clearInterval(state.timerIntervalId);
  state.timerIntervalId = null;

  state.words = getWordsForSession(session.stage_id, session.mode);
  state.wordIndex = 0;
  loadCurrentWord(state.words[0]);

  state.totalKeystrokes = 0;
  state.correctChars = 0;
  state.errorKeystrokes = 0;
  state.wordsCompleted = 0;
  state.currentCombo = 0;
  state.maxCombo = 0;
  state.engLangWarnings = 0;
  state.weakKeys = {};

  // Populate HUD
  els.hudStudentNo.textContent = String(student.student_no);
  els.hudStudentName.textContent = student.full_name;
  els.hudModeBadge.textContent = MODE_LABELS[session.mode] || session.mode;
  els.hudStageBadge.textContent = stageMeta.shortTitle;
  els.hudTimer.textContent = formatTimer(session.duration_sec);
  els.hudTimer.parentElement.classList.remove('bg-rose-600');
  els.hudTimer.parentElement.classList.add('bg-slate-900');
  els.hudWpm.textContent = '0';
  els.hudAcc.textContent = '100%';
  els.hudCombo.innerHTML = `<span>0</span>${icon('flame', 'w-4 h-4 text-orange-500')}`;
  updateMuteButtonUI();

  // Guide mode badge
  els.langWarningBanner.classList.add('hidden');
  if (session.mode === 'PRETEST' || session.mode === 'POSTTEST') {
    els.guideModeBadge.innerHTML = `${icon('lock', 'w-3.5 h-3.5')}<span>โหมดทดสอบ: ปิดไฟนำทาง</span>`;
    els.guideModeBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200';
  } else if (guideMode === 'ON_ERROR') {
    els.guideModeBadge.innerHTML = `${icon('lightbulb', 'w-3.5 h-3.5')}<span>โหมดฝึกขั้นสูง: แสดงไฟนำทางเมื่อพิมพ์ผิด</span>`;
    els.guideModeBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200';
  } else {
    els.guideModeBadge.className = 'hidden';
  }

  els.startPromptHint.classList.remove('hidden');

  showScreen('game');
  renderWordZone();
  state.keyboard.highlightTarget(state.currentChars[0]);
}

function renderWordZone() {
  const clusters = state.currentClusters;
  const cursor = state.charIndex;

  // Each Thai grapheme cluster stays in ONE single contiguous <span> text node
  // so OpenType ccmp/mark/mkmk positions stacked vowels & tone marks natively
  let activeCluster = null;
  const wordHtml = clusters
    .map((cluster) => {
      let cls = 'thai-cluster thai-cluster-pending';
      if (cursor > cluster.endIdx) {
        cls = 'thai-cluster thai-cluster-typed';
      } else if (cursor >= cluster.startIdx && cursor <= cluster.endIdx) {
        activeCluster = cluster;
        cls = state.hasErrorOnChar
          ? 'thai-cluster thai-cluster-error'
          : 'thai-cluster thai-cluster-active';
      }
      return `<span class="${cls}">${escapeHtml(cluster.text)}</span>`;
    })
    .join('');

  els.currentWordDisplay.innerHTML = wordHtml;

  // Combining-Mark Sequence Bar: shown ONLY when active cluster contains > 1 char
  if (activeCluster && activeCluster.chars.length > 1) {
    const pills = activeCluster.chars.map((ch, offset) => {
      const charIdx = activeCluster.startIdx + offset;
      const label = COMBINING_MARKS.has(ch) ? `◌${ch}` : ch;
      let cls = 'bg-slate-100 text-slate-500 border-slate-200';
      if (charIdx < cursor) {
        cls = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
      } else if (charIdx === cursor) {
        cls = state.hasErrorOnChar
          ? 'bg-rose-100 text-rose-700 border-rose-400 font-extrabold scale-105 shadow-xs'
          : 'bg-blue-600 text-white border-blue-700 font-extrabold scale-105 shadow-xs';
      }
      return `<span class="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg border text-sm leading-none transition-transform ${cls}">${escapeHtml(label)}</span>`;
    });

    const sep = icon('chevronRight', 'w-3.5 h-3.5 text-slate-300');
    els.charStepStrip.innerHTML = `<span class="text-[11px] font-bold text-slate-400 mr-1">ลำดับกด:</span>${pills.join(sep)}`;
  } else {
    els.charStepStrip.innerHTML = '';
  }

  // Next 2 preview words
  const next1 = state.words[(state.wordIndex + 1) % state.words.length] || '';
  const next2 = state.words[(state.wordIndex + 2) % state.words.length] || '';
  els.nextWordsPreview.innerHTML = `
    <span class="text-xs font-bold uppercase tracking-wider text-slate-300">คำถัดไป:</span>
    <span>${escapeHtml(next1)}</span>
    <span class="text-slate-300">•</span>
    <span class="opacity-70">${escapeHtml(next2)}</span>
  `;
}

function updateLiveMetricsUI() {
  if (!state.timerStarted) return;
  const elapsedSec = Math.max(1, (performance.now() - state.startedAtMs) / 1000);
  const durationMin = Math.max(elapsedSec / 60, 1 / 60);
  const grossWpm = (state.totalKeystrokes / 5) / durationMin;
  const netWpm = Math.max(0, grossWpm - (state.errorKeystrokes / durationMin));
  const acc = state.totalKeystrokes > 0 ? (state.correctChars / state.totalKeystrokes) * 100 : 100;

  els.hudWpm.textContent = String(Math.round(netWpm));
  els.hudAcc.textContent = `${Math.round(acc)}%`;
  els.hudCombo.innerHTML = `<span>${state.currentCombo}</span>${icon('flame', 'w-4 h-4 text-orange-500')}`;
}

function startCountdownTimer() {
  if (state.timerStarted) return;
  state.timerStarted = true;
  state.startedAtMs = performance.now();
  els.startPromptHint.classList.add('hidden');

  const totalSec = state.session.duration_sec;

  state.timerIntervalId = setInterval(() => {
    if (!state.isPlaying) return;
    const elapsedSec = (performance.now() - state.startedAtMs) / 1000;
    const remaining = totalSec - elapsedSec;

    els.hudTimer.textContent = formatTimer(remaining);
    if (remaining <= 15) {
      els.hudTimer.parentElement.classList.remove('bg-slate-900');
      els.hudTimer.parentElement.classList.add('bg-rose-600');
    }

    updateLiveMetricsUI();

    if (remaining <= 0) {
      finishGameplay(totalSec);
    }
  }, 150);
}

function triggerLanguageWarning() {
  state.engLangWarnings += 1;
  soundEngine.playError();

  els.guideModeBadge.classList.add('hidden');
  els.langWarningBanner.classList.remove('hidden', 'animate-lang-banner');
  void els.langWarningBanner.offsetWidth;
  els.langWarningBanner.classList.add('animate-lang-banner');

  clearTimeout(state.langBannerTimer);
  state.langBannerTimer = setTimeout(() => {
    els.langWarningBanner.classList.add('hidden');
    if (state.session && (state.session.mode !== 'PRACTICE' || getEffectiveGuideMode(state.session) === 'ON_ERROR')) {
      els.guideModeBadge.classList.remove('hidden');
    }
  }, 3200);
}

function triggerWordShake() {
  els.wordCard.classList.remove('animate-word-shake', 'border-rose-300');
  void els.wordCard.offsetWidth;
  els.wordCard.classList.add('animate-word-shake', 'border-rose-300');

  clearTimeout(state.shakeTimer);
  state.shakeTimer = setTimeout(() => {
    els.wordCard.classList.remove('animate-word-shake', 'border-rose-300');
  }, 260);
}

function advanceWord() {
  state.wordsCompleted += 1;
  state.wordIndex += 1;
  if (state.wordIndex >= state.words.length) {
    state.words = getWordsForSession(state.session.stage_id, state.session.mode);
    state.wordIndex = 0;
  }
  loadCurrentWord(state.words[state.wordIndex]);
}

function handleGameKeydown(event) {
  if (state.currentScreen !== 'game' || !state.isPlaying) return;

  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key.startsWith('F') && event.key.length > 1) return;
  if (IGNORED_KEYS.has(event.key)) {
    if (event.key === 'Tab' || event.key === 'Backspace') event.preventDefault();
    return;
  }
  if (event.key.length !== 1) return;

  event.preventDefault();

  const expectedChar = state.currentChars[state.charIndex];
  if (!expectedChar) return;

  // Language Guard: Latin key when Thai character is expected (NO accuracy penalty)
  const isExpectedThai = /[\u0E00-\u0E7F]/.test(expectedChar);
  if (isExpectedThai && /^[a-zA-Z]$/.test(event.key)) {
    triggerLanguageWarning();
    return;
  }

  if (!els.langWarningBanner.classList.contains('hidden')) {
    clearTimeout(state.langBannerTimer);
    els.langWarningBanner.classList.add('hidden');
    if (state.session.mode !== 'PRACTICE' || getEffectiveGuideMode(state.session) === 'ON_ERROR') {
      els.guideModeBadge.classList.remove('hidden');
    }
  }

  if (!state.timerStarted) {
    startCountdownTimer();
  }

  state.totalKeystrokes += 1;

  if (event.key === expectedChar) {
    state.correctChars += 1;
    state.currentCombo += 1;
    if (state.currentCombo > state.maxCombo) {
      state.maxCombo = state.currentCombo;
    }
    state.hasErrorOnChar = false;
    state.keyboard.flashKeyPress(event.code, true);

    state.charIndex += 1;
    if (state.charIndex >= state.currentChars.length) {
      soundEngine.playWordComplete();
      advanceWord();
    } else {
      soundEngine.playCorrect();
    }

    renderWordZone();
    state.keyboard.highlightTarget(state.currentChars[state.charIndex]);
  } else {
    state.errorKeystrokes += 1;
    state.currentCombo = 0;
    state.hasErrorOnChar = true;
    state.weakKeys[expectedChar] = (state.weakKeys[expectedChar] || 0) + 1;

    state.keyboard.flashKeyPress(event.code, false);
    soundEngine.playError();
    renderWordZone();
    triggerWordShake();
  }

  updateLiveMetricsUI();
}

// ============================================================================
// Screen 4: Finish Round, Calculate Metrics, Resilient Submit & Auto-Logout
// ============================================================================
function computeStars(netWpm, accuracyPct) {
  if (accuracyPct >= 92 && netWpm >= 18) return 3;
  if (accuracyPct >= 82 && netWpm >= 10) return 2;
  return 1;
}

function renderStarsSvg(count) {
  let html = '';
  for (let i = 1; i <= 3; i += 1) {
    html += i <= count
      ? icon('starFilled', 'w-12 h-12 text-amber-400 drop-shadow-xs')
      : icon('star', 'w-12 h-12 text-slate-300');
  }
  return html;
}

function buildSubmissionPayload(actualDurationSec) {
  const durationActualSec = Math.max(1, Math.min(state.session.duration_sec, Math.round(actualDurationSec)));
  const durationMin = Math.max(durationActualSec / 60, 1 / 60);

  const grossCpmRaw = state.totalKeystrokes / durationMin;
  const netCpmRaw = Math.max(0, (state.totalKeystrokes - state.errorKeystrokes) / durationMin);
  const grossWpmRaw = (state.totalKeystrokes / 5) / durationMin;
  const netWpmRaw = Math.max(0, grossWpmRaw - (state.errorKeystrokes / durationMin));
  const accuracyPctRaw = state.totalKeystrokes > 0 ? (state.correctChars / state.totalKeystrokes) * 100 : 0;

  const shiftNo = state.selectedStudent.default_shift ?? (state.selectedStudent.student_no <= 11 ? 1 : 2);

  return {
    p_pin: state.pin,
    p_log_id: generateUUID(),
    p_student_id: state.selectedStudent.student_id,
    p_shift_no: shiftNo,
    p_duration_actual_sec: durationActualSec,
    p_total_keystrokes: state.totalKeystrokes,
    p_correct_chars: state.correctChars,
    p_error_keystrokes: state.errorKeystrokes,
    p_words_completed: state.wordsCompleted,
    p_gross_cpm: roundTo(grossCpmRaw, 2),
    p_net_cpm: roundTo(netCpmRaw, 2),
    p_gross_wpm: roundTo(grossWpmRaw, 2),
    p_net_wpm: roundTo(netWpmRaw, 2),
    p_accuracy_pct: roundTo(accuracyPctRaw, 2),
    p_max_combo: state.maxCombo,
    p_eng_lang_warnings: state.engLangWarnings,
    p_weak_keys_json: { ...state.weakKeys },
    p_device_tag: getDeviceTag(),
  };
}

function setSaveStatusBanner(variant, iconName, text) {
  const variants = {
    loading: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-300',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const spin = variant === 'loading' ? ' animate-spin' : '';
  els.summarySaveStatus.className = `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${variants[variant] || variants.loading}`;
  els.summarySaveStatus.innerHTML = `${icon(iconName, `w-4 h-4${spin}`)}<span>${escapeHtml(text)}</span>`;
}

async function submitWithRetries(payload, maxAttempts = 3) {
  els.summaryRetryBtn.classList.add('hidden');
  setSaveStatusBanner('loading', 'loader', 'กำลังบันทึกคะแนนเข้าสู่ระบบ...');

  let lastResult = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await submitSinglePayload(payload);
      lastResult = result;

      if (result.ok) {
        removePendingLog(payload.p_log_id);
        if (result.permanentStatus === 'already_submitted') {
          setSaveStatusBanner('warning', 'alertTriangle', 'นักเรียนคนนี้ได้บันทึกคะแนนรอบนี้ไว้ก่อนหน้าแล้ว');
        } else {
          setSaveStatusBanner('success', 'checkCircle', 'บันทึกคะแนนสำเร็จ');
        }
        startAutoLogoutCountdown();
        return;
      }

      if (!result.retryable) {
        if (result.code === 'SESSION_CLOSED_OR_INVALID') {
          setSaveStatusBanner('warning', 'alertTriangle', 'รอบการเล่นถูกปิดแล้ว (เก็บคะแนนสำรองไว้ในเครื่องแล้ว — กดส่งใหม่ได้เมื่อครูเปิดรอบ)');
          els.summaryRetryBtn.classList.remove('hidden');
        } else {
          removePendingLog(payload.p_log_id);
          setSaveStatusBanner('error', 'xCircle', 'ไม่พบข้อมูลนักเรียนในระบบ กรุณาแจ้งคุณครู');
        }
        return;
      }
    } catch {
      lastResult = { ok: false, retryable: true };
    }

    if (attempt < maxAttempts) {
      setSaveStatusBanner('loading', 'loader', `สัญญาณขัดข้อง กำลังลองส่งใหม่ครั้งที่ ${attempt + 1}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  if (!lastResult?.ok) {
    setSaveStatusBanner('warning', 'alertTriangle', 'อินเทอร์เน็ตขัดข้อง — สำรองคะแนนไว้ในเครื่องแล้ว กรุณากดปุ่มส่งอีกครั้ง');
    els.summaryRetryBtn.classList.remove('hidden');
  }
}

function stopAutoLogoutCountdown() {
  clearInterval(state.logoutIntervalId);
  state.logoutIntervalId = null;
}

function startAutoLogoutCountdown() {
  stopAutoLogoutCountdown();
  state.logoutRemainingSec = 15;
  els.logoutCountdownSec.textContent = '15';
  els.logoutProgressBar.style.transition = 'none';
  els.logoutProgressBar.style.width = '100%';
  void els.logoutProgressBar.offsetWidth;
  els.logoutProgressBar.style.transition = 'width 1s linear';

  state.logoutIntervalId = setInterval(() => {
    state.logoutRemainingSec -= 1;
    const clamped = Math.max(0, state.logoutRemainingSec);
    els.logoutCountdownSec.textContent = String(clamped);
    els.logoutProgressBar.style.width = `${(clamped / 15) * 100}%`;

    if (clamped <= 0) {
      stopAutoLogoutCountdown();
      returnToRosterAndRefresh();
    }
  }, 1000);
}

async function returnToRosterAndRefresh() {
  stopAutoLogoutCountdown();
  els.returnRosterBtn.disabled = true;
  els.returnRosterBtn.textContent = 'กำลังโหลดรายชื่อล่าสุด...';

  try {
    const data = await fetchSessionAndRoster(state.pin);
    state.session = data.session;
    state.students = data.students;
    state.selectedStudent = null;
    renderRoster();
    showScreen('roster');
  } catch (err) {
    state.session = null;
    state.students = [];
    state.selectedStudent = null;
    els.pinInput.value = '';
    els.pinError.textContent = err.message || 'คุณครูปิดรอบการเล่นแล้ว';
    els.pinError.classList.remove('hidden');
    showScreen('pin');
    els.pinInput.focus();
  } finally {
    els.returnRosterBtn.disabled = false;
    els.returnRosterBtn.textContent = 'กลับหน้าเลือกรายชื่อทันที';
  }
}

function finishGameplay(actualDurationSec) {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  clearInterval(state.timerIntervalId);
  state.timerIntervalId = null;
  state.keyboard?.clearHighlights();
  soundEngine.playFinish();

  const payload = buildSubmissionPayload(actualDurationSec);
  state.lastPayload = payload;

  enqueuePendingLog(payload);

  const starsCount = computeStars(payload.p_net_wpm, payload.p_accuracy_pct);
  const stageMeta = getStageMeta(state.session.stage_id);
  const modeLabel = MODE_LABELS[state.session.mode] || state.session.mode;

  els.summaryStars.innerHTML = renderStarsSvg(starsCount);
  els.summaryStudentLabel.textContent = `เลขที่ ${state.selectedStudent.student_no} — ${state.selectedStudent.full_name}`;
  els.summaryStageLabel.textContent = `สัปดาห์ที่ ${state.session.week_no} • ${modeLabel} • ${stageMeta.title}`;
  els.summaryNetWpm.textContent = formatNumber(payload.p_net_wpm, 2);
  els.summaryGrossWpm.textContent = formatNumber(payload.p_gross_wpm, 2);
  els.summaryAcc.textContent = `${formatNumber(payload.p_accuracy_pct, 2)}%`;
  els.summaryWords.textContent = `${payload.p_words_completed} คำ`;
  els.summaryCombo.innerHTML = `<span>${payload.p_max_combo}</span>${icon('flame', 'w-6 h-6 text-orange-500')}`;
  els.summaryWarnings.textContent = `${payload.p_eng_lang_warnings} ครั้ง`;

  stopAutoLogoutCountdown();
  els.logoutCountdownSec.textContent = '15';
  els.logoutProgressBar.style.transition = 'none';
  els.logoutProgressBar.style.width = '100%';

  showScreen('summary');
  submitWithRetries(payload, 3);
}

// ============================================================================
// Event Listeners & Initialization
// ============================================================================
function bindEvents() {
  els.pinInput.addEventListener('input', () => {
    els.pinInput.value = els.pinInput.value.replace(/\D/g, '').slice(0, 4);
    els.pinError.classList.add('hidden');
  });

  els.pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = els.pinInput.value.trim();
    if (pin.length !== 4) {
      els.pinError.textContent = 'กรุณากรอกรหัส PIN ตัวเลขให้ครบ 4 หลัก';
      els.pinError.classList.remove('hidden');
      els.pinInput.focus();
      return;
    }

    els.pinSubmitBtn.disabled = true;
    els.pinSubmitBtn.innerHTML = `${icon('loader', 'w-5 h-5 animate-spin')}<span>กำลังตรวจสอบ PIN...</span>`;
    els.pinError.classList.add('hidden');

    try {
      const data = await fetchSessionAndRoster(pin);
      state.pin = pin;
      state.session = data.session;
      state.students = data.students;
      renderRoster();
      showScreen('roster');
    } catch (err) {
      els.pinError.textContent = err.message;
      els.pinError.classList.remove('hidden');
      els.pinInput.select();
    } finally {
      els.pinSubmitBtn.disabled = false;
      els.pinSubmitBtn.innerHTML = `<span>เข้าสู่ห้องเรียน</span>${icon('chevronRight', 'w-5 h-5')}`;
    }
  });

  els.pinOfflineRetry.addEventListener('click', () => {
    flushPendingLogsOnStartup();
  });

  els.rosterRefreshBtn.addEventListener('click', async () => {
    els.rosterRefreshBtn.disabled = true;
    els.rosterRefreshBtn.innerHTML = `${icon('loader', 'w-4 h-4 animate-spin')}<span>กำลังโหลด...</span>`;
    try {
      const data = await fetchSessionAndRoster(state.pin);
      state.session = data.session;
      state.students = data.students;
      renderRoster();
    } catch (err) {
      els.pinError.textContent = err.message;
      els.pinError.classList.remove('hidden');
      showScreen('pin');
    } finally {
      els.rosterRefreshBtn.disabled = false;
      els.rosterRefreshBtn.innerHTML = `${icon('refreshCw', 'w-4 h-4')}<span>รีเฟรชรายชื่อ</span>`;
    }
  });

  els.rosterBackPinBtn.addEventListener('click', () => {
    state.session = null;
    state.students = [];
    els.pinInput.value = '';
    els.pinError.classList.add('hidden');
    showScreen('pin');
    els.pinInput.focus();
  });

  els.confirmCancelBtn.addEventListener('click', () => {
    state.pendingStudent = null;
    els.confirmModal.classList.add('hidden');
  });

  els.confirmModal.addEventListener('click', (e) => {
    if (e.target === els.confirmModal) {
      state.pendingStudent = null;
      els.confirmModal.classList.add('hidden');
    }
  });

  els.confirmStartBtn.addEventListener('click', () => {
    if (!state.pendingStudent) return;
    startGameplay(state.pendingStudent);
  });

  els.hudMuteBtn.addEventListener('click', () => {
    soundEngine.toggleMute();
    updateMuteButtonUI();
    els.hudMuteBtn.blur();
  });

  window.addEventListener('keydown', handleGameKeydown);

  els.summaryRetryBtn.addEventListener('click', () => {
    if (state.lastPayload) {
      submitWithRetries(state.lastPayload, 3);
    }
  });

  els.returnRosterBtn.addEventListener('click', () => {
    returnToRosterAndRefresh();
  });

  window.addEventListener('online', () => {
    if (state.currentScreen === 'pin') {
      flushPendingLogsOnStartup();
    }
  });
}

function init() {
  initDeviceTagUI();
  bindEvents();
  showScreen('pin');
  flushPendingLogsOnStartup();
  els.pinInput.focus();
}

init();
