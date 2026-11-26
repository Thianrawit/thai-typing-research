import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://gjmfchkhcfvncxpwhghw.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BLEX42FKoblQ220aKMgGcQ_JPqb9YnQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const MODE_LABELS = {
  PRETEST: 'ทดสอบก่อนเรียน',
  PRACTICE: 'ฝึกทักษะ',
  POSTTEST: 'ทดสอบหลังเรียน',
};

export const STAGES = [
  {
    id: 'PRETEST_A',
    title: 'แบบทดสอบก่อนเรียน (ชุด A)',
    shortTitle: 'ทดสอบก่อนเรียน A',
    description: 'คำศัพท์มาตรฐาน ป.6 จำนวน 50 คำ ครอบคลุมทุกแถวแป้นพิมพ์และปุ่ม Shift (ปิดไฟนำทาง)',
    guideMode: 'NONE',
    defaultMode: 'PRETEST',
  },
  {
    id: 'POSTTEST_A',
    title: 'แบบทดสอบหลังเรียน (ชุด A)',
    shortTitle: 'ทดสอบหลังเรียน A',
    description: 'คำศัพท์มาตรฐานชุดเดียวกับก่อนเรียน เพื่อวัดพัฒนาการเปรียบเทียบ (ปิดไฟนำทาง)',
    guideMode: 'NONE',
    defaultMode: 'POSTTEST',
  },
  {
    id: 'POSTTEST_B',
    title: 'แบบทดสอบหลังเรียน (ชุด B คู่ขนาน)',
    shortTitle: 'ทดสอบหลังเรียน B',
    description: 'คำศัพท์คู่ขนาน ป.6 จำนวน 50 คำ ระดับความยากและสัดส่วน Shift เทียบเท่าชุด A (ปิดไฟนำทาง)',
    guideMode: 'NONE',
    defaultMode: 'POSTTEST',
  },
  {
    id: 'STAGE_1',
    title: 'ด่านที่ 1: แป้นเหย้า (ฟ ห ก ด เ ้ ่ า ส ว ง)',
    shortTitle: 'ด่าน 1 แป้นเหย้า',
    description: 'ฝึกวางนิ้วหลักบนแป้นเหย้าและปุ่มข้างเคียง โดยไม่ใช้ปุ่ม Shift',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_2',
    title: 'ด่านที่ 2: สระบน-ล่าง และวรรณยุกต์',
    shortTitle: 'ด่าน 2 สระ-วรรณยุกต์',
    description: 'ฝึกลำดับการพิมพ์พยัญชนะ สระบน-ล่าง (ิ ี ึ ื ุ ู ั) และวรรณยุกต์ (่ ้)',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_3',
    title: 'ด่านที่ 3: แถวบน + แป้นเหย้า',
    shortTitle: 'ด่าน 3 แถวบน',
    description: 'ฝึกก้าวนิ้วขึ้นแถวบนร่วมกับแป้นเหย้า โดยไม่ใช้ปุ่ม Shift',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_4',
    title: 'ด่านที่ 4: แถวล่าง + แป้นเหย้า',
    shortTitle: 'ด่าน 4 แถวล่าง',
    description: 'ฝึกก้าวนิ้วลงแถวล่างร่วมกับแป้นเหย้า โดยไม่ใช้ปุ่ม Shift',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_5',
    title: 'ด่านที่ 5: คำศัพท์พื้นฐาน ป.6 (ไม่ยกแคร่)',
    shortTitle: 'ด่าน 5 ฝึกความเร็วไม่ยกแคร่',
    description: 'ฝึกความเร็วคำศัพท์พื้นฐาน ป.6 ทุกแถวแป้นพิมพ์แบบไม่ใช้ปุ่ม Shift',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_6',
    title: 'ด่านที่ 6: อักษรยกแคร่ Shift ที่ใช้บ่อย',
    shortTitle: 'ด่าน 6 ยกแคร่ Shift',
    description: 'ฝึกกดปุ่ม Shift ค้างไว้สำหรับอักษรยกแคร่ (ฆ ฉ ธ ณ ญ ฐ ษ ศ ซ ฮ โ ฤ ฒ ฬ ็ ๋ ๊ ์)',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_7',
    title: 'ด่านที่ 7: คำศัพท์ผสมระดับกลาง ป.6',
    shortTitle: 'ด่าน 7 ผสมระดับกลาง',
    description: 'ฝึกคำศัพท์ผสมทุกแถว สระ วรรณยุกต์ และยกแคร่ พร้อมไฟนำทาง',
    guideMode: 'FULL',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_8',
    title: 'ด่านที่ 8: คำประสม ป.6 (ไฟนำทางเมื่อผิด)',
    shortTitle: 'ด่าน 8 คำประสม',
    description: 'ฝึกพิมพ์คำประสม ป.6 โดยซ่อนไฟนำทางปกติและแสดงช่วยเฉพาะตอนพิมพ์ผิด',
    guideMode: 'ON_ERROR',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_9',
    title: 'ด่านที่ 9: คำศัพท์ก้าวหน้า ป.6 (ไฟนำทางเมื่อผิด)',
    shortTitle: 'ด่าน 9 ก้าวหน้า',
    description: 'ชุดคำศัพท์ ป.6 ระดับสูง เพิ่มความแม่นยำโดยไม่พึ่งพาไฟนำทาง',
    guideMode: 'ON_ERROR',
    defaultMode: 'PRACTICE',
  },
  {
    id: 'STAGE_10',
    title: 'ด่านที่ 10: ท้าทายเต็มรูปแบบ ป.6 (ไฟนำทางเมื่อผิด)',
    shortTitle: 'ด่าน 10 ท้าทายเต็มรูปแบบ',
    description: 'ด่านท้าทายสูงสุดก่อนสอบหลังเรียน รวมคำศัพท์สำคัญ ป.6 ครบชุด',
    guideMode: 'ON_ERROR',
    defaultMode: 'PRACTICE',
  },
];

const STAGE_MAP = new Map(STAGES.map((stage) => [stage.id, stage]));

export function getStageMeta(stageId) {
  return (
    STAGE_MAP.get(stageId) || {
      id: stageId,
      title: stageId || 'ไม่ระบุชุดฝึก',
      shortTitle: stageId || '-',
      description: '',
      guideMode: 'FULL',
      defaultMode: 'PRACTICE',
    }
  );
}

const DEVICE_TAG_KEY = 'thai_typing_device_tag';

export function getDeviceTag() {
  try {
    const existing = localStorage.getItem(DEVICE_TAG_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const created = `PC-${randomCode}`;
    localStorage.setItem(DEVICE_TAG_KEY, created);
    return created;
  } catch {
    return 'PC-0000';
  }
}

export function setDeviceTag(tag) {
  const cleaned = String(tag || '')
    .trim()
    .toUpperCase()
    .slice(0, 24);
  if (!cleaned) return getDeviceTag();
  try {
    localStorage.setItem(DEVICE_TAG_KEY, cleaned);
  } catch {
    // Ignore storage quota errors
  }
  return cleaned;
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(filename, headers, rows) {
  const lines = [
    headers.map(escapeCSVField).join(','),
    ...rows.map((row) => row.map(escapeCSVField).join(',')),
  ];
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatNumber(val, decimals = 2) {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(decimals);
}

export function roundTo(val, decimals = 2) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveStudentShift(student, totalStudents = 0) {
  if (student && (Number(student.default_shift) === 1 || Number(student.default_shift) === 2)) {
    return Number(student.default_shift);
  }
  const half = Math.ceil(Math.max(1, totalStudents) / 2);
  return Number(student?.student_no || 1) <= half ? 1 : 2;
}

export function getShiftGroupMeta(students, shiftNo) {
  const total = Array.isArray(students) ? students.length : 0;
  const list = (students || [])
    .filter((s) => resolveStudentShift(s, total) === shiftNo)
    .sort((a, b) => Number(a.student_no) - Number(b.student_no));

  if (list.length === 0) {
    return {
      list,
      count: 0,
      rangeLabel: 'ไม่มีนักเรียน',
      title: `ผลัดที่ ${shiftNo} (0 คน)`,
    };
  }

  const minNo = Number(list[0].student_no);
  const maxNo = Number(list[list.length - 1].student_no);
  const rangeLabel = minNo === maxNo ? `เลขที่ ${minNo}` : `เลขที่ ${minNo}–${maxNo}`;

  return {
    list,
    count: list.length,
    rangeLabel,
    title: `ผลัดที่ ${shiftNo} (${rangeLabel})`,
  };
}
