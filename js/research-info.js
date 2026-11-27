// Standalone Reusable Academic Reference Modal for Thai Typing Research
// Mountable on admin.html, dashboard.html, or any teacher view via initResearchInfoModal()

import { icon } from './icons.js';
import { escapeHtml } from './config.js';

const MODAL_ID = 'research-info-modal';

const TABS = [
  { id: 'variables', label: 'ตัวแปรทั้งหมด', iconName: 'info' },
  { id: 'formulas', label: 'สูตรคำนวณทั้งหมด', iconName: 'calculator' },
  { id: 'simulator', label: 'ตัวอย่าง & ทดลองคำนวณ', iconName: 'clipboardCheck' },
  { id: 'integrity', label: 'กลไกควบคุมความเที่ยงตรง', iconName: 'shieldCheck' },
];

let initialized = false;
let activeTab = 'variables';
let copyResetTimer = null;

function formatFixed(val, decimals = 2) {
  if (!Number.isFinite(val)) return '0.00';
  return val.toFixed(decimals);
}

function buildFractionHtml(numerator, denominator) {
  return `
    <span class="inline-flex flex-col items-center align-middle mx-1.5 text-xs md:text-sm font-mono">
      <span class="px-2 pb-0.5 border-b border-slate-500 leading-tight">${numerator}</span>
      <span class="px-2 pt-0.5 leading-tight">${denominator}</span>
    </span>
  `;
}

function buildVariablesTabHtml() {
  const primaryVars = [
    {
      name: 'Net WPM',
      thai: 'คำสุทธิต่อนาที',
      badge: 'ตัวชี้วัดหลัก (ความเร็วใช้งานจริง)',
      desc: 'ความเร็วในการผลิตอักขระที่ถูกต้องจริงแปลงเป็นคำมาตรฐานภาษาไทย (5 อักขระ = 1 คำ) ต่อนาที สะท้อนสมรรถนะการพิมพ์ที่ใช้งานได้จริงของนักเรียน',
    },
    {
      name: 'Accuracy (%)',
      thai: 'ความแม่นยำในการพิมพ์',
      badge: 'ตัวชี้วัดหลัก (ความถูกต้อง)',
      desc: 'ร้อยละของการกดแป้นที่ถูกต้องเมื่อเทียบกับจำนวนการเคาะแป้นทั้งหมด ใช้วิเคราะห์ความแม่นยำควบคู่กับความเร็ว',
    },
  ];

  const supplementaryVars = [
    {
      name: 'Gross WPM',
      thai: 'คำรวมต่อนาที',
      desc: 'ความเร็วการเคาะแป้นทั้งหมด (ทั้งถูกและผิด) แปลงเป็นคำมาตรฐานต่อนาที สะท้อนความคล่องตัวของการเคลื่อนไหวนิ้ว',
    },
    {
      name: 'Gross CPM',
      thai: 'อักขระรวมต่อนาที',
      desc: 'จำนวนการกดแป้นทั้งหมดต่อนาที เหมาะสำหรับเปรียบเทียบกับงานวิจัยภาษาไทยที่รายงานผลเป็นตัวอักษรต่อนาที',
    },
    {
      name: 'Net CPM',
      thai: 'อักขระสุทธิต่อนาที',
      desc: 'จำนวนอักขระที่พิมพ์ผ่านถูกต้องจริงต่อนาที มีค่าเท่ากับ Net WPM คูณ 5 เสมอ',
    },
  ];

  const rawDbVars = [
    {
      col: 'duration_actual_sec',
      group: 'typing_logs',
      desc: 'เวลาที่พิมพ์จริง (วินาที) นับจากแป้นแรกที่กด (First-Keystroke Timer)',
    },
    {
      col: 'total_keystrokes',
      group: 'typing_logs',
      desc: 'จำนวนการกดแป้นทั้งหมด (correct_chars + error_keystrokes) ไม่นับปุ่มภาษาอังกฤษที่ถูก Language Guard ดักไว้',
    },
    {
      col: 'correct_chars',
      group: 'typing_logs',
      desc: 'จำนวนอักขระที่พิมพ์ถูกต้องและเคอร์เซอร์เลื่อนผ่านจริง (นับพยัญชนะ สระ วรรณยุกต์ และตัวการันต์เป็น 1 อักขระเท่ากัน)',
    },
    {
      col: 'error_keystrokes',
      group: 'typing_logs',
      desc: 'จำนวนครั้งที่กดผิดในโหมด Strict-Stop ก่อนจะแก้ไขให้ถูกต้อง',
    },
    {
      col: 'words_completed',
      group: 'typing_logs',
      desc: 'จำนวนคำศัพท์ที่พิมพ์จบสมบูรณ์ครบทุกอักขระ',
    },
    {
      col: 'max_combo',
      group: 'typing_logs',
      desc: 'จำนวนอักขระที่พิมพ์ถูกต่อเนื่องสูงสุดโดยไม่พลาด ใช้เป็นตัวชี้วัดความต่อเนื่องและสมาธิ',
    },
    {
      col: 'eng_lang_warnings',
      group: 'typing_logs',
      desc: 'จำนวนครั้งที่ลืมเปลี่ยนภาษาแป้นพิมพ์เป็นภาษาไทย เก็บแยกเพื่อใช้อภิปรายปัญหาหน้างานในบทที่ 5 โดยไม่หักคะแนนความแม่นยำ',
    },
    {
      col: 'weak_keys_json',
      group: 'typing_logs',
      desc: 'ข้อมูล JSON บันทึกความถี่ของอักขระที่พิมพ์ผิดรายตัว เช่น {"ี": 17, "ฆ": 4} เพื่อวิเคราะห์จุดอ่อนเฉพาะปุ่มและออกแบบการฝึกซ่อมเสริม',
    },
    {
      col: 'shift_no',
      group: 'typing_logs',
      desc: 'ผลัดการเข้าฝึก (ผลัดที่ 1 หรือ ผลัดที่ 2) สำหรับตรวจสอบความเท่าเทียมระหว่างผลัด',
    },
    {
      col: 'device_tag',
      group: 'typing_logs',
      desc: 'รหัสเครื่องคอมพิวเตอร์ (เช่น PC-01 ถึง PC-12) สำหรับตรวจสอบอุปกรณ์และปัญหาฮาร์ดแวร์หน้างาน',
    },
    {
      col: 'is_iep_excluded',
      group: 'students',
      desc: 'ตัวกรองเกณฑ์คัดออก (Exclusion Criteria) สำหรับคัดกรองนักเรียนแผน IEP ออกในขั้นวิเคราะห์สถิติวิจัยโดยยังร่วมเรียนได้ตามปกติ',
    },
  ];

  return `
    <div class="space-y-6">
      <!-- Tier 1 -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">1</span>
          <h3 class="text-base font-extrabold text-slate-900">ตัวแปรตามหลัก (Primary Dependent Variables)</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${primaryVars
            .map(
              (v) => `
            <div class="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1.5">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="font-extrabold text-blue-900 text-base">
                  <span class="font-mono">${escapeHtml(v.name)}</span>
                  <span class="text-sm font-bold text-blue-700 ml-1">(${escapeHtml(v.thai)})</span>
                </div>
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white">${escapeHtml(v.badge)}</span>
              </div>
              <p class="text-xs md:text-sm text-slate-700 leading-relaxed">${escapeHtml(v.desc)}</p>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Tier 2 -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center">2</span>
          <h3 class="text-base font-extrabold text-slate-900">ตัวแปรความเร็วประกอบการวิเคราะห์ (Supplementary Speed Metrics)</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${supplementaryVars
            .map(
              (v) => `
            <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div class="font-extrabold text-slate-900 text-sm">
                <span class="font-mono text-indigo-700">${escapeHtml(v.name)}</span>
                <span class="text-xs font-bold text-slate-500 block">${escapeHtml(v.thai)}</span>
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(v.desc)}</p>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Tier 3 -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center">3</span>
          <h3 class="text-base font-extrabold text-slate-900">ตัวแปรข้อมูลดิบและบริบทในฐานข้อมูล (<span class="font-mono text-sm">typing_logs</span> &amp; <span class="font-mono text-sm">students</span>)</h3>
        </div>
        <div class="overflow-x-auto rounded-2xl border border-slate-200">
          <table class="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr class="bg-slate-100 text-slate-600 border-b border-slate-200">
                <th class="py-2.5 px-3 font-bold whitespace-nowrap">ชื่อคอลัมน์</th>
                <th class="py-2.5 px-3 font-bold whitespace-nowrap">ตาราง</th>
                <th class="py-2.5 px-3 font-bold">นิยามเชิงปฏิบัติการและบทบาทในงานวิจัย</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              ${rawDbVars
                .map(
                  (r) => `
                <tr class="hover:bg-slate-50">
                  <td class="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">${escapeHtml(r.col)}</td>
                  <td class="py-2 px-3 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${r.group === 'students' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">${escapeHtml(r.group)}</span>
                  </td>
                  <td class="py-2 px-3 text-slate-600 leading-relaxed">${escapeHtml(r.desc)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function buildFormulasTabHtml() {
  const formulas = [
    {
      no: '1',
      title: 'เวลาที่ใช้พิมพ์จริงเป็นนาที (Duration in Minutes)',
      body: `<span class="font-mono font-bold text-slate-900">Duration (min) = max(</span>${buildFractionHtml('duration_actual_sec', '60')}<span class="font-mono font-bold text-slate-900">,</span>${buildFractionHtml('1', '60')}<span class="font-mono font-bold text-slate-900">)</span>`,
      note: 'ป้องกันการหารด้วยศูนย์ โดยกำหนดขั้นต่ำ 1 วินาที (1/60 นาที)',
    },
    {
      no: '2',
      title: 'ความเร็วอักขระรวมต่อนาที (Gross CPM)',
      body: `<span class="font-mono font-bold text-slate-900">Gross CPM =</span>${buildFractionHtml('total_keystrokes', 'Duration (min)')}`,
      note: 'รวมการเคาะแป้นทุกครั้งที่บันทึก (ถูก + ผิด)',
    },
    {
      no: '3',
      title: 'ความเร็วอักขระสุทธิต่อนาที (Net CPM)',
      body: `<span class="font-mono font-bold text-emerald-800">Net CPM =</span>${buildFractionHtml('correct_chars', 'Duration (min)')}`,
      note: 'นับเฉพาะอักขระที่พิมพ์ถูกต้องและผ่านการตรวจ Strict-Stop',
    },
    {
      no: '4',
      title: 'ความเร็วคำรวมต่อนาที (Gross WPM)',
      body: `<span class="font-mono font-bold text-slate-900">Gross WPM =</span>${buildFractionHtml('total_keystrokes / 5', 'Duration (min)')}<span class="font-mono text-slate-500 mx-1">=</span>${buildFractionHtml('Gross CPM', '5')}`,
      note: 'ใช้เกณฑ์มาตรฐานภาษาไทย 5 อักขระ = 1 คำมาตรฐาน',
    },
    {
      no: '5',
      title: 'ความเร็วคำสุทธิต่อนาที (Net WPM — ตัวแปรหลัก)',
      body: `<span class="font-mono font-bold text-blue-800">Net WPM =</span>${buildFractionHtml('correct_chars / 5', 'Duration (min)')}<span class="font-mono text-slate-500 mx-1">=</span>${buildFractionHtml('Net CPM', '5')}`,
      note: 'ปัดทศนิยม 2 ตำแหน่งก่อนบันทึกลงฐานข้อมูล Supabase',
    },
    {
      no: '6',
      title: 'ร้อยละความแม่นยำ (Accuracy % — ตัวแปรหลัก)',
      body: `<span class="font-mono font-bold text-emerald-800">Accuracy (%) =</span>${buildFractionHtml('correct_chars', 'total_keystrokes')}<span class="font-mono font-bold text-emerald-800">&times; 100</span>`,
      note: 'หาก total_keystrokes = 0 กำหนดให้ Accuracy (%) = 0.00',
    },
    {
      no: '7',
      title: 'ความสัมพันธ์เชื่อมโยง 3 ตัวแปรหลัก (Identity Equation)',
      body: `<span class="font-mono font-bold text-indigo-800">Net WPM = Gross WPM &times;</span><span class="font-mono font-bold text-indigo-800">(</span>${buildFractionHtml('Accuracy (%)', '100')}<span class="font-mono font-bold text-indigo-800">)</span>`,
      note: 'พิสูจน์ได้ว่า Net WPM ลดหลั่นตามความแม่นยำอย่างเป็นสัดส่วนตรง ไม่ติดลบหรือยุบลง 0 โดยไม่เป็นธรรม',
    },
  ];

  return `
    <div class="space-y-5">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${formulas
          .map(
            (f) => `
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2 ${f.no === '7' ? 'md:col-span-2 bg-indigo-50/70 border-indigo-200' : ''}">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-md bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center shrink-0">${f.no}</span>
              <h4 class="text-xs md:text-sm font-extrabold text-slate-800">${escapeHtml(f.title)}</h4>
            </div>
            <div class="py-2 px-3 rounded-xl bg-white border border-slate-200/80 flex items-center flex-wrap text-sm">
              ${f.body}
            </div>
            <p class="text-[11px] text-slate-500">${escapeHtml(f.note)}</p>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Academic Rationale Box -->
      <div class="p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 space-y-2.5">
        <div class="flex items-center gap-2 text-amber-900">
          ${icon('bookOpen', 'w-5 h-5 text-amber-700')}
          <h3 class="text-sm md:text-base font-extrabold">เหตุผลทางวิชาการของสูตร Net WPM ในโหมด Strict-Stop</h3>
        </div>
        <ul class="space-y-2 text-xs md:text-sm text-amber-950 leading-relaxed list-disc pl-5">
          <li>
            <strong>มาตรฐาน 5 อักขระ = 1 คำมาตรฐานภาษาไทย:</strong> เนื่องจากภาษาไทยไม่มีการเว้นวรรคระหว่างคำ การแปลงจำนวนอักขระด้วยตัวหารคงที่ 5 ช่วยให้เทียบเคียงความเร็วระหว่างชุดคำศัพท์ที่มีความยาวต่างกันได้อย่างเป็นมาตรฐานสากล
          </li>
          <li>
            <strong>โหมดบังคับแก้คำผิด (Strict-Stop Mode):</strong> ระบบบังคับให้นักเรียนแก้ไขตัวอักษรที่กดผิดจนถูกต้องก่อนเคอร์เซอร์จะเลื่อนผ่าน ดังนั้นเมื่อหมดเวลาจึงไม่มีคำผิดคงค้างในข้อความผลลัพธ์ (Uncorrected Errors = 0)
          </li>
          <li>
            <strong>หลีกเลี่ยงการลงโทษซ้ำซ้อนและปัญหา Floor Effect:</strong> การกดผิดทุกครั้งลงโทษผู้เรียนผ่านเวลาจริงที่สูญเสียไปแล้วและสะท้อนโดยตรงในค่า <span class="font-mono font-bold">Accuracy %</span> หากนำสูตรพิมพ์ดีดแบบปล่อยไหล (<span class="font-mono">Gross WPM - Errors/min</span> ซึ่งหัก 5 อักขระต่อการกดผิด 1 ครั้ง) มาใช้ จะเกิดการหักคะแนนซ้ำซ้อนจนทำให้เกิดภาวะ <strong>Floor Effect</strong> กล่าวคือ นักเรียนที่มีความแม่นยำไม่เกินร้อยละ 80 จะถูกกดค่า Net WPM ลงเป็น 0.00 ทั้งหมด ทำให้ไม่สามารถจำแนกพัฒนาการจริงระหว่าง Pretest และ Posttest ได้
          </li>
        </ul>
      </div>
    </div>
  `;
}

function buildSimulatorTabHtml() {
  return `
    <div class="space-y-5">
      <!-- Worked Example Comparison -->
      <div class="space-y-2.5">
        <h3 class="text-sm md:text-base font-extrabold text-slate-900">ตัวอย่างเปรียบเทียบ 2 กรณีศึกษา (เวลาพิมพ์จริง 180 วินาที / 3 นาที)</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <!-- Case A -->
          <div class="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-extrabold text-rose-900 text-sm">กรณี A: มือไวแต่กดพลาดบ่อย</span>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">ถูก 184 • ผิด 60 • รวม 244</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2 rounded-xl bg-white border border-rose-100">
                <div class="text-slate-500">Gross WPM</div>
                <div class="font-mono font-extrabold text-slate-800 text-base">16.27</div>
              </div>
              <div class="p-2 rounded-xl bg-white border border-rose-100">
                <div class="text-slate-500">Net WPM</div>
                <div class="font-mono font-extrabold text-blue-700 text-base">12.27</div>
              </div>
              <div class="p-2 rounded-xl bg-white border border-rose-100">
                <div class="text-slate-500">Net CPM</div>
                <div class="font-mono font-extrabold text-slate-700 text-base">61.33</div>
              </div>
              <div class="p-2 rounded-xl bg-white border border-rose-100">
                <div class="text-slate-500">Accuracy %</div>
                <div class="font-mono font-extrabold text-rose-700 text-base">75.41%</div>
              </div>
            </div>
            <p class="text-xs text-rose-900 font-medium">
              ผลสรุป: แม้เคาะแป้นได้ไวกว่า (Gross 16.27) แต่เสียความเร็วไป <strong>4.00 WPM</strong> จากการกดผิด ทำให้ความเร็วสุทธิเหลือ 12.27 WPM
            </p>
          </div>

          <!-- Case B -->
          <div class="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-extrabold text-emerald-900 text-sm">กรณี B: ไวและแม่นยำสูง</span>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">ถูก 216 • ผิด 11 • รวม 227</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2 rounded-xl bg-white border border-emerald-100">
                <div class="text-slate-500">Gross WPM</div>
                <div class="font-mono font-extrabold text-slate-800 text-base">15.13</div>
              </div>
              <div class="p-2 rounded-xl bg-white border border-emerald-100">
                <div class="text-slate-500">Net WPM</div>
                <div class="font-mono font-extrabold text-blue-700 text-base">14.40</div>
              </div>
              <div class="p-2 rounded-xl bg-white border border-emerald-100">
                <div class="text-slate-500">Net CPM</div>
                <div class="font-mono font-extrabold text-slate-700 text-base">72.00</div>
              </div>
              <div class="p-2 rounded-xl bg-white border border-emerald-100">
                <div class="text-slate-500">Accuracy %</div>
                <div class="font-mono font-extrabold text-emerald-700 text-base">95.15%</div>
              </div>
            </div>
            <p class="text-xs text-emerald-900 font-medium">
              ผลสรุป: เคาะรวมน้อยกว่ากรณี A เล็กน้อย แต่ความแม่นยำสูง เสียความเร็วไปเพียง <strong>0.73 WPM</strong> จึงทำ Net WPM ได้สูงกว่าอย่างชัดเจน
            </p>
          </div>
        </div>
      </div>

      <!-- Interactive Formula Simulator -->
      <div class="p-5 rounded-2xl bg-slate-50 border-2 border-blue-200 space-y-4">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 text-blue-900">
            ${icon('calculator', 'w-5 h-5 text-blue-600')}
            <h3 class="text-sm md:text-base font-extrabold">ทดลองคำนวณสูตรสด (Formula Simulator)</h3>
          </div>
          <span class="text-[11px] font-semibold text-slate-500">ปรับตัวเลขด้านล่างเพื่อดูการแทนค่าแบบเรียลไทม์</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label for="ri-sim-sec" class="block text-xs font-bold text-slate-700 mb-1">เวลาที่พิมพ์จริง (วินาที)</label>
            <input id="ri-sim-sec" type="number" min="1" max="3600" value="180" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
          </div>
          <div>
            <label for="ri-sim-correct" class="block text-xs font-bold text-slate-700 mb-1">อักขระที่พิมพ์ถูก (ตัว)</label>
            <input id="ri-sim-correct" type="number" min="0" max="100000" value="123" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
          </div>
          <div>
            <label for="ri-sim-errors" class="block text-xs font-bold text-slate-700 mb-1">จำนวนครั้งที่กดผิด (ครั้ง)</label>
            <input id="ri-sim-errors" type="number" min="0" max="100000" value="30" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
          </div>
        </div>

        <!-- Output Summary Grid -->
        <div id="ri-sim-outputs" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2"></div>

        <!-- Live Step-by-Step Arithmetic Breakdown -->
        <div class="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
          <div class="text-xs font-extrabold text-slate-700">ลำดับการแทนค่าทีละขั้น (Step-by-Step)</div>
          <div id="ri-sim-steps" class="font-mono text-xs text-slate-600 space-y-1 leading-relaxed"></div>
        </div>
      </div>
    </div>
  `;
}

function buildIntegrityTabHtml() {
  const controls = [
    {
      no: '1',
      title: 'Strict-Stop Mode & Canonical Thai Unicode Order',
      desc: 'ตรวจจับอักขระทีละตัวตามลำดับมาตรฐานภาษาไทย (พยัญชนะ ตามด้วยสระบนหรือล่าง และวรรณยุกต์) โดยเคอร์เซอร์จะเดินหน้าเมื่อกดถูกเท่านั้น ส่วนการแสดงผลบนจอจัดกลุ่มเป็น Thai Grapheme Cluster ด้วย Intl.Segmenter เพื่อคงการจัดวางสระและวรรณยุกต์ตามมาตรฐาน OpenType อย่างสมบูรณ์',
    },
    {
      no: '2',
      title: 'Language Guard (ระบบป้องกันการลืมเปลี่ยนภาษา)',
      desc: 'เมื่อระบบคาดหวังอักขระไทยแต่ผู้เรียนกดตัวอักษรภาษาอังกฤษ (A–Z) ระบบจะแสดงแถบเตือนสีเหลืองให้สลับภาษาโดยไม่หักคะแนนความแม่นยำและไม่นับเป็น error_keystrokes แต่บันทึกจำนวนครั้งแยกไว้ในคอลัมน์ eng_lang_warnings เพื่อใช้วิเคราะห์และอภิปรายปัญหาหน้างานในบทที่ 5',
    },
    {
      no: '3',
      title: 'Research Integrity Lock (ล็อกปิดไฟนำทางในรอบทดสอบ)',
      desc: 'เมื่อรอบการเล่นถูกตั้งค่าเป็นโหมด PRETEST หรือ POSTTEST ระบบจะปิดไฟนำทางบนแป้นพิมพ์จำลองและปุ่มช่วยยกแคร่ (Shift Hint) โดยอัตโนมัติ พร้อมใช้ชุดคำศัพท์ลำดับคงที่ (Deterministic Order) เพื่อควบคุมความยากให้เท่าเทียมกันทุกคน',
    },
    {
      no: '4',
      title: 'First-Keystroke Timer (เริ่มจับเวลาเมื่อเคาะแป้นแรก)',
      desc: 'ตัวจับเวลาถอยหลังจะยังไม่เดินจนกว่านักเรียนจะกดแป้นพิมพ์ตัวอักษรแรกที่ถูกต้องตามภาษา ช่วยตัดความคลาดเคลื่อนจากเวลาเตรียมตัวอ่านโจทย์ ทำให้ผู้เรียนทุกคนได้รับเวลาปฏิบัติจริงเท่ากัน',
    },
    {
      no: '5',
      title: 'Session PIN & One-Attempt Lock (รหัสห้อง 4 หลักและล็อกชื่อส่งครั้งเดียว)',
      desc: 'ครูควบคุมการเปิด–ปิดรอบการฝึกเฉพาะในคาบเรียนด้วยรหัส PIN 4 หลัก และฐานข้อมูลกำหนด Unique Constraint (session_id, student_id) ทำให้เมื่อนักเรียนส่งคะแนนแล้วชื่อจะถูกล็อกทันที ป้องกันการเล่นซ้ำหรือกดทับชื่อเพื่อนข้ามผลัด',
    },
    {
      no: '6',
      title: 'Inclusive Classroom & IEP Statistical Filter (การเรียนรวมและการคัดกรองสถิติ)',
      desc: 'เปิดโอกาสให้นักเรียนทุกคนในห้องรวมถึงนักเรียนแผนการจัดการศึกษาเฉพาะบุคคล (IEP) ร่วมฝึกทักษะในชั้นเรียนได้อย่างเท่าเทียมโดยไม่แบ่งแยก และใช้ธง is_iep_excluded คัดกรองออกเฉพาะในขั้นตอนการวิเคราะห์สถิติวิจัยและส่งออกไฟล์ SPSS / Jamovi ตามเกณฑ์ Exclusion Criteria',
    },
  ];

  return `
    <div class="space-y-3">
      <p class="text-xs md:text-sm text-slate-600 leading-relaxed">
        กลไกควบคุมความเที่ยงตรงภายใน (Internal Validity) และความเชื่อมั่นของข้อมูลที่ฝังอยู่ในสถาปัตยกรรมของระบบสำหรับอ้างอิงในบทที่ 3 (วิธีดำเนินการวิจัย)
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${controls
          .map(
            (c) => `
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <span class="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">${c.no}</span>
            <div class="space-y-1">
              <h4 class="text-sm font-extrabold text-slate-900">${escapeHtml(c.title)}</h4>
              <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(c.desc)}</p>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function getThesisSummaryPlainText() {
  return [
    'นิยามศัพท์เฉพาะ สูตรการคำนวณ และกลไกควบคุมความเที่ยงตรงของเครื่องมือวิจัย',
    'ระบบฝึกทักษะการพิมพ์สัมผัสภาษาไทย ระดับชั้นประถมศึกษาปีที่ 6',
    '====================================================================',
    '',
    '1. นิยามตัวแปรที่ใช้ในการวิจัย',
    '1.1 ตัวแปรตามหลัก (Primary Dependent Variables)',
    '- ความเร็วการพิมพ์สุทธิ (Net WPM: คำสุทธิต่อนาที) หมายถึง ความเร็วในการพิมพ์อักขระภาษาไทยที่ถูกต้องจริง แปลงเป็นคำมาตรฐานภาษาไทยตามเกณฑ์ 5 อักขระเท่ากับ 1 คำมาตรฐาน ต่อเวลาที่ใช้พิมพ์จริง 1 นาที สะท้อนสมรรถนะการพิมพ์ที่ใช้งานได้จริง',
    '- ความแม่นยำในการพิมพ์ (Accuracy %) หมายถึง ร้อยละของจำนวนอักขระที่พิมพ์ถูกต้องต่อจำนวนการเคาะแป้นพิมพ์ทั้งหมด',
    '',
    '1.2 ตัวแปรความเร็วประกอบการวิเคราะห์ (Supplementary Speed Metrics)',
    '- ความเร็วคำรวมต่อนาที (Gross WPM) หมายถึง จำนวนการเคาะแป้นพิมพ์ทั้งหมดแปลงเป็นคำมาตรฐาน (หาร 5) ต่อนาที สะท้อนความคล่องตัวของการเคลื่อนไหวนิ้ว',
    '- ความเร็วอักขระรวมต่อนาที (Gross CPM) หมายถึง จำนวนการเคาะแป้นพิมพ์ทั้งหมดต่อนาที',
    '- ความเร็วอักขระสุทธิต่อนาที (Net CPM) หมายถึง จำนวนอักขระที่พิมพ์ถูกต้องจริงต่อนาที (มีค่าเท่ากับ Net WPM x 5 เสมอ)',
    '',
    '1.3 ตัวแปรข้อมูลดิบและบริบทในฐานข้อมูล (typing_logs และ students)',
    '- duration_actual_sec: เวลาที่ใช้พิมพ์จริง (วินาที) นับจากแป้นแรกที่กด',
    '- total_keystrokes: จำนวนการเคาะแป้นทั้งหมด (correct_chars + error_keystrokes) โดยไม่นับปุ่มภาษาอังกฤษที่ถูก Language Guard ดักไว้',
    '- correct_chars: จำนวนอักขระที่พิมพ์ถูกต้องจริง (นับพยัญชนะ สระ วรรณยุกต์ และตัวการันต์เป็น 1 อักขระเท่ากัน)',
    '- error_keystrokes: จำนวนครั้งที่กดผิดในโหมด Strict-Stop',
    '- words_completed: จำนวนคำศัพท์ที่พิมพ์จบสมบูรณ์',
    '- max_combo: จำนวนอักขระที่พิมพ์ถูกต้องต่อเนื่องสูงสุดโดยไม่ผิดพลาด',
    '- eng_lang_warnings: จำนวนครั้งที่ผู้เรียนลืมสลับภาษาเป็นภาษาไทย (เก็บแยกเพื่อใช้อภิปรายผลในบทที่ 5 โดยไม่หักคะแนนความแม่นยำ)',
    '- weak_keys_json: ความถี่ของอักขระที่พิมพ์ผิดรายตัวในรูปแบบ JSON เพื่อวิเคราะห์จุดอ่อนเฉพาะแป้น',
    '- shift_no / device_tag / is_iep_excluded: ผลัดการเรียน (1 หรือ 2), รหัสเครื่องคอมพิวเตอร์ และธงเกณฑ์คัดกรองนักเรียนแผน IEP ในขั้นวิเคราะห์สถิติ',
    '',
    '2. สูตรการคำนวณมาตรฐานโหมด Strict-Stop (5 อักขระ = 1 คำมาตรฐานภาษาไทย)',
    '- Duration (min) = max(duration_actual_sec / 60, 1 / 60)',
    '- Gross CPM = total_keystrokes / Duration (min)',
    '- Net CPM = correct_chars / Duration (min)',
    '- Gross WPM = (total_keystrokes / 5) / Duration (min)',
    '- Net WPM = (correct_chars / 5) / Duration (min) = Net CPM / 5',
    '- Accuracy (%) = (correct_chars / total_keystrokes) x 100 (กรณี total_keystrokes = 0 มีค่าเท่ากับ 0)',
    '- ความสัมพันธ์เชื่อมโยง: Net WPM = Gross WPM x (Accuracy % / 100)',
    '',
    'เหตุผลทางวิชาการ: เนื่องจากระบบทำงานในโหมด Strict-Stop ที่บังคับให้นักเรียนแก้ไขตัวอักษรที่กดผิดจนถูกต้องก่อนเคอร์เซอร์จะเลื่อนผ่าน จึงไม่มีคำผิดคงค้างในผลลัพธ์ (Uncorrected Errors = 0) และการกดผิดทุกครั้งได้ลงโทษผู้เรียนผ่านเวลาจริงที่เสียไปและสะท้อนในค่า Accuracy % แล้ว การใช้สูตร Net WPM = (correct_chars / 5) / Duration (min) จึงช่วยหลีกเลี่ยงการลงโทษซ้ำซ้อนและป้องกันภาวะ Floor Effect ที่มักเกิดขึ้นในสูตรหัก 5 อักขระต่อความผิด 1 ครั้ง (ซึ่งกดคะแนนผู้เรียนที่มีความแม่นยำไม่เกินร้อยละ 80 ลงเป็น 0.00 WPM ทั้งหมด)',
    '',
    '3. กลไกควบคุมความเที่ยงตรงของระบบวิจัย',
    '1) Strict-Stop Mode & Canonical Thai Unicode Order: ตรวจทีละอักขระตามลำดับมาตรฐานภาษาไทย (พยัญชนะ -> สระบน/ล่าง -> วรรณยุกต์) และแสดงผลเป็น Grapheme Cluster',
    '2) Language Guard: แจ้งเตือนเมื่อลืมเปลี่ยนภาษาเป็นไทยโดยไม่หักความแม่นยำและบันทึกความถี่แยกไว้',
    '3) Research Integrity Lock: ปิดไฟนำทางและแถบช่วยปุ่ม Shift อัตโนมัติในโหมด PRETEST และ POSTTEST พร้อมใช้ลำดับคำศัพท์คงที่',
    '4) First-Keystroke Timer: เริ่มจับเวลาจริงเมื่อผู้เรียนกดแป้นพิมพ์แรก',
    '5) Session PIN & One-Attempt Lock: ควบคุมรอบฝึกด้วยรหัส PIN 4 หลัก และล็อกชื่อนักเรียนทันทีหลังส่งคะแนนเพื่อป้องกันการทำซ้ำ',
    '6) Inclusive Classroom & IEP Statistical Filter: จัดการเรียนรู้แบบเรียนรวมหน้างาน และรองรับการคัดกรองนักเรียนแผน IEP ออกตามเกณฑ์ Exclusion Criteria ในขั้นตอนวิเคราะห์ข้อมูลทางสถิติ',
  ].join('\n');
}

async function copyPlainText(text) {
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

function updateSimulatorCalculation() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  const secInput = modal.querySelector('#ri-sim-sec');
  const correctInput = modal.querySelector('#ri-sim-correct');
  const errorInput = modal.querySelector('#ri-sim-errors');
  const outputsEl = modal.querySelector('#ri-sim-outputs');
  const stepsEl = modal.querySelector('#ri-sim-steps');
  if (!secInput || !correctInput || !errorInput || !outputsEl || !stepsEl) return;

  const durationSec = Math.max(1, Number(secInput.value) || 0);
  const correctChars = Math.max(0, Math.floor(Number(correctInput.value) || 0));
  const errorKeystrokes = Math.max(0, Math.floor(Number(errorInput.value) || 0));

  const totalKeystrokes = correctChars + errorKeystrokes;
  const durationMin = Math.max(durationSec / 60, 1 / 60);
  const grossCpm = totalKeystrokes / durationMin;
  const netCpm = correctChars / durationMin;
  const grossWpm = (totalKeystrokes / 5) / durationMin;
  const netWpm = (correctChars / 5) / durationMin;
  const accuracyPct = totalKeystrokes > 0 ? (correctChars / totalKeystrokes) * 100 : 0;

  const cards = [
    { label: 'total_keystrokes', val: `${totalKeystrokes}`, accent: 'text-slate-800 bg-white border-slate-200' },
    { label: 'Duration (min)', val: formatFixed(durationMin, 2), accent: 'text-slate-800 bg-white border-slate-200' },
    { label: 'Gross CPM', val: formatFixed(grossCpm, 2), accent: 'text-slate-700 bg-white border-slate-200' },
    { label: 'Net CPM', val: formatFixed(netCpm, 2), accent: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    { label: 'Gross WPM', val: formatFixed(grossWpm, 2), accent: 'text-slate-800 bg-white border-slate-200' },
    { label: 'Net WPM', val: formatFixed(netWpm, 2), accent: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Accuracy %', val: `${formatFixed(accuracyPct, 2)}%`, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ];

  outputsEl.innerHTML = cards
    .map(
      (c) => `
      <div class="p-2.5 rounded-xl border text-center ${c.accent}">
        <div class="text-[10px] font-bold opacity-75 truncate">${escapeHtml(c.label)}</div>
        <div class="font-mono font-extrabold text-sm md:text-base mt-0.5">${escapeHtml(c.val)}</div>
      </div>
    `
    )
    .join('');

  stepsEl.innerHTML = [
    `<div>1) total_keystrokes = ${correctChars} + ${errorKeystrokes} = <strong>${totalKeystrokes}</strong> ครั้ง</div>`,
    `<div>2) Duration (min) = max(${durationSec} / 60, 1 / 60) = <strong>${formatFixed(durationMin, 4)}</strong> นาที</div>`,
    `<div>3) Gross CPM = ${totalKeystrokes} / ${formatFixed(durationMin, 4)} = <strong>${formatFixed(grossCpm, 2)}</strong> อักขระ/นาที</div>`,
    `<div>4) Net CPM = ${correctChars} / ${formatFixed(durationMin, 4)} = <strong>${formatFixed(netCpm, 2)}</strong> อักขระ/นาที</div>`,
    `<div>5) Gross WPM = (${totalKeystrokes} / 5) / ${formatFixed(durationMin, 4)} = <strong>${formatFixed(grossWpm, 2)}</strong> คำ/นาที</div>`,
    `<div>6) Net WPM = (${correctChars} / 5) / ${formatFixed(durationMin, 4)} = <strong class="text-blue-700">${formatFixed(netWpm, 2)}</strong> คำ/นาที</div>`,
    `<div>7) Accuracy (%) = ${totalKeystrokes > 0 ? `(${correctChars} / ${totalKeystrokes}) &times; 100` : '0'} = <strong class="text-emerald-700">${formatFixed(accuracyPct, 2)}%</strong></div>`,
  ].join('');
}

function setActiveTab(tabId) {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;

  const valid = TABS.some((t) => t.id === tabId) ? tabId : 'variables';
  activeTab = valid;

  modal.querySelectorAll('[data-ri-tab]').forEach((btn) => {
    const isSelected = btn.dataset.riTab === activeTab;
    btn.setAttribute('aria-selected', String(isSelected));
    btn.className = isSelected
      ? 'inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs md:text-sm font-extrabold border-b-2 border-blue-600 text-blue-700 whitespace-nowrap transition'
      : 'inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs md:text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap transition';
  });

  modal.querySelectorAll('[data-ri-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.riPanel !== activeTab);
  });

  const body = modal.querySelector('#ri-modal-body');
  if (body) body.scrollTop = 0;
  if (activeTab === 'simulator') {
    updateSimulatorCalculation();
  }
}

export function closeResearchInfoModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

export function openResearchInfoModal(defaultTab = 'variables') {
  initResearchInfoModal();
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  setActiveTab(defaultTab);
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

export function initResearchInfoModal() {
  if (initialized && document.getElementById(MODAL_ID)) return;
  initialized = true;

  if (document.getElementById(MODAL_ID)) return;

  const wrapper = document.createElement('div');
  wrapper.id = MODAL_ID;
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');
  wrapper.setAttribute('aria-labelledby', 'ri-modal-title');
  wrapper.className = 'hidden fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 md:p-6';

  const copyIdleHtml = `${icon('copy', 'w-4 h-4')}<span>คัดลอกเนื้อหาสรุปสำหรับบทที่ 3</span>`;

  wrapper.innerHTML = `
    <div class="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
      <!-- Sticky Header -->
      <div class="shrink-0 bg-white border-b border-slate-200 px-5 md:px-6 pt-4 md:pt-5 pb-0">
        <div class="flex items-start justify-between gap-3 pb-3">
          <div class="flex items-start gap-3 min-w-0">
            <span class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              ${icon('bookOpen', 'w-5 h-5')}
            </span>
            <div class="min-w-0">
              <h2 id="ri-modal-title" class="text-base md:text-xl font-extrabold text-slate-900 leading-snug">
                ข้อมูลละเอียดและนิยามการคำนวณสำหรับงานวิจัย
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                เอกสารอ้างอิงตัวแปร สูตรคำนวณมาตรฐาน Strict-Stop และกลไกควบคุมความเที่ยงตรงของระบบ
              </p>
            </div>
          </div>
          <button id="ri-close-x" type="button" aria-label="ปิดหน้าต่าง" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0">
            ${icon('x', 'w-5 h-5')}
          </button>
        </div>

        <!-- 4 Navigation Tabs -->
        <div class="flex gap-1 overflow-x-auto -mx-1 px-1" role="tablist">
          ${TABS.map(
            (t) => `
            <button type="button" role="tab" data-ri-tab="${t.id}" aria-selected="false" class="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs md:text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap transition">
              ${icon(t.iconName, 'w-4 h-4')}
              <span>${escapeHtml(t.label)}</span>
            </button>
          `
          ).join('')}
        </div>
      </div>

      <!-- Scrollable Body -->
      <div id="ri-modal-body" class="flex-1 min-h-0 overflow-y-auto px-5 md:px-6 py-5">
        <div data-ri-panel="variables">${buildVariablesTabHtml()}</div>
        <div data-ri-panel="formulas" class="hidden">${buildFormulasTabHtml()}</div>
        <div data-ri-panel="simulator" class="hidden">${buildSimulatorTabHtml()}</div>
        <div data-ri-panel="integrity" class="hidden">${buildIntegrityTabHtml()}</div>
      </div>

      <!-- Sticky Footer -->
      <div class="shrink-0 bg-slate-50 border-t border-slate-200 px-5 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <button id="ri-copy-thesis" type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm shadow-xs transition">
          ${copyIdleHtml}
        </button>
        <button id="ri-close-footer" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs md:text-sm transition">
          ${icon('x', 'w-4 h-4')}
          <span>ปิดหน้าต่าง</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  // Tab bindings
  wrapper.querySelectorAll('[data-ri-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.riTab));
  });

  // Close bindings: backdrop, X button, footer button, Escape key
  wrapper.addEventListener('click', (e) => {
    if (e.target === wrapper) closeResearchInfoModal();
  });
  wrapper.querySelector('#ri-close-x').addEventListener('click', closeResearchInfoModal);
  wrapper.querySelector('#ri-close-footer').addEventListener('click', closeResearchInfoModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !wrapper.classList.contains('hidden')) {
      closeResearchInfoModal();
    }
  });

  // Live Formula Simulator bindings
  ['#ri-sim-sec', '#ri-sim-correct', '#ri-sim-errors'].forEach((sel) => {
    const input = wrapper.querySelector(sel);
    if (input) input.addEventListener('input', updateSimulatorCalculation);
  });

  // Copy-for-Thesis button
  const copyBtn = wrapper.querySelector('#ri-copy-thesis');
  copyBtn.addEventListener('click', async () => {
    try {
      await copyPlainText(getThesisSummaryPlainText());
      copyBtn.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs md:text-sm shadow-xs transition';
      copyBtn.innerHTML = `${icon('check', 'w-4 h-4')}<span>คัดลอกเรียบร้อย</span>`;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copyBtn.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm shadow-xs transition';
        copyBtn.innerHTML = copyIdleHtml;
      }, 2200);
    } catch {
      // Clipboard unavailable
    }
  });

  setActiveTab('variables');
  updateSimulatorCalculation();
}
