import {
  supabase,
  MODE_LABELS,
  downloadCSV,
  formatNumber,
  roundTo,
  escapeHtml,
  resolveStudentShift,
} from './config.js';
import { icon } from './icons.js';
import { initResearchInfoModal, openResearchInfoModal } from './research-info.js';

const ACC_THRESHOLD = 85;

const QUADRANT_META = {
  LEADER: {
    key: 'LEADER',
    order: 1,
    shortLabel: 'ไวและแม่น',
    fullLabel: 'ไวและแม่น (กลุ่มนำ)',
    color: '#10b981',
    bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  FAST_SLOPPY: {
    key: 'FAST_SLOPPY',
    order: 2,
    shortLabel: 'มือไวแต่พลาดบ่อย',
    fullLabel: 'มือไวแต่พลาดบ่อย (เน้นฝึกความแม่นยำ)',
    color: '#f59e0b',
    bgClass: 'bg-amber-50 border-amber-200 text-amber-800',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  SLOW_ACCURATE: {
    key: 'SLOW_ACCURATE',
    order: 3,
    shortLabel: 'ช้าแต่ชัวร์',
    fullLabel: 'ช้าแต่ชัวร์ (เน้นเร่งความเร็ว)',
    color: '#3b82f6',
    bgClass: 'bg-blue-50 border-blue-200 text-blue-800',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  NEEDS_SUPPORT: {
    key: 'NEEDS_SUPPORT',
    order: 4,
    shortLabel: 'ต้องเสริมใกล้ชิด',
    fullLabel: 'ต้องเสริมใกล้ชิด (เน้นจำตำแหน่งแป้น)',
    color: '#f43f5e',
    bgClass: 'bg-rose-50 border-rose-200 text-rose-800',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  NO_DATA: {
    key: 'NO_DATA',
    order: 5,
    shortLabel: 'ยังไม่มีข้อมูล',
    fullLabel: 'ยังไม่มีข้อมูล',
    color: '#94a3b8',
    bgClass: 'bg-slate-50 border-slate-200 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
  },
};

if (typeof window.Chart !== 'undefined') {
  window.Chart.defaults.font.family = "'Sarabun', 'Noto Sans Thai', sans-serif";
  window.Chart.defaults.color = '#334155';
}

const whiteCanvasBgPlugin = {
  id: 'whiteCanvasBg',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const quadrantDiagnosticPlugin = {
  id: 'quadrantDiagnostic',
  beforeDatasetsDraw(chart, _args, opts) {
    if (!opts || !Number.isFinite(opts.medianX)) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.x || !scales?.y) return;

    const { left, right, top, bottom } = chartArea;
    const xSplit = Math.min(right, Math.max(left, scales.x.getPixelForValue(opts.medianX)));
    const ySplit = Math.min(bottom, Math.max(top, scales.y.getPixelForValue(opts.accY ?? ACC_THRESHOLD)));

    ctx.save();
    // Subtle 4-quadrant tint zones
    ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.fillRect(xSplit, top, right - xSplit, ySplit - top);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
    ctx.fillRect(xSplit, ySplit, right - xSplit, bottom - ySplit);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
    ctx.fillRect(left, top, xSplit - left, ySplit - top);

    ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
    ctx.fillRect(left, ySplit, xSplit - left, bottom - ySplit);

    // Dashed reference lines
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(xSplit, top);
    ctx.lineTo(xSplit, bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(left, ySplit);
    ctx.lineTo(right, ySplit);
    ctx.stroke();

    ctx.setLineDash([]);

    // Corner quadrant labels & median indicator
    ctx.font = "700 11px 'Sarabun', 'Noto Sans Thai', sans-serif";
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#047857';
    ctx.textAlign = 'right';
    ctx.fillText('ไวและแม่น (กลุ่มนำ)', right - 8, top + 8);

    ctx.fillStyle = '#1d4ed8';
    ctx.textAlign = 'left';
    ctx.fillText('ช้าแต่ชัวร์ (เร่งความเร็ว)', left + 8, top + 8);

    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#b45309';
    ctx.textAlign = 'right';
    ctx.fillText('มือไวแต่พลาดบ่อย (เน้นแม่นยำ)', right - 8, bottom - 8);

    ctx.fillStyle = '#be123c';
    ctx.textAlign = 'left';
    ctx.fillText('ต้องเสริมใกล้ชิด (เน้นตำแหน่งแป้น)', left + 8, bottom - 8);

    // Reference labels
    ctx.font = "700 10px 'Sarabun', 'Noto Sans Thai', sans-serif";
    ctx.fillStyle = '#475569';
    ctx.textBaseline = 'top';
    ctx.textAlign = xSplit > right - 95 ? 'right' : 'left';
    ctx.fillText(`Median ${opts.medianX.toFixed(1)} WPM`, xSplit + (xSplit > right - 95 ? -5 : 5), top + 24);

    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillText(`เกณฑ์ ${opts.accY ?? ACC_THRESHOLD}%`, right - 8, ySplit - 4);

    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "700 10px 'Sarabun', 'Noto Sans Thai', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((ds, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      if (meta.hidden) return;
      meta.data.forEach((pointEl, idx) => {
        const raw = ds.data[idx];
        if (!raw || raw.student_no === undefined) return;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(String(raw.student_no), pointEl.x, pointEl.y - 8);
      });
    });

    ctx.restore();
  },
};

const els = {
  authView: document.getElementById('dash-auth-view'),
  mainView: document.getElementById('dash-main-view'),
  loginForm: document.getElementById('dash-login-form'),
  emailInput: document.getElementById('dash-email'),
  passwordInput: document.getElementById('dash-password'),
  loginBtn: document.getElementById('dash-login-btn'),
  loginError: document.getElementById('dash-login-error'),
  userEmail: document.getElementById('dash-user-email'),
  logoutBtn: document.getElementById('dash-logout-btn'),
  btnRefresh: document.getElementById('btn-dash-refresh'),
  btnResearchInfo: document.getElementById('btn-dash-research-info'),
  loadingBanner: document.getElementById('dash-loading'),

  // Filters
  filterIepAll: document.getElementById('filter-iep-all'),
  filterIepResearch: document.getElementById('filter-iep-research'),
  filterStudentSelect: document.getElementById('filter-student-select'),

  // KPIs
  kpiWpmPre: document.getElementById('kpi-wpm-pre'),
  kpiWpmPost: document.getElementById('kpi-wpm-post'),
  kpiWpmDelta: document.getElementById('kpi-wpm-delta'),
  kpiWpmSub: document.getElementById('kpi-wpm-sub'),
  kpiWpmStats: document.getElementById('kpi-wpm-stats'),

  kpiAccPre: document.getElementById('kpi-acc-pre'),
  kpiAccPost: document.getElementById('kpi-acc-post'),
  kpiAccDelta: document.getElementById('kpi-acc-delta'),
  kpiAccSub: document.getElementById('kpi-acc-sub'),
  kpiAccStats: document.getElementById('kpi-acc-stats'),

  kpiSpeedLossVal: document.getElementById('kpi-speedloss-val'),
  kpiSpeedLossSub: document.getElementById('kpi-speedloss-sub'),
  kpiSpeedLossDetail: document.getElementById('kpi-speedloss-detail'),

  kpiAttendancePct: document.getElementById('kpi-attendance-pct'),
  kpiSessionsCount: document.getElementById('kpi-sessions-count'),
  kpiLogsTotal: document.getElementById('kpi-logs-total'),
  kpiWarningsDetail: document.getElementById('kpi-warnings-detail'),

  // Diagnostic Scatter
  scatterSubtitle: document.getElementById('scatter-subtitle'),
  scatterModeLatest: document.getElementById('scatter-mode-latest'),
  scatterModePretest: document.getElementById('scatter-mode-pretest'),
  canvasDiagnosticScatter: document.getElementById('chart-diagnostic-scatter'),
  quadrantSummaryStrip: document.getElementById('quadrant-summary-strip'),

  // Core 4 Charts
  chartPrePostSubtitle: document.getElementById('chart-prepost-subtitle'),
  canvasLearningCurve: document.getElementById('chart-learning-curve'),
  canvasPrePostStudent: document.getElementById('chart-prepost-student'),
  canvasWeakKeys: document.getElementById('chart-weak-keys'),
  canvasShiftCompare: document.getElementById('chart-shift-compare'),
  downloadChartButtons: document.querySelectorAll('[data-download-chart]'),

  // Table & Exports
  sortableHeaders: document.querySelectorAll('.sortable-th'),
  summaryTbody: document.getElementById('summary-table-tbody'),
  btnCopyCh4Stats: document.getElementById('btn-copy-ch4-stats'),
  btnDownloadCh4Word: document.getElementById('btn-download-ch4-word'),
  btnExportRaw: document.getElementById('btn-export-raw'),
  btnExportPaired: document.getElementById('btn-export-paired'),

  // Student Summary Modal
  studentModal: document.getElementById('student-summary-modal'),
  ssModalTitle: document.getElementById('ss-modal-title'),
  ssModalBadges: document.getElementById('ss-modal-badges'),
  ssModalBody: document.getElementById('ss-modal-body'),
  ssStatTiles: document.getElementById('ss-stat-tiles'),
  ssCoachingNote: document.getElementById('ss-coaching-note'),
  ssWeakKeysList: document.getElementById('ss-weak-keys-list'),
  ssHistoryTbody: document.getElementById('ss-history-tbody'),
  ssCloseX: document.getElementById('ss-close-x'),
  ssCloseFooter: document.getElementById('ss-close-footer'),
  ssCopySummary: document.getElementById('ss-copy-summary'),
};

const state = {
  user: null,
  students: [],
  sessions: [],
  logs: [],
  excludeIep: false,
  selectedStudentId: 'ALL',
  scatterMode: 'latest', // 'latest' | 'pretest'
  sortKey: 'student_no',
  sortDir: 'asc',
  activeSummaryStudentId: null,
  charts: {
    diagnosticScatter: null,
    learningCurve: null,
    prePostStudent: null,
    weakKeys: null,
    shiftCompare: null,
  },
  computed: null,
};

// ============================================================================
// Thai Key Label & Statistical Utilities (Strict-Stop & SPSS Compatible)
// ============================================================================
export function formatThaiKeyLabel(ch) {
  if (ch === ' ') return 'Spacebar';
  if (typeof ch === 'string' && /^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]$/.test(ch)) {
    return `◌${ch}`;
  }
  return String(ch ?? '');
}

function calcStats(values) {
  if (!values || values.length === 0) {
    return { n: 0, mean: null, sd: null, median: null, min: null, max: null };
  }
  const n = values.length;
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { n, mean, sd, median, min: sorted[0], max: sorted[n - 1] };
}

function calcMean(values) {
  return calcStats(values).mean;
}

function getLogNetCpm(log) {
  if (!log) return null;
  if (log.net_cpm !== null && log.net_cpm !== undefined && Number.isFinite(Number(log.net_cpm))) {
    return Number(log.net_cpm);
  }
  return Number(log.net_wpm) * 5;
}

function getLogSpeedLoss(log) {
  if (!log) return null;
  return Math.max(0, Number(log.gross_wpm) - Number(log.net_wpm));
}

function flattenWeakKeys(weakKeysObj) {
  if (!weakKeysObj || typeof weakKeysObj !== 'object') return '';
  return Object.entries(weakKeysObj)
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([key, count]) => `${key}:${count}`)
    .join('; ');
}

function classifyQuadrant(wpm, acc, medianWpm) {
  if (wpm === null || acc === null || medianWpm === null) return QUADRANT_META.NO_DATA;
  if (wpm >= medianWpm && acc >= ACC_THRESHOLD) return QUADRANT_META.LEADER;
  if (wpm >= medianWpm && acc < ACC_THRESHOLD) return QUADRANT_META.FAST_SLOPPY;
  if (wpm < medianWpm && acc >= ACC_THRESHOLD) return QUADRANT_META.SLOW_ACCURATE;
  return QUADRANT_META.NEEDS_SUPPORT;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ============================================================================
// Data Fetching (Paginated so large log counts never truncate)
// ============================================================================
async function fetchAllTypingLogs() {
  const pageSize = 1000;
  let offset = 0;
  const allRows = [];

  while (true) {
    const { data, error } = await supabase
      .from('typing_logs')
      .select(
        'log_id, created_at, session_id, week_no, mode, stage_id, student_id, student_no, shift_no, duration_actual_sec, total_keystrokes, correct_chars, error_keystrokes, words_completed, gross_cpm, net_cpm, gross_wpm, net_wpm, accuracy_pct, max_combo, eng_lang_warnings, weak_keys_json, device_tag'
      )
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

async function loadAllResearchData() {
  els.loadingBanner.classList.remove('hidden');
  try {
    const [studentsRes, sessionsRes, logs] = await Promise.all([
      supabase
        .from('students')
        .select('student_id, student_no, full_name, default_shift, is_iep_excluded')
        .order('student_no', { ascending: true }),
      supabase
        .from('sessions')
        .select('session_id, session_date, week_no, mode, stage_id, session_pin, duration_sec, is_active')
        .order('week_no', { ascending: true }),
      fetchAllTypingLogs(),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (sessionsRes.error) throw sessionsRes.error;

    state.students = studentsRes.data || [];
    state.sessions = sessionsRes.data || [];
    state.logs = logs;

    updateFilterLabelsAndOptions();
    recomputeAndRender();
  } catch (err) {
    alert(`โหลดข้อมูลวิจัยไม่สำเร็จ: ${err.message}`);
  } finally {
    els.loadingBanner.classList.add('hidden');
  }
}

// ============================================================================
// Filter Controls
// ============================================================================
function updateFilterLabelsAndOptions() {
  const totalN = state.students.length;
  const researchN = state.students.filter((s) => !s.is_iep_excluded).length;

  els.filterIepAll.textContent = `รวมนักเรียนทั้งหมด (N=${totalN})`;
  els.filterIepResearch.textContent = `เฉพาะกลุ่มวิเคราะห์วิจัย ไม่รวม IEP (N=${researchN})`;

  const eligible = state.excludeIep
    ? state.students.filter((s) => !s.is_iep_excluded)
    : state.students;

  const prevSelected = state.selectedStudentId;
  const stillExists = prevSelected === 'ALL' || eligible.some((s) => s.student_id === prevSelected);
  if (!stillExists) {
    state.selectedStudentId = 'ALL';
  }

  els.filterStudentSelect.innerHTML = [
    '<option value="ALL">ภาพรวมทั้งห้อง</option>',
    ...eligible.map(
      (s) =>
        `<option value="${escapeHtml(s.student_id)}">เลขที่ ${escapeHtml(s.student_no)} — ${escapeHtml(s.full_name)}${s.is_iep_excluded ? ' [IEP]' : ''}</option>`
    ),
  ].join('');
  els.filterStudentSelect.value = state.selectedStudentId;

  const activeCls = 'px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold bg-white text-indigo-700 shadow-xs transition';
  const inactiveCls = 'px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold text-slate-600 hover:text-slate-900 transition';
  els.filterIepAll.className = !state.excludeIep ? activeCls : inactiveCls;
  els.filterIepResearch.className = state.excludeIep ? activeCls : inactiveCls;
}

function updateScatterToggleUI() {
  const activeCls = 'px-3 py-1 rounded-lg text-xs font-bold bg-white text-indigo-700 shadow-xs transition';
  const inactiveCls = 'px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition';
  els.scatterModeLatest.className = state.scatterMode === 'latest' ? activeCls : inactiveCls;
  els.scatterModePretest.className = state.scatterMode === 'pretest' ? activeCls : inactiveCls;
}

// ============================================================================
// Core Analytics Engine (Strict-Stop Aligned)
// ============================================================================
function computeAnalytics() {
  let filteredStudents = state.excludeIep
    ? state.students.filter((s) => !s.is_iep_excluded)
    : [...state.students];

  if (state.selectedStudentId !== 'ALL') {
    filteredStudents = filteredStudents.filter((s) => s.student_id === state.selectedStudentId);
  }

  const studentMap = new Map(filteredStudents.map((s) => [s.student_id, s]));
  const filteredLogs = state.logs.filter((log) => studentMap.has(log.student_id));
  const hasAnyActualPosttest = filteredLogs.some((l) => l.mode === 'POSTTEST');

  const rawSummaries = filteredStudents.map((st) => {
    const myLogs = filteredLogs
      .filter((l) => l.student_id === st.student_id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const preLogs = myLogs.filter((l) => l.mode === 'PRETEST');
    const postLogs = myLogs.filter((l) => l.mode === 'POSTTEST');
    const practiceLogs = myLogs.filter((l) => l.mode === 'PRACTICE');

    const preLog = preLogs.length > 0 ? preLogs[preLogs.length - 1] : null;
    const postLog = postLogs.length > 0 ? postLogs[postLogs.length - 1] : null;
    const latestPracticeLog = practiceLogs.length > 0 ? practiceLogs[practiceLogs.length - 1] : null;

    // For KPI Pre vs Post/Latest & Chart 2: Posttest if available, else Latest Practice
    const compareLog = postLog || (!hasAnyActualPosttest ? latestPracticeLog : null);
    // For Latest display & Diagnostic Scatter: Posttest -> Latest Practice -> Pretest
    const latestLog = postLog || latestPracticeLog || preLog;

    const preGrossWpm = preLog ? Number(preLog.gross_wpm) : null;
    const preWpm = preLog ? Number(preLog.net_wpm) : null;
    const preNetCpm = preLog ? getLogNetCpm(preLog) : null;
    const preAcc = preLog ? Number(preLog.accuracy_pct) : null;

    const postGrossWpm = postLog ? Number(postLog.gross_wpm) : null;
    const postWpm = postLog ? Number(postLog.net_wpm) : null;
    const postNetCpm = postLog ? getLogNetCpm(postLog) : null;
    const postAcc = postLog ? Number(postLog.accuracy_pct) : null;

    const compareGrossWpm = compareLog ? Number(compareLog.gross_wpm) : null;
    const compareWpm = compareLog ? Number(compareLog.net_wpm) : null;
    const compareNetCpm = compareLog ? getLogNetCpm(compareLog) : null;
    const compareAcc = compareLog ? Number(compareLog.accuracy_pct) : null;

    const latestGrossWpm = latestLog ? Number(latestLog.gross_wpm) : null;
    const latestWpm = latestLog ? Number(latestLog.net_wpm) : null;
    const latestNetCpm = latestLog ? getLogNetCpm(latestLog) : null;
    const latestAcc = latestLog ? Number(latestLog.accuracy_pct) : null;
    const latestSpeedLoss = latestLog ? getLogSpeedLoss(latestLog) : null;

    const avgPracticeWpm = calcMean(practiceLogs.map((l) => Number(l.net_wpm)));
    const diffNetWpmActual = preWpm !== null && postWpm !== null ? postWpm - preWpm : null;
    const diffAccActual = preAcc !== null && postAcc !== null ? postAcc - preAcc : null;
    // Table delta: Post/Latest minus Pretest (when latest is not the exact same log as preLog)
    const deltaWpm =
      preWpm !== null && latestWpm !== null && latestLog !== preLog
        ? latestWpm - preWpm
        : null;
    const deltaAcc =
      preAcc !== null && latestAcc !== null && latestLog !== preLog
        ? latestAcc - preAcc
        : null;

    // Aggregate per-student weak keys
    const myWeakMap = new Map();
    for (const log of myLogs) {
      const wkObj = log.weak_keys_json;
      if (!wkObj || typeof wkObj !== 'object') continue;
      for (const [ch, count] of Object.entries(wkObj)) {
        const n = Number(count) || 0;
        if (n > 0) myWeakMap.set(ch, (myWeakMap.get(ch) || 0) + n);
      }
    }
    const topWeakKeys = Array.from(myWeakMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([char, count]) => ({ char, label: formatThaiKeyLabel(char), count }));

    const totalEngWarnings = myLogs.reduce((acc, l) => acc + Number(l.eng_lang_warnings || 0), 0);

    return {
      student_id: st.student_id,
      student_no: st.student_no,
      full_name: st.full_name,
      default_shift: resolveStudentShift(st, state.students.length),
      is_iep_excluded: Boolean(st.is_iep_excluded),
      myLogs,
      preLog,
      postLog,
      compareLog,
      latestLog,
      preGrossWpm,
      preWpm,
      preNetCpm,
      preAcc,
      postGrossWpm,
      postWpm,
      postNetCpm,
      postAcc,
      compareGrossWpm,
      compareWpm,
      compareNetCpm,
      compareAcc,
      latestGrossWpm,
      latestWpm,
      latestNetCpm,
      latestAcc,
      latestSpeedLoss,
      avgPracticeWpm,
      diffNetWpmActual,
      diffAccActual,
      deltaWpm,
      deltaAcc,
      practiceCount: practiceLogs.length,
      rounds: myLogs.length,
      totalEngWarnings,
      topWeakKeys,
      topWeakKey: topWeakKeys[0] || null,
      topWeakCount: topWeakKeys[0]?.count || 0,
    };
  });

  // Compute class median WPM for Latest & Pretest (for 4-quadrant diagnostic classification)
  const latestWpmMedian = calcStats(rawSummaries.map((s) => s.latestWpm).filter((v) => v !== null)).median;
  const pretestWpmMedian = calcStats(rawSummaries.map((s) => s.preWpm).filter((v) => v !== null)).median;

  const studentSummaries = rawSummaries.map((s) => {
    const latestQuadrant = classifyQuadrant(s.latestWpm, s.latestAcc, latestWpmMedian);
    const pretestQuadrant = classifyQuadrant(s.preWpm, s.preAcc, pretestWpmMedian);
    return {
      ...s,
      latestQuadrant,
      pretestQuadrant,
      quadrantOrder: latestQuadrant.order,
    };
  });

  // Stats for KPIs & Chapter 4 Copy Table
  const preWpmStats = calcStats(studentSummaries.map((r) => r.preWpm).filter((v) => v !== null));
  const compWpmStats = calcStats(studentSummaries.map((r) => r.compareWpm).filter((v) => v !== null));
  const preCpmStats = calcStats(studentSummaries.map((r) => r.preNetCpm).filter((v) => v !== null));
  const compCpmStats = calcStats(studentSummaries.map((r) => r.compareNetCpm).filter((v) => v !== null));
  const preGrossStats = calcStats(studentSummaries.map((r) => r.preGrossWpm).filter((v) => v !== null));
  const compGrossStats = calcStats(studentSummaries.map((r) => r.compareGrossWpm).filter((v) => v !== null));
  const preAccStats = calcStats(studentSummaries.map((r) => r.preAcc).filter((v) => v !== null));
  const compAccStats = calcStats(studentSummaries.map((r) => r.compareAcc).filter((v) => v !== null));

  // Speed Loss KPI: prefer Posttest/Latest compare set; fallback to latestLog across students
  const hasCompSpeed = compWpmStats.n > 0;
  const speedBasisLabel = hasAnyActualPosttest
    ? 'จากรอบ Posttest'
    : hasCompSpeed
      ? 'จากรอบฝึกครั้งล่าสุด'
      : 'จากรอบ Pretest';
  const basisGrossVals = (hasCompSpeed
    ? studentSummaries.map((r) => r.compareGrossWpm)
    : studentSummaries.map((r) => r.latestGrossWpm)
  ).filter((v) => v !== null);
  const basisNetVals = (hasCompSpeed
    ? studentSummaries.map((r) => r.compareWpm)
    : studentSummaries.map((r) => r.latestWpm)
  ).filter((v) => v !== null);
  const basisLossVals = (hasCompSpeed
    ? studentSummaries.map((r) => (r.compareLog ? getLogSpeedLoss(r.compareLog) : null))
    : studentSummaries.map((r) => r.latestSpeedLoss)
  ).filter((v) => v !== null);

  const speedLossGrossMean = calcMean(basisGrossVals);
  const speedLossNetMean = calcMean(basisNetVals);
  const speedLossMean = calcMean(basisLossVals);

  const uniqueSessionIdsInLogs = new Set(filteredLogs.map((l) => l.session_id));
  const totalRecordedSessions = Math.max(state.sessions.length, uniqueSessionIdsInLogs.size);
  const expectedLogCount = filteredStudents.length * totalRecordedSessions;
  const attendancePct = expectedLogCount > 0 ? Math.min(100, (filteredLogs.length / expectedLogCount) * 100) : null;

  const totalWarnings = filteredLogs.reduce((acc, l) => acc + Number(l.eng_lang_warnings || 0), 0);
  const avgWarnings = filteredLogs.length > 0 ? totalWarnings / filteredLogs.length : 0;

  // Learning Curve by week_no
  const weekBuckets = new Map();
  for (const log of filteredLogs) {
    const wk = Number(log.week_no);
    if (!weekBuckets.has(wk)) {
      weekBuckets.set(wk, { wpms: [], accs: [] });
    }
    weekBuckets.get(wk).wpms.push(Number(log.net_wpm));
    weekBuckets.get(wk).accs.push(Number(log.accuracy_pct));
  }
  const sortedWeeks = Array.from(weekBuckets.keys()).sort((a, b) => a - b);
  const learningCurve = sortedWeeks.map((wk) => ({
    week_no: wk,
    label: wk === 0 ? 'สัปดาห์ 0 (Pre)' : `สัปดาห์ ${wk}`,
    meanWpm: roundTo(calcMean(weekBuckets.get(wk).wpms), 2),
    meanAcc: roundTo(calcMean(weekBuckets.get(wk).accs), 2),
  }));

  // Top 10 Weak Keys across filtered logs
  const weakKeyCounts = new Map();
  for (const log of filteredLogs) {
    const wkObj = log.weak_keys_json;
    if (!wkObj || typeof wkObj !== 'object') continue;
    for (const [char, count] of Object.entries(wkObj)) {
      const n = Number(count) || 0;
      if (n > 0) {
        weakKeyCounts.set(char, (weakKeyCounts.get(char) || 0) + n);
      }
    }
  }
  const topWeakKeys = Array.from(weakKeyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([char, count]) => ({ char, label: formatThaiKeyLabel(char), count }));

  // Shift 1 vs Shift 2 Comparison
  const shift1Logs = filteredLogs.filter((l) => Number(l.shift_no) === 1);
  const shift2Logs = filteredLogs.filter((l) => Number(l.shift_no) === 2);
  const shiftCompare = {
    shift1Wpm: roundTo(calcMean(shift1Logs.map((l) => Number(l.net_wpm))) ?? 0, 2),
    shift2Wpm: roundTo(calcMean(shift2Logs.map((l) => Number(l.net_wpm))) ?? 0, 2),
    shift1Acc: roundTo(calcMean(shift1Logs.map((l) => Number(l.accuracy_pct))) ?? 0, 2),
    shift2Acc: roundTo(calcMean(shift2Logs.map((l) => Number(l.accuracy_pct))) ?? 0, 2),
    shift1Count: shift1Logs.length,
    shift2Count: shift2Logs.length,
  };

  return {
    filteredStudents,
    filteredLogs,
    studentMap,
    studentSummaries,
    hasAnyActualPosttest,
    latestWpmMedian,
    pretestWpmMedian,
    stats: {
      preWpm: preWpmStats,
      compWpm: compWpmStats,
      preCpm: preCpmStats,
      compCpm: compCpmStats,
      preGross: preGrossStats,
      compGross: compGrossStats,
      preAcc: preAccStats,
      compAcc: compAccStats,
    },
    kpi: {
      speedBasisLabel,
      speedLossGrossMean,
      speedLossNetMean,
      speedLossMean,
      totalRecordedSessions,
      totalFilteredLogs: filteredLogs.length,
      attendancePct,
      totalWarnings,
      avgWarnings,
    },
    learningCurve,
    topWeakKeys,
    shiftCompare,
  };
}

// ============================================================================
// Render 4 Strict-Stop KPI Cards
// ============================================================================
function formatMedMinMax(st, suffix = '') {
  if (!st || st.n === 0) return '-';
  return `${formatNumber(st.median, 2)}${suffix} (${formatNumber(st.min, 1)}–${formatNumber(st.max, 1)})`;
}

function renderKPIs(data) {
  const { stats, kpi, hasAnyActualPosttest, filteredStudents } = data;
  const compLabel = hasAnyActualPosttest ? 'Posttest' : 'ฝึกครั้งล่าสุด';

  // KPI 1: Net WPM & Net CPM
  els.kpiWpmPre.textContent = formatNumber(stats.preWpm.mean, 2);
  els.kpiWpmPost.textContent = formatNumber(stats.compWpm.mean, 2);
  els.kpiWpmSub.textContent = `Pretest เทียบ ${compLabel} (N=${filteredStudents.length})`;

  if (stats.preWpm.mean !== null && stats.compWpm.mean !== null) {
    const delta = stats.compWpm.mean - stats.preWpm.mean;
    const pctGain = stats.preWpm.mean > 0 ? (delta / stats.preWpm.mean) * 100 : 0;
    const sign = delta >= 0 ? '+' : '';
    els.kpiWpmDelta.textContent = `${sign}${formatNumber(delta, 2)} (${sign}${formatNumber(pctGain, 1)}%)`;
    els.kpiWpmDelta.className = delta >= 0
      ? 'text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0'
      : 'text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0';
  } else {
    els.kpiWpmDelta.textContent = '-';
    els.kpiWpmDelta.className = 'text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0';
  }

  const preCpmText = stats.preWpm.mean !== null ? formatNumber(stats.preWpm.mean * 5, 1) : '-';
  const compCpmText = stats.compWpm.mean !== null ? formatNumber(stats.compWpm.mean * 5, 1) : '-';
  els.kpiWpmStats.innerHTML = `
    <div>Net CPM: <strong>${preCpmText}</strong> เทียบ <strong class="text-blue-700">${compCpmText}</strong> อักขระ/นาที</div>
    <div>Pre: S.D. <strong>${formatNumber(stats.preWpm.sd, 2)}</strong> • Med <strong>${formatMedMinMax(stats.preWpm)}</strong></div>
    <div>${escapeHtml(compLabel)}: S.D. <strong>${formatNumber(stats.compWpm.sd, 2)}</strong> • Med <strong>${formatMedMinMax(stats.compWpm)}</strong></div>
  `;

  // KPI 2: Accuracy %
  els.kpiAccPre.textContent = stats.preAcc.mean !== null ? `${formatNumber(stats.preAcc.mean, 1)}%` : '-';
  els.kpiAccPost.textContent = stats.compAcc.mean !== null ? `${formatNumber(stats.compAcc.mean, 1)}%` : '-';
  els.kpiAccSub.textContent = `Pretest เทียบ ${compLabel}`;

  if (stats.preAcc.mean !== null && stats.compAcc.mean !== null) {
    const delta = stats.compAcc.mean - stats.preAcc.mean;
    const sign = delta >= 0 ? '+' : '';
    els.kpiAccDelta.textContent = `${sign}${formatNumber(delta, 2)}%`;
    els.kpiAccDelta.className = delta >= 0
      ? 'text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0'
      : 'text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0';
  } else {
    els.kpiAccDelta.textContent = '-';
    els.kpiAccDelta.className = 'text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0';
  }

  els.kpiAccStats.innerHTML = `
    <div>Pre: S.D. <strong>${formatNumber(stats.preAcc.sd, 2)}</strong> • Med <strong>${formatMedMinMax(stats.preAcc, '%')}</strong></div>
    <div>${escapeHtml(compLabel)}: S.D. <strong>${formatNumber(stats.compAcc.sd, 2)}</strong> • Med <strong>${formatMedMinMax(stats.compAcc, '%')}</strong></div>
  `;

  // KPI 3: Speed Loss
  els.kpiSpeedLossVal.textContent = kpi.speedLossMean !== null ? `-${formatNumber(kpi.speedLossMean, 2)}` : '-';
  els.kpiSpeedLossSub.textContent = `${kpi.speedBasisLabel} (Gross WPM - Net WPM)`;
  const lossPct =
    kpi.speedLossGrossMean && kpi.speedLossGrossMean > 0 && kpi.speedLossMean !== null
      ? (kpi.speedLossMean / kpi.speedLossGrossMean) * 100
      : null;
  els.kpiSpeedLossDetail.innerHTML = `
    <div>Mean Gross WPM: <strong>${formatNumber(kpi.speedLossGrossMean, 2)}</strong> • Net WPM: <strong class="text-blue-700">${formatNumber(kpi.speedLossNetMean, 2)}</strong></div>
    <div>สูญเสียความเร็วเฉลี่ยจากการแก้ตัวผิด: <strong class="text-amber-700">${lossPct !== null ? `${formatNumber(lossPct, 1)}%` : '-'}</strong></div>
  `;

  // KPI 4: Coverage & Field Issues
  els.kpiAttendancePct.textContent = kpi.attendancePct !== null ? `${formatNumber(kpi.attendancePct, 1)}%` : '-';
  els.kpiSessionsCount.textContent = `${kpi.totalRecordedSessions} รอบ`;
  els.kpiLogsTotal.textContent = `บันทึกผลการพิมพ์แล้ว ${kpi.totalFilteredLogs.toLocaleString('th-TH')} รายการ (N=${filteredStudents.length})`;
  els.kpiWarningsDetail.innerHTML = `
    <div>แจ้งเตือนลืมเปลี่ยนภาษา (~): <strong class="text-amber-700">${kpi.totalWarnings.toLocaleString('th-TH')} ครั้ง</strong></div>
    <div>เฉลี่ย <strong>${formatNumber(kpi.avgWarnings, 2)}</strong> ครั้ง/รอบฝึก (อภิปรายบทที่ 5)</div>
  `;
}

// ============================================================================
// Render Charts (Diagnostic 4-Quadrant Scatter + 4 Core Charts)
// ============================================================================
function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function renderDiagnosticScatter(data) {
  if (typeof window.Chart === 'undefined') return;
  const Chart = window.Chart;
  updateScatterToggleUI();

  const isPre = state.scatterMode === 'pretest';
  const medianX = isPre ? data.pretestWpmMedian : data.latestWpmMedian;
  const modeLabel = isPre ? 'Pretest' : (data.hasAnyActualPosttest ? 'Posttest / ล่าสุด' : 'ข้อมูลล่าสุด');

  const pointsByQuad = {
    LEADER: [],
    FAST_SLOPPY: [],
    SLOW_ACCURATE: [],
    NEEDS_SUPPORT: [],
  };

  let maxWpm = 10;
  let minAcc = 60;

  for (const st of data.studentSummaries) {
    const wpm = isPre ? st.preWpm : st.latestWpm;
    const gross = isPre ? st.preGrossWpm : st.latestGrossWpm;
    const acc = isPre ? st.preAcc : st.latestAcc;
    const q = isPre ? st.pretestQuadrant : st.latestQuadrant;

    if (wpm === null || acc === null || q.key === 'NO_DATA') continue;
    const loss = gross !== null ? Math.max(0, gross - wpm) : 0;
    if (wpm > maxWpm) maxWpm = wpm;
    if (acc < minAcc) minAcc = acc;

    pointsByQuad[q.key].push({
      x: roundTo(wpm, 2),
      y: roundTo(acc, 2),
      student_id: st.student_id,
      student_no: st.student_no,
      full_name: st.full_name,
      gross_wpm: gross !== null ? roundTo(gross, 2) : null,
      speed_loss: roundTo(loss, 2),
      quadrantLabel: q.fullLabel,
    });
  }

  const plottedTotal = Object.values(pointsByQuad).reduce((sum, arr) => sum + arr.length, 0);
  els.scatterSubtitle.textContent =
    plottedTotal > 0 && medianX !== null
      ? `ช่วงข้อมูล: ${modeLabel} (${plottedTotal} คน) • เส้นแบ่งแกน X = ค่ากลางห้อง ${formatNumber(medianX, 2)} WPM และแกน Y = 85% — คลิกจุดเพื่อเปิดใบสรุปผลรายบุคคล`
      : `ช่วงข้อมูล: ${modeLabel} — ยังไม่มีข้อมูลคะแนนสำหรับแสดงแผนภาพวินิจฉัย`;

  const datasets = ['LEADER', 'FAST_SLOPPY', 'SLOW_ACCURATE', 'NEEDS_SUPPORT'].map((qKey) => {
    const meta = QUADRANT_META[qKey];
    return {
      label: meta.shortLabel,
      data: pointsByQuad[qKey],
      backgroundColor: meta.color,
      borderColor: '#ffffff',
      borderWidth: 2,
      pointRadius: 7,
      pointHoverRadius: 9,
    };
  });

  const xMax = Math.ceil((maxWpm + 4) / 5) * 5;
  const yMin = Math.max(0, Math.floor((Math.min(minAcc, 70) - 5) / 5) * 5);

  destroyChart('diagnosticScatter');
  state.charts.diagnosticScatter = new Chart(els.canvasDiagnosticScatter, {
    type: 'scatter',
    plugins: [whiteCanvasBgPlugin, quadrantDiagnosticPlugin],
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick(_evt, elements) {
        if (!elements || elements.length === 0) return;
        const { datasetIndex, index } = elements[0];
        const pt = datasets[datasetIndex]?.data[index];
        if (pt?.student_id) {
          openStudentSummaryModal(pt.student_id);
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax: xMax,
          title: { display: true, text: 'ความเร็วสุทธิ (Net WPM)', font: { weight: 'bold' } },
        },
        y: {
          min: yMin,
          max: 102,
          ticks: {
            callback(v) {
              return v <= 100 ? `${v}%` : '';
            },
          },
          title: { display: true, text: 'ความแม่นยำ (Accuracy %)', font: { weight: 'bold' } },
        },
      },
      plugins: {
        quadrantDiagnostic: {
          medianX: medianX ?? 10,
          accY: ACC_THRESHOLD,
        },
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            title(items) {
              const raw = items[0]?.raw;
              return raw ? `เลขที่ ${raw.student_no} ${raw.full_name}` : '';
            },
            label(ctx) {
              const raw = ctx.raw;
              if (!raw) return '';
              return [
                `Net WPM: ${formatNumber(raw.x, 2)} WPM`,
                `Gross WPM: ${formatNumber(raw.gross_wpm, 2)} WPM (เสียจากการผิด -${formatNumber(raw.speed_loss, 2)})`,
                `Accuracy: ${formatNumber(raw.y, 2)}%`,
                `กลุ่ม: ${raw.quadrantLabel}`,
              ];
            },
          },
        },
      },
    },
  });

  // Render compact 4-card quadrant count strip
  els.quadrantSummaryStrip.innerHTML = ['LEADER', 'FAST_SLOPPY', 'SLOW_ACCURATE', 'NEEDS_SUPPORT']
    .map((qKey) => {
      const meta = QUADRANT_META[qKey];
      const count = pointsByQuad[qKey].length;
      const pct = plottedTotal > 0 ? Math.round((count / plottedTotal) * 100) : 0;
      return `
        <div class="p-3 rounded-2xl border flex items-center justify-between gap-2 ${meta.bgClass}">
          <div class="min-w-0">
            <div class="text-xs font-extrabold truncate">${escapeHtml(meta.shortLabel)}</div>
            <div class="text-[11px] opacity-80 truncate">${escapeHtml(meta.fullLabel.replace(meta.shortLabel, '').replace(/[()]/g, '').trim())}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-lg font-extrabold leading-none">${count} คน</div>
            <div class="text-[10px] font-bold opacity-75 mt-0.5">${pct}%</div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderCharts(data) {
  if (typeof window.Chart === 'undefined') return;
  const Chart = window.Chart;

  renderDiagnosticScatter(data);

  const compLabel = data.hasAnyActualPosttest ? 'Posttest Net WPM' : 'ฝึกครั้งล่าสุด Net WPM';
  const byNo = [...data.studentSummaries].sort((a, b) => a.student_no - b.student_no);
  const rangeSuffix =
    byNo.length === 0
      ? ''
      : byNo.length === 1
        ? ` (เลขที่ ${byNo[0].student_no})`
        : ` (เลขที่ ${byNo[0].student_no}–${byNo[byNo.length - 1].student_no}, N=${byNo.length})`;
  els.chartPrePostSubtitle.textContent = `Pretest Net WPM เทียบกับ ${compLabel}${rangeSuffix}`;

  // Chart 1: Learning Curve
  destroyChart('learningCurve');
  state.charts.learningCurve = new Chart(els.canvasLearningCurve, {
    type: 'line',
    plugins: [whiteCanvasBgPlugin],
    data: {
      labels: data.learningCurve.map((d) => d.label),
      datasets: [
        {
          label: 'Mean Net WPM',
          data: data.learningCurve.map((d) => d.meanWpm),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.14)',
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.25,
          yAxisID: 'yWpm',
        },
        {
          label: 'Mean Accuracy (%)',
          data: data.learningCurve.map((d) => d.meanAcc),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 3,
          borderDash: [5, 4],
          pointRadius: 4,
          tension: 0.25,
          yAxisID: 'yAcc',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        yWpm: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Net WPM', font: { weight: 'bold' } },
        },
        yAcc: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Accuracy (%)', font: { weight: 'bold' } },
        },
      },
      plugins: { legend: { position: 'top' } },
    },
  });

  // Chart 2: Pretest vs Posttest by Student
  destroyChart('prePostStudent');
  state.charts.prePostStudent = new Chart(els.canvasPrePostStudent, {
    type: 'bar',
    plugins: [whiteCanvasBgPlugin],
    data: {
      labels: byNo.map((s) => `${s.student_no}`),
      datasets: [
        {
          label: 'Pretest Net WPM',
          data: byNo.map((s) => (s.preWpm !== null ? roundTo(s.preWpm, 2) : null)),
          backgroundColor: '#94a3b8',
          borderRadius: 4,
        },
        {
          label: compLabel,
          data: byNo.map((s) => (s.compareWpm !== null ? roundTo(s.compareWpm, 2) : null)),
          backgroundColor: '#2563eb',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'เลขที่นักเรียน', font: { weight: 'bold' } } },
        y: { beginAtZero: true, title: { display: true, text: 'Net WPM', font: { weight: 'bold' } } },
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            title(items) {
              const idx = items[0]?.dataIndex;
              const st = byNo[idx];
              return st ? `เลขที่ ${st.student_no} — ${st.full_name}` : '';
            },
          },
        },
      },
    },
  });

  // Chart 3: Top 10 Missed Thai Keys (with ◌ formatting)
  destroyChart('weakKeys');
  state.charts.weakKeys = new Chart(els.canvasWeakKeys, {
    type: 'bar',
    plugins: [whiteCanvasBgPlugin],
    data: {
      labels: data.topWeakKeys.map((k) => k.label),
      datasets: [
        {
          label: 'จำนวนครั้งที่พิมพ์ผิด',
          data: data.topWeakKeys.map((k) => k.count),
          backgroundColor: '#f43f5e',
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'จำนวนครั้ง', font: { weight: 'bold' } } },
        y: { ticks: { font: { size: 14, weight: 'bold' } } },
      },
      plugins: { legend: { display: false } },
    },
  });

  // Chart 4: Shift 1 vs Shift 2 Comparison
  destroyChart('shiftCompare');
  state.charts.shiftCompare = new Chart(els.canvasShiftCompare, {
    type: 'bar',
    plugins: [whiteCanvasBgPlugin],
    data: {
      labels: [
        `ผลัดที่ 1 (${data.shiftCompare.shift1Count} รอบ)`,
        `ผลัดที่ 2 (${data.shiftCompare.shift2Count} รอบ)`,
      ],
      datasets: [
        {
          label: 'Mean Net WPM',
          data: [data.shiftCompare.shift1Wpm, data.shiftCompare.shift2Wpm],
          backgroundColor: '#3b82f6',
          borderRadius: 8,
          yAxisID: 'yWpm',
        },
        {
          label: 'Mean Accuracy (%)',
          data: [data.shiftCompare.shift1Acc, data.shiftCompare.shift2Acc],
          backgroundColor: '#10b981',
          borderRadius: 8,
          yAxisID: 'yAcc',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yWpm: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Net WPM', font: { weight: 'bold' } },
        },
        yAcc: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Accuracy (%)', font: { weight: 'bold' } },
        },
      },
      plugins: { legend: { position: 'top' } },
    },
  });
}

function downloadChartPng(chartKey) {
  const chart = state.charts[chartKey];
  if (!chart) return;

  const srcCanvas = chart.canvas;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = srcCanvas.width;
  outCanvas.height = srcCanvas.height;
  const ctx = outCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  ctx.drawImage(srcCanvas, 0, 0);

  const link = document.createElement('a');
  const suffix = state.excludeIep ? 'research_no_iep' : 'all_students';
  link.download = `thai_typing_${chartKey}_${suffix}.png`;
  link.href = outCanvas.toDataURL('image/png', 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// Render Upgraded Individual Summary Table
// ============================================================================
function renderSummaryTable(data) {
  const rows = [...data.studentSummaries];
  const { sortKey, sortDir } = state;

  rows.sort((a, b) => {
    const valA = a[sortKey];
    const valB = b[sortKey];

    if (valA === null && valB === null) return a.student_no - b.student_no;
    if (valA === null) return 1;
    if (valB === null) return -1;

    let cmp = 0;
    if (typeof valA === 'string') {
      cmp = valA.localeCompare(valB, 'th');
    } else if (typeof valA === 'boolean') {
      cmp = Number(valA) - Number(valB);
    } else {
      cmp = Number(valA) - Number(valB);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  els.sortableHeaders.forEach((th) => {
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    if (th.dataset.sort === sortKey) {
      ind.innerHTML = sortDir === 'asc'
        ? icon('chevronUp', 'w-3.5 h-3.5 text-indigo-600')
        : icon('chevronDown', 'w-3.5 h-3.5 text-indigo-600');
    } else {
      ind.innerHTML = '';
    }
  });

  if (rows.length === 0) {
    els.summaryTbody.innerHTML = '<tr><td colspan="13" class="py-8 text-center text-slate-400">ไม่พบข้อมูลนักเรียนตามตัวกรองที่เลือก</td></tr>';
    return;
  }

  els.summaryTbody.innerHTML = '';
  for (const r of rows) {
    const deltaClass =
      r.deltaWpm === null
        ? 'text-slate-400'
        : r.deltaWpm >= 0
          ? 'text-emerald-700 font-extrabold'
          : 'text-rose-600 font-extrabold';
    const deltaText = r.deltaWpm === null ? '-' : `${r.deltaWpm >= 0 ? '+' : ''}${formatNumber(r.deltaWpm, 2)}`;

    const weakBadge = r.topWeakKey
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs"><span>${escapeHtml(r.topWeakKey.label)}</span><span class="text-[10px] opacity-80">(${r.topWeakKey.count})</span></span>`
      : '<span class="text-slate-300">-</span>';

    const quad = r.latestQuadrant;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-blue-50/40 cursor-pointer transition-colors';
    tr.innerHTML = `
      <td class="py-2.5 px-2.5 font-extrabold text-slate-800 whitespace-nowrap">${escapeHtml(r.student_no)}</td>
      <td class="py-2.5 px-2.5 font-semibold text-slate-800 whitespace-normal break-words leading-snug min-w-[150px]">${escapeHtml(r.full_name)}</td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${r.default_shift === 1 ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'}">ผลัด ${r.default_shift}</span></td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">${r.is_iep_excluded ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">IEP</span>' : '<span class="text-slate-300">-</span>'}</td>
      <td class="py-2.5 px-2 text-right font-mono whitespace-nowrap">${formatNumber(r.preWpm, 2)}</td>
      <td class="py-2.5 px-2 text-right font-mono text-slate-600 whitespace-nowrap">${formatNumber(r.avgPracticeWpm, 2)}</td>
      <td class="py-2.5 px-2 text-right font-mono font-bold text-blue-700 whitespace-nowrap">${formatNumber(r.latestWpm, 2)}</td>
      <td class="py-2.5 px-2 text-right font-mono whitespace-nowrap ${deltaClass}">${deltaText}</td>
      <td class="py-2.5 px-2 text-right font-mono whitespace-nowrap">${r.preAcc !== null ? `${formatNumber(r.preAcc, 1)}%` : '-'}</td>
      <td class="py-2.5 px-2 text-right font-mono font-semibold whitespace-nowrap">${r.latestAcc !== null ? `${formatNumber(r.latestAcc, 1)}%` : '-'}</td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">${weakBadge}</td>
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${quad.badgeClass}">${escapeHtml(quad.shortLabel)}</span>
      </td>
      <td class="py-2.5 px-2.5 text-right whitespace-nowrap">
        <button type="button" data-open-summary="${escapeHtml(r.student_id)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition">
          ${icon('eye', 'w-3.5 h-3.5')}
          <span>ดูสรุป</span>
        </button>
      </td>
    `;

    tr.addEventListener('click', () => openStudentSummaryModal(r.student_id));
    tr.querySelector('[data-open-summary]').addEventListener('click', (e) => {
      e.stopPropagation();
      openStudentSummaryModal(r.student_id);
    });

    els.summaryTbody.appendChild(tr);
  }
}

// ============================================================================
// Teacher Student Summary Modal (ใบสรุปผลรายบุคคลสำหรับครู)
// ============================================================================
function buildCoachingNote(student) {
  const qKey = student.latestQuadrant.key;
  const weakPhrase = student.topWeakKey
    ? `ปุ่มที่พลาดบ่อยที่สุดคือ ${student.topWeakKey.label} (${student.topWeakKey.count} ครั้ง)`
    : 'ยังไม่พบปุ่มที่มีความผิดพลาดสะสมเด่นชัด';

  if (qKey === 'LEADER') {
    return `พิมพ์ได้เร็วกว่าค่ากลางของห้องและมีความแม่นยำสูง (กลุ่มนำ) สามารถมอบหมายด่านท้าทายระดับสูงหรือฝึกคำประสมและอักษรยกแคร่เพิ่มเติมได้ โดยเน้นทบทวน${weakPhrase}`;
  }
  if (qKey === 'FAST_SLOPPY') {
    const lossStr = student.latestSpeedLoss !== null ? ` (เสียความเร็วไป ${formatNumber(student.latestSpeedLoss, 2)} WPM)` : '';
    return `พิมพ์ได้เร็วกว่าค่ากลางห้อง แต่สูญเสียความเร็วจากการกดพลาดค่อนข้างมาก${lossStr} ควรเน้นชะลอจังหวะและฝึกซ้ำ${weakPhrase}`;
  }
  if (qKey === 'SLOW_ACCURATE') {
    return `วางนิ้วและพิมพ์ได้แม่นยำตามเกณฑ์แล้ว แต่จังหวะการเคาะยังช้ากว่าค่ากลางของห้อง ควรฝึกสร้างจังหวะต่อเนื่องเพื่อเพิ่มความเร็วโดยรักษาระดับความแม่นยำเดิม และทบทวน${weakPhrase}`;
  }
  if (qKey === 'NEEDS_SUPPORT') {
    return `ควรได้รับการดูแลใกล้ชิดเพื่อทบทวนตำแหน่งนิ้วบนแป้นเหย้าและแป้นหลักทีละแถวก่อนเร่งความเร็ว โดยเฉพาะการฝึกซ้ำ${weakPhrase}`;
  }
  return 'ยังไม่มีบันทึกผลการพิมพ์ของนักเรียนคนนี้ในระบบ';
}

function buildStudentPlainTextSummary(student) {
  const deltaWpmText =
    student.deltaWpm !== null
      ? `${student.deltaWpm >= 0 ? '+' : ''}${formatNumber(student.deltaWpm, 2)} WPM`
      : 'ยังไม่มีผลเทียบ';
  const deltaAccText =
    student.deltaAcc !== null
      ? `${student.deltaAcc >= 0 ? '+' : ''}${formatNumber(student.deltaAcc, 2)}%`
      : 'ยังไม่มีผลเทียบ';
  const top5Text =
    student.topWeakKeys.length > 0
      ? student.topWeakKeys
          .slice(0, 5)
          .map((k, idx) => `${idx + 1}. ${k.label} (${k.count} ครั้ง)`)
          .join(', ')
      : 'ไม่มี';

  return [
    `ใบสรุปผลการฝึกพิมพ์ดีดไทย ป.6 — เลขที่ ${student.student_no} ${student.full_name}`,
    `ผลัดที่ ${student.default_shift}${student.is_iep_excluded ? ' [IEP]' : ''} | กลุ่มพฤติกรรม: ${student.latestQuadrant.fullLabel}`,
    '----------------------------------------------------------------',
    `Net WPM ล่าสุด: ${formatNumber(student.latestWpm, 2)} WPM (Pretest: ${formatNumber(student.preWpm, 2)} | ผลต่าง: ${deltaWpmText})`,
    `Net CPM ล่าสุด: ${formatNumber(student.latestNetCpm, 2)} อักขระ/นาที`,
    `Gross WPM ล่าสุด: ${formatNumber(student.latestGrossWpm, 2)} WPM (เสียจากการกดผิด: -${formatNumber(student.latestSpeedLoss, 2)} WPM)`,
    `Accuracy % ล่าสุด: ${student.latestAcc !== null ? `${formatNumber(student.latestAcc, 2)}%` : '-'} (Pretest: ${student.preAcc !== null ? `${formatNumber(student.preAcc, 2)}%` : '-'} | ผลต่าง: ${deltaAccText})`,
    `จำนวนรอบที่บันทึกทั้งหมด: ${student.rounds} รอบ | เตือนเปลี่ยนภาษาสะสม: ${student.totalEngWarnings} ครั้ง`,
    `5 ปุ่มที่พลาดมากที่สุด: ${top5Text}`,
    `ข้อเสนอแนะสำหรับครู: ${buildCoachingNote(student)}`,
  ].join('\n');
}

function closeStudentSummaryModal() {
  els.studentModal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  state.activeSummaryStudentId = null;
}

function openStudentSummaryModal(studentId) {
  if (!state.computed) return;
  const student = state.computed.studentSummaries.find((s) => s.student_id === studentId);
  if (!student) return;

  state.activeSummaryStudentId = studentId;
  const quad = student.latestQuadrant;

  // Header & Badges
  els.ssModalTitle.textContent = `เลขที่ ${student.student_no} — ${student.full_name}`;
  els.ssModalBadges.innerHTML = [
    `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${student.default_shift === 1 ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800'}">ผลัดที่ ${student.default_shift}</span>`,
    student.is_iep_excluded
      ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">IEP (ไม่รวมกลุ่มวิเคราะห์)</span>'
      : '',
    `<span class="px-2.5 py-0.5 rounded-full border text-xs font-bold ${quad.badgeClass}">${escapeHtml(quad.fullLabel)}</span>`,
    `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">บันทึกแล้ว ${student.rounds} รอบ</span>`,
  ]
    .filter(Boolean)
    .join('');

  // 4 Summary Stat Tiles
  const deltaWpmSub =
    student.deltaWpm !== null
      ? `เทียบ Pretest: ${student.deltaWpm >= 0 ? '+' : ''}${formatNumber(student.deltaWpm, 2)} WPM`
      : student.preWpm !== null
        ? `Pretest: ${formatNumber(student.preWpm, 2)} WPM`
        : 'ยังไม่มีผล Pretest';

  const deltaAccSub =
    student.deltaAcc !== null
      ? `เทียบ Pretest: ${student.deltaAcc >= 0 ? '+' : ''}${formatNumber(student.deltaAcc, 2)}%`
      : student.preAcc !== null
        ? `Pretest: ${formatNumber(student.preAcc, 1)}%`
        : 'ยังไม่มีผล Pretest';

  els.ssStatTiles.innerHTML = `
    <div class="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
      <div class="text-[11px] font-bold text-blue-700">Net WPM ล่าสุด</div>
      <div class="font-mono text-2xl font-extrabold text-blue-900 mt-0.5">${formatNumber(student.latestWpm, 2)}</div>
      <div class="text-[11px] font-semibold text-blue-700/80 mt-0.5">${escapeHtml(deltaWpmSub)}</div>
    </div>
    <div class="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
      <div class="text-[11px] font-bold text-indigo-700">Net CPM ล่าสุด</div>
      <div class="font-mono text-2xl font-extrabold text-indigo-900 mt-0.5">${formatNumber(student.latestNetCpm, 2)}</div>
      <div class="text-[11px] font-semibold text-indigo-700/80 mt-0.5">อักขระถูกต้องต่อนาที</div>
    </div>
    <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
      <div class="text-[11px] font-bold text-amber-800">Gross WPM &amp; เสียจากการผิด</div>
      <div class="font-mono text-2xl font-extrabold text-slate-900 mt-0.5">${formatNumber(student.latestGrossWpm, 2)}</div>
      <div class="text-[11px] font-bold text-amber-700 mt-0.5">เสียจากการผิด: ${student.latestSpeedLoss !== null ? `-${formatNumber(student.latestSpeedLoss, 2)} WPM` : '-'}</div>
    </div>
    <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
      <div class="text-[11px] font-bold text-emerald-700">Accuracy % ล่าสุด</div>
      <div class="font-mono text-2xl font-extrabold text-emerald-800 mt-0.5">${student.latestAcc !== null ? `${formatNumber(student.latestAcc, 2)}%` : '-'}</div>
      <div class="text-[11px] font-semibold text-emerald-700/80 mt-0.5">${escapeHtml(deltaAccSub)}</div>
    </div>
  `;

  // Coaching Note
  els.ssCoachingNote.textContent = buildCoachingNote(student);

  // Top 5 Weak Keys List
  const top5 = student.topWeakKeys.slice(0, 5);
  if (top5.length === 0) {
    els.ssWeakKeysList.innerHTML = '<div class="text-xs text-slate-400 py-2">ยังไม่พบสถิติปุ่มที่พิมพ์พลาด</div>';
  } else {
    const maxCnt = top5[0].count || 1;
    els.ssWeakKeysList.innerHTML = top5
      .map((item) => {
        const widthPct = Math.max(8, Math.round((item.count / maxCnt) * 100));
        return `
          <div class="flex items-center gap-3">
            <span class="w-16 shrink-0 text-center font-bold text-sm px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">${escapeHtml(item.label)}</span>
            <div class="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden">
              <div class="h-full bg-rose-500 rounded-lg transition-all" style="width: ${widthPct}%"></div>
            </div>
            <span class="w-16 shrink-0 text-right font-mono text-xs font-extrabold text-slate-700">${item.count} ครั้ง</span>
          </div>
        `;
      })
      .join('');
  }

  // Full Session History Table
  if (student.myLogs.length === 0) {
    els.ssHistoryTbody.innerHTML = '<tr><td colspan="10" class="py-6 text-center text-slate-400">ยังไม่มีประวัติการส่งคะแนน</td></tr>';
  } else {
    els.ssHistoryTbody.innerHTML = [...student.myLogs]
      .reverse()
      .map((l) => {
        const modeLabel = MODE_LABELS[l.mode] || l.mode;
        const modeCls =
          l.mode === 'PRETEST'
            ? 'bg-purple-100 text-purple-700'
            : l.mode === 'POSTTEST'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-sky-100 text-sky-700';
        return `
          <tr class="hover:bg-slate-50">
            <td class="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">สัปดาห์ ${escapeHtml(l.week_no)}</td>
            <td class="py-2 px-2.5 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${modeCls}">${escapeHtml(modeLabel)}</span></td>
            <td class="py-2 px-2.5 text-right font-mono whitespace-nowrap">${escapeHtml(l.duration_actual_sec)} วิ</td>
            <td class="py-2 px-2.5 text-right font-mono whitespace-nowrap">${escapeHtml(l.correct_chars)}/${escapeHtml(l.error_keystrokes)}/${escapeHtml(l.total_keystrokes)}</td>
            <td class="py-2 px-2.5 text-right font-mono whitespace-nowrap">${formatNumber(l.gross_wpm, 2)}</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold text-blue-700 whitespace-nowrap">${formatNumber(l.net_wpm, 2)}</td>
            <td class="py-2 px-2.5 text-right font-mono whitespace-nowrap">${formatNumber(getLogNetCpm(l), 2)}</td>
            <td class="py-2 px-2.5 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">${formatNumber(l.accuracy_pct, 2)}%</td>
            <td class="py-2 px-2.5 text-right font-mono whitespace-nowrap">${escapeHtml(l.eng_lang_warnings || 0)}</td>
            <td class="py-2 px-2.5 text-right font-mono text-slate-500 whitespace-nowrap">${escapeHtml(l.device_tag || '-')}</td>
          </tr>
        `;
      })
      .join('');
  }

  els.ssModalBody.scrollTop = 0;
  els.studentModal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

// ============================================================================
// Research CSV Exports & Chapter 4 Stats Copy (UTF-8 BOM / TSV)
// ============================================================================
function exportRawLogsCSV() {
  if (!state.computed) return;
  const { filteredLogs, studentMap } = state.computed;
  const headers = [
    'log_id',
    'created_at',
    'session_id',
    'week_no',
    'mode',
    'stage_id',
    'student_id',
    'student_no',
    'student_name',
    'shift_no',
    'is_iep_excluded',
    'duration_actual_sec',
    'total_keystrokes',
    'correct_chars',
    'error_keystrokes',
    'words_completed',
    'gross_cpm',
    'net_cpm',
    'gross_wpm',
    'net_wpm',
    'speed_loss_wpm',
    'accuracy_pct',
    'max_combo',
    'eng_lang_warnings',
    'weak_keys_json',
    'device_tag',
  ];

  const rows = filteredLogs.map((l) => {
    const st = studentMap.get(l.student_id);
    const speedLoss = roundTo(getLogSpeedLoss(l) ?? 0, 2);
    return [
      l.log_id,
      l.created_at,
      l.session_id,
      l.week_no,
      l.mode,
      l.stage_id,
      l.student_id,
      l.student_no,
      st?.full_name || '',
      l.shift_no,
      st?.is_iep_excluded ? 'TRUE' : 'FALSE',
      l.duration_actual_sec,
      l.total_keystrokes,
      l.correct_chars,
      l.error_keystrokes,
      l.words_completed,
      l.gross_cpm,
      roundTo(getLogNetCpm(l), 2),
      l.gross_wpm,
      l.net_wpm,
      speedLoss,
      l.accuracy_pct,
      l.max_combo,
      l.eng_lang_warnings,
      flattenWeakKeys(l.weak_keys_json),
      l.device_tag || '',
    ];
  });

  const suffix = state.excludeIep ? 'research_no_iep' : 'all_students';
  downloadCSV(`thai_typing_raw_logs_${suffix}.csv`, headers, rows);
}

function exportPrePostPairedCSV() {
  if (!state.computed) return;
  const headers = [
    'student_id',
    'student_no',
    'full_name',
    'default_shift',
    'is_iep_excluded',
    'pre_gross_wpm',
    'pre_net_wpm',
    'pre_net_cpm',
    'pre_acc_pct',
    'post_gross_wpm',
    'post_net_wpm',
    'post_net_cpm',
    'post_acc_pct',
    'diff_net_wpm',
    'diff_acc_pct',
    'practice_count',
    'total_eng_warnings',
  ];

  const sorted = [...state.computed.studentSummaries].sort((a, b) => a.student_no - b.student_no);
  const rows = sorted.map((r) => [
    r.student_id,
    r.student_no,
    r.full_name,
    r.default_shift,
    r.is_iep_excluded ? 'TRUE' : 'FALSE',
    r.preGrossWpm !== null ? roundTo(r.preGrossWpm, 2) : '',
    r.preWpm !== null ? roundTo(r.preWpm, 2) : '',
    r.preNetCpm !== null ? roundTo(r.preNetCpm, 2) : '',
    r.preAcc !== null ? roundTo(r.preAcc, 2) : '',
    r.postGrossWpm !== null ? roundTo(r.postGrossWpm, 2) : '',
    r.postWpm !== null ? roundTo(r.postWpm, 2) : '',
    r.postNetCpm !== null ? roundTo(r.postNetCpm, 2) : '',
    r.postAcc !== null ? roundTo(r.postAcc, 2) : '',
    r.diffNetWpmActual !== null ? roundTo(r.diffNetWpmActual, 2) : '',
    r.diffAccActual !== null ? roundTo(r.diffAccActual, 2) : '',
    r.practiceCount,
    r.totalEngWarnings,
  ]);

  const suffix = state.excludeIep ? 'research_no_iep' : 'all_students';
  downloadCSV(`thai_typing_pre_post_paired_${suffix}.csv`, headers, rows);
}

function getChapter4FilterLabel() {
  if (!state.computed) return '';
  const n = state.computed.filteredStudents.length;
  if (state.selectedStudentId !== 'ALL' && n === 1) {
    const st = state.computed.filteredStudents[0];
    return `เลขที่ ${st.student_no} ${st.full_name}`;
  }
  return state.excludeIep
    ? `กลุ่มตัวอย่างวิเคราะห์วิจัย ไม่รวมนักเรียนแผน IEP, N = ${n}`
    : `นักเรียนชั้นประถมศึกษาปีที่ 6 ทั้งหมด, N = ${n}`;
}

function buildChapter4StatsRows() {
  if (!state.computed) return [];
  const { stats, hasAnyActualPosttest } = state.computed;
  const compPeriod = hasAnyActualPosttest ? 'หลังเรียน (Posttest)' : 'ล่าสุด (ฝึกซ้อม)';

  const pairs = [
    { metric: 'Net WPM (คำสุทธิ/นาที)', pre: stats.preWpm, comp: stats.compWpm },
    { metric: 'Net CPM (อักขระสุทธิ/นาที)', pre: stats.preCpm, comp: stats.compCpm },
    { metric: 'Gross WPM (คำรวม/นาที)', pre: stats.preGross, comp: stats.compGross },
    { metric: 'Accuracy (%)', pre: stats.preAcc, comp: stats.compAcc },
  ];

  const hasAnyCompData = pairs.some((p) => p.comp.n > 0);
  const rows = [];

  for (const p of pairs) {
    const hasPre = p.pre.n > 0;
    const hasComp = hasAnyCompData && p.comp.n > 0;

    if (hasPre) {
      rows.push({
        metricDisplay: p.metric,
        metricPlain: p.metric,
        period: 'ก่อนเรียน (Pretest)',
        st: p.pre,
      });
    }
    if (hasComp) {
      rows.push({
        metricDisplay: hasPre ? '' : p.metric,
        metricPlain: p.metric,
        period: compPeriod,
        st: p.comp,
      });
    }
  }

  return rows;
}

function buildChapter4StatsTSV(statsRows) {
  const rows = statsRows || buildChapter4StatsRows();
  if (rows.length === 0) return '';
  return [
    ['ตัวแปร', 'ช่วงเวลา', 'N', 'Mean', 'S.D.', 'Median', 'Min', 'Max'].join('\t'),
    ...rows.map((r) =>
      [
        r.metricDisplay,
        r.period,
        r.st.n,
        formatNumber(r.st.mean, 2),
        formatNumber(r.st.sd, 2),
        formatNumber(r.st.median, 2),
        formatNumber(r.st.min, 2),
        formatNumber(r.st.max, 2),
      ].join('\t')
    ),
  ].join('\n');
}

function buildChapter4WordHtml(statsRows, filterLabel) {
  const rows = statsRows || [];
  const baseFont =
    "font-family: 'TH SarabunPSK', 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 16pt; color: #000000; mso-bidi-font-family: 'TH SarabunPSK'; mso-bidi-font-size: 16pt;";
  const thBase = `${baseFont} border-top: 1.5pt solid #000000; border-bottom: 1pt solid #000000; border-left: none; border-right: none; font-weight: bold; padding: 4pt 6pt;`;
  const tdBase = `${baseFont} border-top: none; border-left: none; border-right: none; padding: 3pt 6pt;`;

  const headerCells = [
    { label: 'ตัวแปร', align: 'left' },
    { label: 'ช่วงเวลา', align: 'left' },
    { label: 'N', align: 'center' },
    { label: 'Mean', align: 'right' },
    { label: 'S.D.', align: 'right' },
    { label: 'Median', align: 'right' },
    { label: 'Min', align: 'right' },
    { label: 'Max', align: 'right' },
  ]
    .map((h) => `<th style="${thBase} text-align: ${h.align};">${escapeHtml(h.label)}</th>`)
    .join('');

  const bodyRows = rows
    .map((r, idx) => {
      const isLast = idx === rows.length - 1;
      const bottomBorder = isLast ? 'border-bottom: 1.5pt solid #000000;' : 'border-bottom: none;';
      const cell = (val, align) =>
        `<td style="${tdBase} ${bottomBorder} text-align: ${align};">${escapeHtml(val)}</td>`;
      return `<tr>${cell(r.metricDisplay, 'left')}${cell(r.period, 'left')}${cell(r.st.n, 'center')}${cell(formatNumber(r.st.mean, 2), 'right')}${cell(formatNumber(r.st.sd, 2), 'right')}${cell(formatNumber(r.st.median, 2), 'right')}${cell(formatNumber(r.st.min, 2), 'right')}${cell(formatNumber(r.st.max, 2), 'right')}</tr>`;
    })
    .join('');

  return `
    <p style="${baseFont} margin: 0 0 6pt 0; text-align: left; line-height: 1.15;">
      <strong>ตารางที่ 4.X</strong> ค่าสถิติพื้นฐานความเร็วและความแม่นยำในการพิมพ์ภาษาไทย (${escapeHtml(filterLabel)})
    </p>
    <table style="${baseFont} border-collapse: collapse; width: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `.trim();
}

async function copyRichHtmlToClipboard(htmlContent, plainTextFallback) {
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof window.ClipboardItem === 'function'
  ) {
    const item = new window.ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
      'text/plain': new Blob([plainTextFallback], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  // Fallback for older browsers / non-HTTPS contexts: offscreen contenteditable + execCommand('copy')
  const container = document.createElement('div');
  container.setAttribute('contenteditable', 'true');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.opacity = '0';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  const range = document.createRange();
  range.selectNodeContents(container);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    selection.removeAllRanges();
    document.body.removeChild(container);
  }

  if (!copied) {
    await copyTextToClipboard(plainTextFallback);
  }
}

function downloadChapter4WordDoc() {
  const rows = buildChapter4StatsRows();
  if (rows.length === 0) return;
  const filterLabel = getChapter4FilterLabel();
  const tableHtml = buildChapter4WordHtml(rows, filterLabel);

  const wordDocHtml = [
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>`,
    `<head>`,
    `<meta charset='utf-8' />`,
    `<title>ตารางสถิติบทที่ 4</title>`,
    `<style>`,
    `@page { size: A4; margin: 2.54cm; }`,
    `body { font-family: 'TH SarabunPSK', 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 16pt; color: #000000; mso-bidi-font-family: 'TH SarabunPSK'; mso-bidi-font-size: 16pt; }`,
    `</style>`,
    `</head>`,
    `<body>${tableHtml}</body>`,
    `</html>`,
  ].join('\n');

  const blob = new Blob([`\uFEFF${wordDocHtml}`], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'chapter4_stats_table.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function recomputeAndRender() {
  state.computed = computeAnalytics();
  renderKPIs(state.computed);
  renderCharts(state.computed);
  renderSummaryTable(state.computed);
}

// ============================================================================
// Auth Lifecycle & Event Bindings
// ============================================================================
async function enterDashboard(user) {
  state.user = user;
  els.userEmail.textContent = user.email || '';
  els.authView.classList.add('hidden');
  els.mainView.classList.remove('hidden');
  await loadAllResearchData();
}

function enterLoginView() {
  state.user = null;
  els.mainView.classList.add('hidden');
  els.authView.classList.remove('hidden');
}

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
        await enterDashboard(data.user);
      }
    } catch (err) {
      els.loginError.textContent = err.message === 'Invalid login credentials'
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : `เข้าสู่ระบบไม่สำเร็จ: ${err.message}`;
      els.loginError.classList.remove('hidden');
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'เข้าสู่แดชบอร์ดวิจัย';
    }
  });

  els.btnResearchInfo?.addEventListener('click', () => {
    openResearchInfoModal('formulas');
  });

  els.logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    enterLoginView();
  });

  els.btnRefresh.addEventListener('click', () => loadAllResearchData());

  els.filterIepAll.addEventListener('click', () => {
    state.excludeIep = false;
    updateFilterLabelsAndOptions();
    recomputeAndRender();
  });

  els.filterIepResearch.addEventListener('click', () => {
    state.excludeIep = true;
    updateFilterLabelsAndOptions();
    recomputeAndRender();
  });

  els.filterStudentSelect.addEventListener('change', () => {
    state.selectedStudentId = els.filterStudentSelect.value;
    recomputeAndRender();
  });

  // Scatter toggle
  els.scatterModeLatest.addEventListener('click', () => {
    state.scatterMode = 'latest';
    if (state.computed) renderDiagnosticScatter(state.computed);
  });

  els.scatterModePretest.addEventListener('click', () => {
    state.scatterMode = 'pretest';
    if (state.computed) renderDiagnosticScatter(state.computed);
  });

  els.downloadChartButtons.forEach((btn) => {
    btn.addEventListener('click', () => downloadChartPng(btn.dataset.downloadChart));
  });

  els.sortableHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = key === 'student_no' || key === 'full_name' || key === 'quadrantOrder' ? 'asc' : 'desc';
      }
      if (state.computed) renderSummaryTable(state.computed);
    });
  });

  // Chapter 4 Stats Rich HTML Copy (Native MS Word 3-line APA Table in TH SarabunPSK 16pt)
  const ch4IdleHtml = `${icon('clipboardCheck', 'w-4 h-4')}<span>คัดลอกตารางสถิติ (บทที่ 4)</span>`;
  els.btnCopyCh4Stats.addEventListener('click', async () => {
    const rows = buildChapter4StatsRows();
    if (rows.length === 0) return;
    const filterLabel = getChapter4FilterLabel();
    const htmlTable = buildChapter4WordHtml(rows, filterLabel);
    const tsvFallback = buildChapter4StatsTSV(rows);
    try {
      await copyRichHtmlToClipboard(htmlTable, tsvFallback);
      els.btnCopyCh4Stats.className = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs md:text-sm shadow-xs transition';
      els.btnCopyCh4Stats.innerHTML = `${icon('check', 'w-4 h-4')}<span>คัดลอกตาราง Word แล้ว</span>`;
      clearTimeout(els.btnCopyCh4Stats._timer);
      els.btnCopyCh4Stats._timer = setTimeout(() => {
        els.btnCopyCh4Stats.className = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm shadow-xs transition';
        els.btnCopyCh4Stats.innerHTML = ch4IdleHtml;
      }, 2200);
    } catch {
      // Clipboard unavailable
    }
  });

  els.btnDownloadCh4Word.addEventListener('click', downloadChapter4WordDoc);

  els.btnExportRaw.addEventListener('click', exportRawLogsCSV);
  els.btnExportPaired.addEventListener('click', exportPrePostPairedCSV);

  // Student Summary Modal bindings
  els.ssCloseX.addEventListener('click', closeStudentSummaryModal);
  els.ssCloseFooter.addEventListener('click', closeStudentSummaryModal);
  els.studentModal.addEventListener('click', (e) => {
    if (e.target === els.studentModal) closeStudentSummaryModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.studentModal.classList.contains('hidden')) {
      closeStudentSummaryModal();
    }
  });

  const ssCopyIdleHtml = `${icon('copy', 'w-4 h-4')}<span>คัดลอกสรุปรายบุคคล</span>`;
  els.ssCopySummary.addEventListener('click', async () => {
    if (!state.computed || !state.activeSummaryStudentId) return;
    const student = state.computed.studentSummaries.find((s) => s.student_id === state.activeSummaryStudentId);
    if (!student) return;
    try {
      await copyTextToClipboard(buildStudentPlainTextSummary(student));
      els.ssCopySummary.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs md:text-sm shadow-xs transition';
      els.ssCopySummary.innerHTML = `${icon('check', 'w-4 h-4')}<span>คัดลอกเรียบร้อย</span>`;
      clearTimeout(els.ssCopySummary._timer);
      els.ssCopySummary._timer = setTimeout(() => {
        els.ssCopySummary.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm shadow-xs transition';
        els.ssCopySummary.innerHTML = ssCopyIdleHtml;
      }, 2200);
    } catch {
      // Clipboard unavailable
    }
  });
}

async function init() {
  initResearchInfoModal();
  bindEvents();
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await enterDashboard(data.session.user);
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
