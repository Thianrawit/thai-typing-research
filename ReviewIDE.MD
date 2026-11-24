# ReviewIDE — Grade 6 Thai Typing Research Web App

## 1. Created Files (12 Target Files)

| # | File | Role |
|---|------|------|
| 1 | `css/style.css` | Sarabun Thai typography rules (zero clipping on above/below vowels & tone marks), hardware-accelerated shake/pulse animations, responsive 60 FPS Kedmanee virtual keyboard styles |
| 2 | `js/config.js` | Supabase ESM client (`@supabase/supabase-js@2`), 13 `STAGES` metadata definitions, `MODE_LABELS`, `getDeviceTag()`/`setDeviceTag()`, `generateUUID()`, UTF-8 BOM `downloadCSV()`, `formatNumber()`, `roundTo()`, `escapeHtml()` |
| 3 | `js/sound.js` | Pure Web Audio API synthesizer (`soundEngine`: `playCorrect`, `playError`, `playWordComplete`, `playFinish`, `isMuted`, `toggleMute` persisted in `localStorage`) |
| 4 | `js/words.js` | 13 authentic Grade 6 OBEC (สพฐ. ป.6) Thai vocabulary banks (`PRETEST_A`, `POSTTEST_A`, `POSTTEST_B` @ 50 words each; `STAGE_1`–`STAGE_10` @ 42–54 words each) with canonical Unicode order and deterministic order for tests |
| 5 | `js/keyboard.js` | Verified TIS 820-2538 Thai Kedmanee keymap (`KEDMANEE_ROWS`, `KEDMANEE_CHAR_MAP`) and `KedmaneeKeyboard` class (`FULL` / `ON_ERROR` / `NONE` guide modes, Shift `"กดค้าง"` + shifted layer visual swap, `event.code` press feedback, amber hint on error) |
| 6 | `js/game.js` | Student gameplay controller: 4-screen state machine, `verify_session_and_get_roster` RPC, Shift 1/2 roster lock, Unicode strict-stop engine, Latin-key Language Guard, Pretest/Posttest Research Integrity Lock, exact CPM/WPM/Accuracy formulas, `localStorage`-first offline-resilient `submit_typing_log` queue (3 retries + startup auto-flush), 15-second auto-logout |
| 7 | `js/admin.js` | Teacher control panel: Supabase Auth (`signInWithPassword`), session creation/PIN reroll/auto-close prior active sessions, Giant Classroom PIN hero card, 5-second auto-refresh 22-student Live Monitor split by Shift 1/2 with `"ลบเพื่อสอบใหม่"`, past sessions toggle, and 22-student Roster Manager + Excel/Word Bulk Paste |
| 8 | `js/dashboard.js` | Research analytics dashboard: Auth guard, sticky IEP Exclusion toggle (`All` vs `Research Group`), individual student filter, 4 KPI cards (Mean/SD/Median/Attendance/Eng Warnings), 4 Chart.js charts with white-background PNG download, sortable summary table, and UTF-8 BOM CSV exports (Raw Logs & SPSS/Jamovi Pre-Post Paired) |
| 9 | `index.html` | Student interface (PIN entry + PC Tag modal, 2-shift Roster + Confirmation modal, 100vh zero-scroll Gameplay screen, Summary & 15s Auto-Logout) |
| 10 | `admin.html` | Teacher Control Panel UI (Login, Session Control & Live Monitor tab, Student Roster Manager tab, Delete confirmation modal) |
| 11 | `dashboard.html` | Research Analytics & Export UI (Login, sticky Filter bar, KPI grid, 4 Chart.js cards, Sortable table & CSV export buttons) |
| 12 | `ReviewIDE.MD` | Architecture summary, verification report, and deployment/testing guide |

---

## 2. Architecture Summary

- **Zero-Build Static Stack:** Pure HTML5 + Tailwind CSS CDN + Vanilla ES Modules (`type="module"`) + Chart.js 4.4.7 CDN + `@supabase/supabase-js@2` ESM CDN. All asset and module paths are relative (`./css/...`, `./js/...`, `./index.html`, `./admin.html`, `./dashboard.html`) for seamless deployment under GitHub Pages subpaths (`/thai-typing-research/`).
- **Security & Auth Boundary:**
  - `index.html` / `js/game.js` never authenticates into Supabase Auth and invokes ONLY `verify_session_and_get_roster` and `submit_typing_log`.
  - `admin.html` and `dashboard.html` authenticate teachers via `supabase.auth.signInWithPassword()`.
  - Zero `service_role`/`sb_secret_` keys, zero hardcoded passwords, and zero manual `Authorization: Bearer sb_publishable_...` headers exist anywhere in the repository.
- **Research Integrity & Psychometric Design:**
  - `PRETEST` and `POSTTEST` force `guideMode = 'NONE'` (lights and Shift hints locked OFF) and serve words in fixed deterministic order.
  - `PRETEST_A` (50 words: avg 7.64 chars, 12.6% Shift chars) and `POSTTEST_B` (50 parallel non-overlapping words: avg 7.98 chars, 12.3% Shift chars) provide comparable difficulty without vocabulary overlap.
  - Offline-resilient submission persists `{ p_log_id: UUID, ... }` to `localStorage` **before** calling `submit_typing_log`, preventing score loss during school Wi-Fi drops and guaranteeing idempotency via fixed `log_id`.
  - Dashboard analytics calculate sample S.D. ($n-1$), exact Median, Mean, and export UTF-8 BOM CSVs ready for Excel, SPSS, and Jamovi Paired t-test / Wilcoxon Signed-Rank Test.

---

## 3. Automated Verification Checklist

- [x] **Preserve `.github/workflows/keep-alive.yml`:** Synced from `origin/main` and verified 100% untouched before committing and pushing.
- [x] **Relative Imports & Links:** All ES module imports (`./config.js`, `./sound.js`, `./words.js`, `./keyboard.js`) and HTML asset/page links verified on disk for GitHub Pages subpath compatibility.
- [x] **JS Syntax Check:** `node --check` passed on all 7 JS modules (`ALL_SYNTAX_OK`).
- [x] **RPC Contract Match:** Verified `verify_session_and_get_roster({ p_pin })` and all 18 `submit_typing_log` parameters (`p_pin`, `p_log_id`, `p_student_id`, `p_shift_no`, `p_duration_actual_sec`, `p_total_keystrokes`, `p_correct_chars`, `p_error_keystrokes`, `p_words_completed`, `p_gross_cpm`, `p_net_cpm`, `p_gross_wpm`, `p_net_wpm`, `p_accuracy_pct`, `p_max_combo`, `p_eng_lang_warnings`, `p_weak_keys_json`, `p_device_tag`) character-for-character against `SKILL.md`.
- [x] **Keymap & Vocabulary Coverage:** Automated Node validator verified:
  - All 44 Thai consonants + vowels + tone marks exist in `KEDMANEE_CHAR_MAP`.
  - 0 unmapped characters, 0 duplicate words, 0 non-canonical tone/vowel orders, 0 decomposed `ำ` or double `เเ` across all 13 banks.
  - `STAGE_1` strictly uses `{ฟ ห ก ด เ ้ ่ า ส ว ง}` (0% Shift); `STAGE_3` strictly Row 2+3 unshifted (0% Shift); `STAGE_4` strictly Row 4+3 unshifted (0% Shift); `STAGE_5` strictly unshifted (0% Shift); `STAGE_6` covers all 18 target Shift chars (`ฆ ฉ ธ ณ ญ ฐ ษ ศ ซ ฮ โ ฤ ฒ ฬ ็ ๋ ๊ ์`) with 100% of words requiring Shift.
- [x] **DOM Integrity:** Every `document.getElementById(...)` call in `game.js`, `admin.js`, and `dashboard.js` verified against its corresponding HTML file (`0` mismatches).
- [x] **Research Integrity Lock:** Confirmed `getEffectiveGuideMode()` returns `'NONE'` whenever `session.mode === 'PRETEST' || session.mode === 'POSTTEST'`, and `KedmaneeKeyboard.highlightTarget()` / `flashKeyPress()` never reveal target hints in `'NONE'` mode.

---

## 4. Deployment & Testing Steps

1. **Local Preview (Static HTTP Server required for ES Modules):**
   - Run `python -m http.server 8080` (or VS Code Live Server) in `d:\Program\thai-typing-research`.
   - Open `http://localhost:8080/admin.html` → sign in with your Supabase Teacher email/password → verify the 22-student roster in Tab 2 → create a test session (e.g., Week 0 `PRETEST` / `PRETEST_A`, 60s) and note the 4-digit PIN.
   - Open `http://localhost:8080/index.html` in a second tab → set PC tag (e.g., `PC-01`) → enter the 4-digit PIN → pick Student #1 → verify Pretest locks keyboard guide highlights OFF, Latin keys trigger the yellow `~` banner without penalty, and finishing auto-submits and counts down 15s back to the locked roster.
   - Open `http://localhost:8080/dashboard.html` → verify KPIs, all 4 charts, white-background PNG downloads, IEP toggle, and both CSV exports open cleanly in Thai inside Excel.
2. **GitHub Pages Deployment:**
   - Commit and push all 12 files (keeping `.github/workflows/keep-alive.yml` intact in the remote repo) to your `main` branch.
   - In GitHub Repository Settings → **Pages** → Source: **Deploy from a branch** (`main` / `/ (root)`).
   - Access student app at `https://<username>.github.io/thai-typing-research/`, teacher panel at `.../admin.html`, and dashboard at `.../dashboard.html`.
