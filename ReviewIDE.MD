# ReviewIDE — Grade 6 Thai Typing Research Web App

## 1. Project Files

| # | File | Role |
|---|------|------|
| 1 | `css/style.css` | Native OpenType Thai shaping (`font-feature-settings: "ccmp" 1, "mark" 1, "mkmk" 1`, `letter-spacing: 0`, `line-height: 1.9`), grapheme-cluster highlight states, hardware-accelerated shake/pulse animations, responsive 60 FPS Kedmanee virtual keyboard styles |
| 2 | `js/icons.js` | Crisp Lucide-style inline SVG icon library (`icon(name, className)`) replacing 100% of emojis and arrow/check/symbol glyphs across all pages |
| 3 | `js/config.js` | Supabase ESM client (`@supabase/supabase-js@2`), 13 `STAGES` metadata definitions, `MODE_LABELS`, `getDeviceTag()`/`setDeviceTag()`, `generateUUID()`, UTF-8 BOM `downloadCSV()`, `formatNumber()`, `roundTo()`, `escapeHtml()` |
| 4 | `js/sound.js` | Pure Web Audio API synthesizer (`soundEngine`: `playCorrect`, `playError`, `playWordComplete`, `playFinish`, `isMuted`, `toggleMute` persisted in `localStorage`) |
| 5 | `js/words.js` | 13 authentic Grade 6 OBEC (สพฐ. ป.6) Thai vocabulary banks (`PRETEST_A`, `POSTTEST_A`, `POSTTEST_B` @ 50 words each; `STAGE_1`–`STAGE_10` @ 42–54 words each) audited for strict canonical Thai Unicode order |
| 6 | `js/keyboard.js` | Verified TIS 820-2538 Thai Kedmanee keymap (`KEDMANEE_ROWS`, `KEDMANEE_CHAR_MAP`) and `KedmaneeKeyboard` class (`FULL` / `ON_ERROR` / `NONE` guide modes, Shift `"กดค้าง"` + shifted layer swap, SVG modifier icons, `event.code` press feedback, amber hint on error) |
| 7 | `js/game.js` | Student gameplay controller: 4-screen state machine, full-width 1-column-per-shift roster (zero name truncation), `Intl.Segmenter('th', { granularity: 'grapheme' })` cluster rendering + combining-mark sequence bar, Unicode strict-stop engine, Latin-key Language Guard, Pretest/Posttest Research Integrity Lock, exact CPM/WPM/Accuracy formulas, `localStorage`-first offline-resilient `submit_typing_log` queue, 15-second auto-logout |
| 8 | `js/admin.js` | Teacher control panel: Supabase Auth (`signInWithPassword`), session creation/PIN reroll/auto-close prior active sessions, Giant Classroom PIN hero card with `"คัดลอกรหัส"` + `"ลบรหัสรอบ"`, 5-second auto-refresh 22-student Live Monitor with `"ลบเพื่อสอบใหม่"`, Past Sessions table with `"คัดลอกรหัส"`, re-open/close toggle, and `"ลบรหัสรอบ"` (`ON DELETE CASCADE` confirmation modal), plus 22-student Roster Manager & Bulk Paste |
| 9 | `js/dashboard.js` | Research analytics dashboard: Auth guard, sticky IEP Exclusion toggle, individual student filter, 4 KPI cards (Mean/SD/Median/Attendance/Eng Warnings), 4 Chart.js charts with white-background PNG download, sortable summary table with SVG sort chevrons, and UTF-8 BOM CSV exports (Raw Logs & SPSS/Jamovi Pre-Post Paired) |
| 10 | `index.html` | Student interface (PIN entry + PC Tag modal, 2-shift full-width Roster + Confirmation modal, 100vh zero-scroll Gameplay screen, Summary & 15s Auto-Logout) — 100% inline SVG icons |
| 11 | `admin.html` | Teacher Control Panel UI (Login, Session Control & Live Monitor tab, Student Roster Manager tab, Delete Log & Delete Session confirmation modals) — 100% inline SVG icons |
| 12 | `dashboard.html` | Research Analytics & Export UI (Login, sticky Filter bar, KPI grid, 4 Chart.js cards, Sortable table & CSV export buttons) — 100% inline SVG icons |
| 13 | `ReviewIDE.MD` | Architecture summary, verification report, and changelog |

---

## 2. Dashboard Strict-Stop Diagnostic & Student Summary Upgrade (Revision 7)

- **`js/icons.js`:** Added Lucide-style inline SVGs `eye`, `target`, `trendingUp`, `award`, and `fileSpreadsheet` (zero emojis across all files).
- **Shared Research Info Modal (`dashboard.html`, `js/dashboard.js`):** Mounted `initResearchInfoModal()` and added `"ข้อมูลละเอียด"` (`bookOpen` SVG) button in the top navbar opening `openResearchInfoModal('formulas')`.
- **Thai Combining-Mark Formatting:** Exported `formatThaiKeyLabel(ch)` prefixing Thai combining marks (`\u0E31`, `\u0E34-\u0E3A`, `\u0E47-\u0E4E`) with `◌` and mapping `' '` to `'Spacebar'` across Chart 3, Summary Table weak key column, and Student Summary Modal.
- **4 Strict-Stop KPI Cards:** Upgraded to display (1) Net WPM & Net CPM (`Net WPM * 5`) with Mean/S.D./Median (Min–Max), (2) Accuracy % with Mean/S.D./Median (Min–Max), (3) Class Mean Gross WPM vs Net WPM & `Speed Loss = Gross WPM - Net WPM`, and (4) Sessions, Attendance %, and total `eng_lang_warnings`.
- **5th Chart — Speed x Accuracy 4-Quadrant Diagnostic Scatter Plot:** Added full-width interactive Chart.js scatter plot with custom inline quadrant plugin (dashed `X = Class Median Net WPM`, `Y = 85%`, 4 coaching quadrant labels & tints, student number annotations), `ข้อมูลล่าสุด / Posttest` vs `Pretest` toggle, white-background PNG download, 4-card quadrant count strip, and click-to-open student summary.
- **Upgraded Summary Table & Teacher Student Summary Modal (`ใบสรุปผลรายบุคคลสำหรับครู`):** Added `ปุ่มพลาดมากสุด`, `กลุ่มพฤติกรรม`, and `"ดูสรุป"` (`eye` SVG) opening a detailed modal with 4 stat tiles, auto-generated Thai coaching note, Top 5 weak keys progress bars, full session history table, and `"คัดลอกสรุปรายบุคคล"`.
- **Upgraded Research Exports & Native MS Word Chapter 4 Table (`dashboard.html`, `js/dashboard.js`):** Added `speed_loss_wpm` to Raw Logs CSV; expanded Pre-Post Paired CSV to 17 SPSS/Jamovi columns (`pre/post gross_wpm, net_wpm, net_cpm, acc_pct, diff_net_wpm, diff_acc_pct, practice_count, total_eng_warnings`); upgraded `"คัดลอกตารางสถิติ (บทที่ 4)"` to write rich `text/html` + `text/plain` via `ClipboardItem` (with `contenteditable` + `execCommand('copy')` fallback) producing a native 3-line APA MS Word table in `TH SarabunPSK` 16pt (auto-omitting empty `N === 0` comparison rows and blanking repeated variable labels when both periods exist); added 1-click `"ดาวน์โหลดตาราง Word (.doc)"` (`chapter4_stats_table.doc`, A4 2.54cm margins).

## 3. Previous Updates (Revision 6 — Reusable `js/research-info.js`)

- **`js/icons.js`:** Added crisp Lucide-style inline SVGs `bookOpen`, `info`, `calculator`, and `clipboardCheck` (alongside existing `shieldCheck`, `x`, `copy`, `check`) with zero emojis.
- **`js/research-info.js`:** Created standalone reusable module exporting `initResearchInfoModal()` and `openResearchInfoModal(defaultTab = 'variables')` (ready to mount on `dashboard.html` in one call):
  - **Tab 1 (ตัวแปรทั้งหมด):** 3-tier operational definitions covering Primary Dependent Variables (`Net WPM`, `Accuracy %`), Supplementary Speed Metrics (`Gross WPM`, `Gross CPM`, `Net CPM`), and all 11 raw/context database columns (`typing_logs` & `students`).
  - **Tab 2 (สูตรคำนวณทั้งหมด):** Clean HTML fraction formula cards (offline-safe, zero MathJax CDN) for `Duration (min)`, `Gross CPM`, `Net CPM`, `Gross WPM`, `Net WPM`, `Accuracy %`, `Net WPM = Gross WPM * (Accuracy % / 100)`, plus the highlighted academic rationale explaining Strict-Stop Mode and avoiding Floor Effect.
  - **Tab 3 (ตัวอย่าง & ทดลองคำนวณ):** Side-by-side worked examples (Cases A & B in 180s) plus live interactive Formula Simulator (`sec=180`, `correct=123`, `errors=30`) computing all 7 outputs and step-by-step arithmetic in real time.
  - **Tab 4 (กลไกควบคุมความเที่ยงตรง):** 6 numbered academic research-integrity controls (Strict-Stop & Canonical Thai Unicode, Language Guard, Research Integrity Lock, First-Keystroke Timer, Session PIN & One-Attempt Lock, Inclusive Classroom & IEP Filter).
  - **Copy for Chapter 3:** Footer button `"คัดลอกเนื้อหาสรุปสำหรับบทที่ 3"` copies formal plain-text summary for MS Word / Google Docs with brief `"คัดลอกเรียบร้อย"` feedback.
- **`admin.html` & `js/admin.js`:** Added `"ข้อมูลละเอียด"` button (`bookOpen` SVG) in the logged-in header nav bar wired to `openResearchInfoModal('variables')`.

## 3. Previous Fixes (Revision 5 — Strict-Stop Net WPM / Net CPM Formula)

- **Scoring Formula Fix (`js/game.js`, `.agent/skills/thai-typing-dev/SKILL.md`):**
  - Eliminated the 5-character-per-error double penalty (`grossWpm - errorKeystrokes / durationMin`) that collapsed Net WPM to `0.0` at Accuracy <= 80% in Strict-Stop mode (where all errors are already corrected before advancing).
  - Updated both live HUD (`updateLiveMetricsUI`) and final submission payload (`buildSubmissionPayload`) to: `grossCpm = totalKeystrokes / durationMin`, `netCpm = correctChars / durationMin`, `grossWpm = (totalKeystrokes / 5) / durationMin`, `netWpm = (correctChars / 5) / durationMin`, `accuracyPct = totalKeystrokes > 0 ? (correctChars / totalKeystrokes) * 100 : 0` (rounded to 2 decimal places for `submit_typing_log`).
  - Synced `.agent/skills/thai-typing-dev/SKILL.md` Section 5 to prevent future regression.

## 3. Previous Upgrades (Revision 4 — Shifted Key Hardening, Dynamic Roster RPCs & Zero Hardcoded Counts)

1. **Upgrade 1 — Bulletproof Thai Shifted Key Handling, CapsLock Guard & Live Key Debugger (`js/keyboard.js`, `js/game.js`, `index.html`, `js/icons.js`):**
   - Exported `KEDMANEE_CODE_MAP` and `resolveKedmaneeChar(eventCode, shiftKey)` from `js/keyboard.js`.
   - Removed `'Process'` and `'Unidentified'` from `IGNORED_KEYS`; `keydown` is never blocked on `event.isComposing` unless `event.key === 'Dead'`.
   - Added physical `event.code` + `event.shiftKey` resolution fallback when `event.key` is `'Process'`/`'Unidentified'`/empty, OR when `event.code` and `event.shiftKey` match the expected Thai target key while `event.key` is not a Latin letter (`!/^[a-zA-Z]$/.test(event.key)`), fixing quirky Windows/Chrome `Shift+KeyF` (`โ`) and other shifted Thai keys without breaking the English-language guard.
   - Added `CapsLock` detection (`event.getModifierState('CapsLock')`) showing an amber `alertTriangle` SVG banner (`"ปุ่ม Caps Lock เปิดอยู่! กรุณากดปิด Caps Lock (ไม่งั้นปุ่มยกแคร่จะสลับด้าน)"`) without penalizing accuracy when the inverted shift layer of the target key is pressed.
   - Prevented default browser actions on active typing / `Shift+Key` / `Space` / `Slash` / `Quote` while preserving `F5`, `F12`, `Ctrl+R`, and `Ctrl+Alt+D`.
   - Added Live Key Debugger bar (`#key-debug-bar`) toggled via `(e.ctrlKey && e.altKey && e.code === 'KeyD') || e.code === 'F2'` (layout-independent `event.code`, works before timer starts) OR 1-click `"ตรวจปุ่ม"` SVG button (`#hud-debug-btn`) next to the Mute button in Screen 3 HUD, displaying live `key`, `code`, `shiftKey`, `capsLock`, `isComposing`, `resolvedChar`, `expectedChar`, plus a horizontal strip of the last 5 keydown events.
2. **Upgrade 2 — Student Add / Reorder / Delete & Auto-Renumber RPCs (`admin.html`, `js/admin.js`):**
   - Added compact Add Student form calling `add_student({ p_full_name, p_default_shift, p_is_iep_excluded })`.
   - Added Move Up / Move Down SVG buttons per row + `"บันทึกลำดับเลขที่ใหม่"` button (with `"แบ่งผลัด 1 / ผลัด 2 ครึ่งต่อครึ่งอัตโนมัติ"` checkbox) calling `reorder_students({ p_student_ids, p_rebalance_shifts })`.
   - Added Delete Student (`trash2` SVG) button per row opening `#delete-student-modal` with the exact renumbering warning and default-checked shift rebalance checkbox, calling `delete_student_and_renumber({ p_student_id, p_rebalance_shifts })` and immediately refreshing roster, live monitor, and session stats.
   - Refactored `saveAllStudents()` to update only `{ full_name, default_shift, is_iep_excluded }` so `student_no` is never modified directly from client JS.
   - Updated Bulk Paste helper to dynamically match the current roster size (`N`).
3. **Upgrade 3 — Dynamic Roster Counts & Shift Ranges Everywhere (`js/config.js`, `index.html`, `js/game.js`, `admin.html`, `js/admin.js`, `dashboard.html`, `js/dashboard.js`):**
   - Added shared `resolveStudentShift()` and `getShiftGroupMeta()` helpers in `js/config.js`.
   - Removed all hardcoded `22`, `1–11`, and `12–22` labels/fallbacks across all 3 pages; shift titles (`ผลัดที่ 1 (เลขที่ min–max)`), counts, progress badges, dashboard KPIs, attendance denominators, Chart 2 subtitle/X-axis, and CSV exports now dynamically compute from live Supabase roster data.

## 3. Previous Fixes (Revision 3 — Thai Combining-Mark Hardening)

- **Hardened Single-Text-Node Grapheme Rendering & `Noto Sans Thai` OpenType Shaping (`index.html`, `css/style.css`, `js/game.js`):**
  - Loaded `Noto Sans Thai` (`wght@500;600;700`) via Google Fonts in `index.html` and removed `font-bold` / `flex` blockification / any `tracking-*` utility class from `#current-word-display`.
  - Applied strict OpenType shaping CSS to `.thai-word-display, .thai-cluster`: `font-family: 'Noto Sans Thai', 'Sarabun', sans-serif; font-weight: 600; letter-spacing: 0 !important; word-spacing: 0 !important; line-height: 2 !important; font-kerning: normal; text-rendering: optimizeLegibility; font-feature-settings: "ccmp" 1, "mark" 1, "mkmk" 1;`.
  - Updated `renderWordZone()` in `js/game.js` to construct each Thai grapheme cluster via `document.createElement('span')` + `span.textContent = cluster.text` (`replaceChildren(frag)`), guaranteeing strictly ONE unbroken text node and ONE uniform color per cluster (`done`: `#059669`, `active`: `#2563eb` + `#dbeafe` + `.animate-word-shake` on error, `pending`: `#0f172a`) so Chromium HarfBuzz `mkmk` positioning never drops stacked tone marks onto vowels.
  - Kept the full character-by-character pill bar (`#char-step-strip`) directly below the focus word (`[ส] [◌ิ] [◌่] ...`) to show exact sub-character keystroke progress.

## 3. Previous Targeted Fixes (Revision 2)

1. **Fix 1 — Native Thai Vowel & Tone Mark Stacking + Word Normalization (`css/style.css`, `js/game.js`, `index.html`, `js/words.js`):**
   - Replaced per-character splitting in `#current-word-display` with Thai Grapheme Cluster grouping via `Intl.Segmenter('th', { granularity: 'grapheme' })` (+ regex fallback and `ำ` U+0E33 merging so `น้ำ`, `สิ่`, `ล้`, `ขึ้` each live inside ONE contiguous `<span>` text node).
   - Removed `tracking-wider` on `#current-word-display` and enforced `letter-spacing: 0 !important; font-feature-settings: "ccmp" 1, "mark" 1, "mkmk" 1; line-height: 1.9 !important;` with generous `py-4` vertical padding.
   - Mapped each cluster to `[startIdx, endIdx]` while preserving strict character-by-character `Array.from(word)` validation. Added the compact Combining-Mark Sequence Bar below the focus word whenever the active cluster has >1 character (prefixing combining marks with `◌` and maintaining a fixed `min-h-[30px]` placeholder when length is 1 to eliminate layout jump).
   - Audited 100% of words across all 13 `WORD_BANKS` for canonical Thai Unicode order (`0` malformed sequences, `0` double `เเ`, `0` decomposed `ำ`).
2. **Fix 2 — 100% Inline SVG Icons (`js/icons.js`, `index.html`, `admin.html`, `dashboard.html`, `js/keyboard.js`, `js/game.js`, `js/admin.js`, `js/dashboard.js`):**
   - Created `js/icons.js` exporting Lucide-style `icon(name, className)` covering all 25 required icons plus UI/keyboard utility icons.
   - Replaced 100% of emojis and arrow/check/cross/star/triangle/keycap text symbols across every HTML and JS file with crisp inline SVGs.
3. **Fix 3 — Delete Session (`ลบรหัสรอบ`) & Copy PIN (`คัดลอกรหัส`) (`admin.html`, `js/admin.js`):**
   - Added `"ลบรหัสรอบ"` (`trash2` SVG) on both the Active Session Hero Card and every row in the Past Sessions table, opening `#delete-session-modal` showing `session_id`, `session_pin`, and the permanent `ON DELETE CASCADE` warning before executing `supabase.from('sessions').delete().eq('session_id', sessionId)` and refreshing all views.
   - Added `"คัดลอกรหัส"` (`copy` SVG) next to the 4-digit PIN on both the Active Session Hero Card and every Past Sessions row with `"คัดลอกแล้ว"` (`check` SVG) feedback.
4. **Fix 4 — Full Student Names Without Truncation (`index.html`, `js/game.js`):**
   - Changed `#shift1-grid` and `#shift2-grid` inside the side-by-side shift containers (`lg:grid-cols-2`) to `grid-cols-1 gap-2`.
   - Removed `truncate` / `whitespace-nowrap` from student names in favor of `whitespace-normal break-words text-left leading-snug`, compact `py-2.5 px-3.5` padding, `chevronRight` SVG on available cards, and compact `"เล่นครบแล้ว"` pill with `check` SVG on completed rows.

---

## 3. Automated Verification Checklist

- [x] **Preserve `.github/workflows/keep-alive.yml`:** Confirmed 100% untouched.
- [x] **JS Syntax Check:** `node --check` passed across all 8 ES modules (`js/icons.js`, `js/config.js`, `js/sound.js`, `js/words.js`, `js/keyboard.js`, `js/game.js`, `js/admin.js`, `js/dashboard.js`).
- [x] **Zero Emojis / Text Symbols:** Regex audit across all HTML, CSS, and JS files confirmed `0` emojis and `0` forbidden arrow/check/cross/star/triangle symbols (only `◌` U+25CC retained for combining-mark key/step prefixes).
- [x] **Icon Integrity:** All 25 required icons in `js/icons.js` and every `icon(...)` invocation across JS modules verified non-empty.
- [x] **Thai Grapheme Cluster & Canonical Unicode Audit:** Every word in all 13 `WORD_BANKS` verified for canonical order, 100% `KEDMANEE_CHAR_MAP` coverage, and exact `Array.from(word)` index alignment after grapheme segmentation.
- [x] **DOM Integrity & RPC Contract:** Zero missing DOM IDs across `index.html`/`admin.html`/`dashboard.html`; `verify_session_and_get_roster` and all 18 `submit_typing_log` params preserved verbatim; `sessions.delete().eq('session_id', ...)` wired with confirmation modal.
