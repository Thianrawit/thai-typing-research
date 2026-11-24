import {
  supabase,
  downloadCSV,
  formatNumber,
  roundTo,
  escapeHtml,
} from './config.js';

const COMBINING_MARKS = new Set([
  'ั', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ฺ',
  '่', '้', '๊', '๋', '็', '์', 'ํ',
]);

// Configure Chart.js global Thai font + white background plugin for clean PNG exports
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

  kpiAttendancePct: document.getElementById('kpi-attendance-pct'),
  kpiSessionsCount: document.getElementById('kpi-sessions-count'),
  kpiLogsTotal: document.getElementById('kpi-logs-total'),
  kpiAttendanceDetail: document.getElementById('kpi-attendance-detail'),

  kpiWarningsTotal: document.getElementById('kpi-warnings-total'),
  kpiWarningsAvg: document.getElementById('kpi-warnings-avg'),

  // Charts
  chartPrePostSubtitle: document.getElementById('chart-prepost-subtitle'),
  canvasLearningCurve: document.getElementById('chart-learning-curve'),
  canvasPrePostStudent: document.getElementById('chart-prepost-student'),
  canvasWeakKeys: document.getElementById('chart-weak-keys'),
  canvasShiftCompare: document.getElementById('chart-shift-compare'),
  downloadChartButtons: document.querySelectorAll('[data-download-chart]'),

  // Table & Exports
  sortableHeaders: document.querySelectorAll('.sortable-th'),
  summaryTbody: document.getElementById('summary-table-tbody'),
  btnExportRaw: document.getElementById('btn-export-raw'),
  btnExportPaired: document.getElementById('btn-export-paired'),
};

const state = {
  user: null,
  students: [],
  sessions: [],
  logs: [],
  excludeIep: false,
  selectedStudentId: 'ALL',
  sortKey: 'student_no',
  sortDir: 'asc',
  charts: {
    learningCurve: null,
    prePostStudent: null,
    weakKeys: null,
    shiftCompare: null,
  },
  computed: null,
};

// ============================================================================
// Statistical Utilities (SPSS / Educational Research Compatible)
// ============================================================================
function calcMean(values) {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function calcSampleSD(values) {
  if (!values || values.length === 0) return null;
  if (values.length === 1) return 0;
  const avg = calcMean(values);
  const sqSum = values.reduce((acc, v) => acc + (v - avg) ** 2, 0);
  return Math.sqrt(sqSum / (values.length - 1));
}

function calcMedian(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatKeyLabel(ch) {
  if (ch === ' ') return 'Space';
  return COMBINING_MARKS.has(ch) ? `◌${ch}` : ch;
}

function flattenWeakKeys(weakKeysObj) {
  if (!weakKeysObj || typeof weakKeysObj !== 'object') return '';
  return Object.entries(weakKeysObj)
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([key, count]) => `${key}:${count}`)
    .join('; ');
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

// ============================================================================
// Core Analytics Engine
// ============================================================================
function computeAnalytics() {
  // 1. Apply IEP & Individual Student filters
  let filteredStudents = state.excludeIep
    ? state.students.filter((s) => !s.is_iep_excluded)
    : [...state.students];

  if (state.selectedStudentId !== 'ALL') {
    filteredStudents = filteredStudents.filter((s) => s.student_id === state.selectedStudentId);
  }

  const studentMap = new Map(filteredStudents.map((s) => [s.student_id, s]));
  const filteredLogs = state.logs.filter((log) => studentMap.has(log.student_id));

  // 2. Per-student aggregations
  const hasAnyActualPosttest = filteredLogs.some((l) => l.mode === 'POSTTEST');

  const studentSummaries = filteredStudents.map((st) => {
    const myLogs = filteredLogs
      .filter((l) => l.student_id === st.student_id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const preLogs = myLogs.filter((l) => l.mode === 'PRETEST');
    const postLogs = myLogs.filter((l) => l.mode === 'POSTTEST');
    const practiceLogs = myLogs.filter((l) => l.mode === 'PRACTICE');

    const preLog = preLogs.length > 0 ? preLogs[preLogs.length - 1] : null;
    const postLog = postLogs.length > 0 ? postLogs[postLogs.length - 1] : null;
    const latestPracticeLog = practiceLogs.length > 0 ? practiceLogs[practiceLogs.length - 1] : null;

    // For KPI & Chart 2: compare Pre vs Posttest (or Latest Practice if Posttest hasn't occurred yet)
    const compareLog = postLog || (!hasAnyActualPosttest ? latestPracticeLog : null);

    const preWpm = preLog ? Number(preLog.net_wpm) : null;
    const postWpm = postLog ? Number(postLog.net_wpm) : null;
    const compareWpm = compareLog ? Number(compareLog.net_wpm) : null;

    const preAcc = preLog ? Number(preLog.accuracy_pct) : null;
    const postAcc = postLog ? Number(postLog.accuracy_pct) : null;
    const compareAcc = compareLog ? Number(compareLog.accuracy_pct) : null;

    const avgPracticeWpm = calcMean(practiceLogs.map((l) => Number(l.net_wpm)));
    const gainWpm = preWpm !== null && postWpm !== null ? postWpm - preWpm : null;
    const diffAcc = preAcc !== null && postAcc !== null ? postAcc - preAcc : null;

    return {
      student_id: st.student_id,
      student_no: st.student_no,
      full_name: st.full_name,
      default_shift: st.default_shift ?? (st.student_no <= 11 ? 1 : 2),
      is_iep_excluded: Boolean(st.is_iep_excluded),
      preWpm,
      avgPracticeWpm,
      postWpm,
      compareWpm,
      gainWpm,
      preAcc,
      postAcc,
      compareAcc,
      diffAcc,
      practiceCount: practiceLogs.length,
      rounds: myLogs.length,
    };
  });

  // 3. KPI Metrics
  const preWpmVals = studentSummaries.map((r) => r.preWpm).filter((v) => v !== null);
  const compWpmVals = studentSummaries.map((r) => r.compareWpm).filter((v) => v !== null);
  const preAccVals = studentSummaries.map((r) => r.preAcc).filter((v) => v !== null);
  const compAccVals = studentSummaries.map((r) => r.compareAcc).filter((v) => v !== null);

  const uniqueSessionIdsInLogs = new Set(filteredLogs.map((l) => l.session_id));
  const totalRecordedSessions = Math.max(state.sessions.length, uniqueSessionIdsInLogs.size);
  const expectedLogCount = filteredStudents.length * totalRecordedSessions;
  const attendancePct = expectedLogCount > 0 ? Math.min(100, (filteredLogs.length / expectedLogCount) * 100) : null;

  const totalWarnings = filteredLogs.reduce((acc, l) => acc + Number(l.eng_lang_warnings || 0), 0);
  const avgWarnings = filteredLogs.length > 0 ? totalWarnings / filteredLogs.length : 0;

  // 4. Learning Curve by week_no
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

  // 5. Top 10 Weak Keys
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
    .map(([char, count]) => ({ char, label: formatKeyLabel(char), count }));

  // 6. Shift 1 vs Shift 2 Comparison
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
    kpi: {
      preWpmMean: calcMean(preWpmVals),
      preWpmSD: calcSampleSD(preWpmVals),
      preWpmMed: calcMedian(preWpmVals),
      compWpmMean: calcMean(compWpmVals),
      compWpmSD: calcSampleSD(compWpmVals),
      compWpmMed: calcMedian(compWpmVals),
      preAccMean: calcMean(preAccVals),
      preAccSD: calcSampleSD(preAccVals),
      preAccMed: calcMedian(preAccVals),
      compAccMean: calcMean(compAccVals),
      compAccSD: calcSampleSD(compAccVals),
      compAccMed: calcMedian(compAccVals),
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
// Render KPIs
// ============================================================================
function renderKPIs(data) {
  const { kpi, hasAnyActualPosttest, filteredStudents } = data;
  const compLabel = hasAnyActualPosttest ? 'Posttest' : 'ฝึกครั้งล่าสุด';

  // KPI 1: WPM
  els.kpiWpmPre.textContent = formatNumber(kpi.preWpmMean, 2);
  els.kpiWpmPost.textContent = formatNumber(kpi.compWpmMean, 2);
  els.kpiWpmSub.textContent = `Pretest → ${compLabel} (N=${filteredStudents.length})`;

  if (kpi.preWpmMean !== null && kpi.compWpmMean !== null) {
    const delta = kpi.compWpmMean - kpi.preWpmMean;
    const pctGain = kpi.preWpmMean > 0 ? (delta / kpi.preWpmMean) * 100 : 0;
    const sign = delta >= 0 ? '+' : '';
    els.kpiWpmDelta.textContent = `${sign}${formatNumber(delta, 2)} (${sign}${formatNumber(pctGain, 1)}%)`;
    els.kpiWpmDelta.className = delta >= 0
      ? 'text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700'
      : 'text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700';
  } else {
    els.kpiWpmDelta.textContent = '-';
    els.kpiWpmDelta.className = 'text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
  }

  els.kpiWpmStats.innerHTML = `
    <div>Pre: S.D. <strong>${formatNumber(kpi.preWpmSD, 2)}</strong> • Med <strong>${formatNumber(kpi.preWpmMed, 2)}</strong></div>
    <div>${escapeHtml(compLabel)}: S.D. <strong>${formatNumber(kpi.compWpmSD, 2)}</strong> • Med <strong>${formatNumber(kpi.compWpmMed, 2)}</strong></div>
  `;

  // KPI 2: Accuracy
  els.kpiAccPre.textContent = kpi.preAccMean !== null ? `${formatNumber(kpi.preAccMean, 1)}%` : '-';
  els.kpiAccPost.textContent = kpi.compAccMean !== null ? `${formatNumber(kpi.compAccMean, 1)}%` : '-';
  els.kpiAccSub.textContent = `Pretest → ${compLabel}`;

  if (kpi.preAccMean !== null && kpi.compAccMean !== null) {
    const delta = kpi.compAccMean - kpi.preAccMean;
    const sign = delta >= 0 ? '+' : '';
    els.kpiAccDelta.textContent = `${sign}${formatNumber(delta, 2)}%`;
    els.kpiAccDelta.className = delta >= 0
      ? 'text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700'
      : 'text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700';
  } else {
    els.kpiAccDelta.textContent = '-';
    els.kpiAccDelta.className = 'text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
  }

  els.kpiAccStats.innerHTML = `
    <div>Pre: S.D. <strong>${formatNumber(kpi.preAccSD, 2)}</strong> • Med <strong>${formatNumber(kpi.preAccMed, 2)}%</strong></div>
    <div>${escapeHtml(compLabel)}: S.D. <strong>${formatNumber(kpi.compAccSD, 2)}</strong> • Med <strong>${formatNumber(kpi.compAccMed, 2)}%</strong></div>
  `;

  // KPI 3: Sessions & Attendance
  els.kpiAttendancePct.textContent = kpi.attendancePct !== null ? `${formatNumber(kpi.attendancePct, 1)}%` : '-';
  els.kpiSessionsCount.textContent = `${kpi.totalRecordedSessions} รอบ`;
  els.kpiLogsTotal.textContent = `บันทึกผลการพิมพ์แล้ว ${kpi.totalFilteredLogs.toLocaleString('th-TH')} รายการ`;
  els.kpiAttendanceDetail.textContent = `กลุ่มตัวอย่างที่แสดงผล: ${filteredStudents.length} คน`;

  // KPI 4: Language warnings
  els.kpiWarningsTotal.textContent = kpi.totalWarnings.toLocaleString('th-TH');
  els.kpiWarningsAvg.textContent = `เฉลี่ย ${formatNumber(kpi.avgWarnings, 2)} ครั้ง/รอบฝึก`;
}

// ============================================================================
// Render 4 Chart.js Charts
// ============================================================================
function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function renderCharts(data) {
  if (typeof window.Chart === 'undefined') return;
  const Chart = window.Chart;
  const compLabel = data.hasAnyActualPosttest ? 'Posttest Net WPM' : 'ฝึกครั้งล่าสุด Net WPM';
  els.chartPrePostSubtitle.textContent = `Pretest Net WPM เทียบกับ ${compLabel}`;

  // Chart 1: Learning Curve (Dual-Axis Line Chart)
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
      plugins: {
        legend: { position: 'top' },
      },
    },
  });

  // Chart 2: Pretest vs Posttest by Student (Grouped Bar)
  destroyChart('prePostStudent');
  const byNo = [...data.studentSummaries].sort((a, b) => a.student_no - b.student_no);
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

  // Chart 3: Top 10 Most Missed Thai Keys (Horizontal Bar)
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
      plugins: {
        legend: { display: false },
      },
    },
  });

  // Chart 4: Shift 1 vs Shift 2 Comparison (Dual-Axis Grouped Bar)
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
      plugins: {
        legend: { position: 'top' },
      },
    },
  });
}

function downloadChartPng(chartKey) {
  const chart = state.charts[chartKey];
  if (!chart) return;

  // Render onto an offscreen white canvas to guarantee crisp pure-white PNG for Word/Thesis
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
// Render Sortable Individual Summary Table
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

  // Update header sort indicators
  els.sortableHeaders.forEach((th) => {
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    if (th.dataset.sort === sortKey) {
      ind.textContent = sortDir === 'asc' ? '▲' : '▼';
    } else {
      ind.textContent = '';
    }
  });

  if (rows.length === 0) {
    els.summaryTbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">ไม่พบข้อมูลนักเรียนตามตัวกรองที่เลือก</td></tr>';
    return;
  }

  els.summaryTbody.innerHTML = rows
    .map((r) => {
      const gainClass =
        r.gainWpm === null
          ? 'text-slate-400'
          : r.gainWpm >= 0
            ? 'text-emerald-700 font-extrabold'
            : 'text-rose-600 font-extrabold';
      const gainText = r.gainWpm === null ? '-' : `${r.gainWpm >= 0 ? '+' : ''}${formatNumber(r.gainWpm, 2)}`;

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3 font-extrabold text-slate-800">${escapeHtml(r.student_no)}</td>
          <td class="py-2.5 px-3 font-semibold text-slate-800">${escapeHtml(r.full_name)}</td>
          <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold ${r.default_shift === 1 ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'}">ผลัด ${r.default_shift}</span></td>
          <td class="py-2.5 px-3 text-center">${r.is_iep_excluded ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">IEP</span>' : '<span class="text-slate-300">-</span>'}</td>
          <td class="py-2.5 px-3 text-right font-mono">${formatNumber(r.preWpm, 2)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-slate-600">${formatNumber(r.avgPracticeWpm, 2)}</td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-blue-700">${formatNumber(r.postWpm, 2)}</td>
          <td class="py-2.5 px-3 text-right font-mono ${gainClass}">${gainText}</td>
          <td class="py-2.5 px-3 text-right font-mono">${r.preAcc !== null ? `${formatNumber(r.preAcc, 1)}%` : '-'}</td>
          <td class="py-2.5 px-3 text-right font-mono">${r.postAcc !== null ? `${formatNumber(r.postAcc, 1)}%` : '-'}</td>
          <td class="py-2.5 px-3 text-right font-bold text-slate-700">${r.rounds}</td>
        </tr>
      `;
    })
    .join('');
}

// ============================================================================
// Research CSV Exports (UTF-8 BOM for Excel / SPSS / Jamovi)
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
    'accuracy_pct',
    'max_combo',
    'eng_lang_warnings',
    'weak_keys_json',
    'device_tag',
  ];

  const rows = filteredLogs.map((l) => {
    const st = studentMap.get(l.student_id);
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
      l.net_cpm,
      l.gross_wpm,
      l.net_wpm,
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
    'pre_net_wpm',
    'post_net_wpm',
    'diff_net_wpm',
    'pre_acc_pct',
    'post_acc_pct',
    'diff_acc_pct',
    'practice_count',
  ];

  const sorted = [...state.computed.studentSummaries].sort((a, b) => a.student_no - b.student_no);
  const rows = sorted.map((r) => [
    r.student_id,
    r.student_no,
    r.full_name,
    r.default_shift,
    r.is_iep_excluded ? 'TRUE' : 'FALSE',
    r.preWpm !== null ? roundTo(r.preWpm, 2) : '',
    r.postWpm !== null ? roundTo(r.postWpm, 2) : '',
    r.gainWpm !== null ? roundTo(r.gainWpm, 2) : '',
    r.preAcc !== null ? roundTo(r.preAcc, 2) : '',
    r.postAcc !== null ? roundTo(r.postAcc, 2) : '',
    r.diffAcc !== null ? roundTo(r.diffAcc, 2) : '',
    r.practiceCount,
  ]);

  const suffix = state.excludeIep ? 'research_no_iep' : 'all_students';
  downloadCSV(`thai_typing_pre_post_paired_${suffix}.csv`, headers, rows);
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
        state.sortDir = key === 'student_no' || key === 'full_name' ? 'asc' : 'desc';
      }
      if (state.computed) renderSummaryTable(state.computed);
    });
  });

  els.btnExportRaw.addEventListener('click', exportRawLogsCSV);
  els.btnExportPaired.addEventListener('click', exportPrePostPairedCSV);
}

async function init() {
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
