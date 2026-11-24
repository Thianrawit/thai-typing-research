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

## 2. Targeted Fixes Applied (Revision 2)

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
