// Verified Standard Thai Kedmanee Keymap (TIS 820-2538)
import { icon } from './icons.js';

export const KEDMANEE_ROWS = [
  [
    { code: 'Backquote', normal: '_', shift: '%', badge: '~ ภาษา', width: 1.0 },
    { code: 'Digit1', normal: 'ๅ', shift: '+', width: 1.0 },
    { code: 'Digit2', normal: '/', shift: '๑', width: 1.0 },
    { code: 'Digit3', normal: '-', shift: '๒', width: 1.0 },
    { code: 'Digit4', normal: 'ภ', shift: '๓', width: 1.0 },
    { code: 'Digit5', normal: 'ถ', shift: '๔', width: 1.0 },
    { code: 'Digit6', normal: 'ุ', shift: 'ู', width: 1.0 },
    { code: 'Digit7', normal: 'ึ', shift: '฿', width: 1.0 },
    { code: 'Digit8', normal: 'ค', shift: '๕', width: 1.0 },
    { code: 'Digit9', normal: 'ต', shift: '๖', width: 1.0 },
    { code: 'Digit0', normal: 'จ', shift: '๗', width: 1.0 },
    { code: 'Minus', normal: 'ข', shift: '๘', width: 1.0 },
    { code: 'Equal', normal: 'ช', shift: '๙', width: 1.0 },
    { code: 'Backspace', label: 'ลบ', iconName: 'deleteKey', isModifier: true, width: 1.7 },
  ],
  [
    { code: 'Tab', label: 'Tab', isModifier: true, width: 1.45 },
    { code: 'KeyQ', normal: 'ๆ', shift: '๐', width: 1.0 },
    { code: 'KeyW', normal: 'ไ', shift: '"', width: 1.0 },
    { code: 'KeyE', normal: 'ำ', shift: 'ฎ', width: 1.0 },
    { code: 'KeyR', normal: 'พ', shift: 'ฑ', width: 1.0 },
    { code: 'KeyT', normal: 'ะ', shift: 'ธ', width: 1.0 },
    { code: 'KeyY', normal: 'ั', shift: 'ํ', width: 1.0 },
    { code: 'KeyU', normal: 'ี', shift: '๊', width: 1.0 },
    { code: 'KeyI', normal: 'ร', shift: 'ณ', width: 1.0 },
    { code: 'KeyO', normal: 'น', shift: 'ฯ', width: 1.0 },
    { code: 'KeyP', normal: 'ย', shift: 'ญ', width: 1.0 },
    { code: 'BracketLeft', normal: 'บ', shift: 'ฐ', width: 1.0 },
    { code: 'BracketRight', normal: 'ล', shift: ',', width: 1.0 },
    { code: 'Backslash', normal: 'ฃ', shift: 'ฅ', width: 1.25 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', isModifier: true, width: 1.75 },
    { code: 'KeyA', normal: 'ฟ', shift: 'ฤ', isHome: true, width: 1.0 },
    { code: 'KeyS', normal: 'ห', shift: 'ฆ', isHome: true, width: 1.0 },
    { code: 'KeyD', normal: 'ก', shift: 'ฏ', isHome: true, width: 1.0 },
    { code: 'KeyF', normal: 'ด', shift: 'โ', isHome: true, hasBump: true, width: 1.0 },
    { code: 'KeyG', normal: 'เ', shift: 'ฌ', width: 1.0 },
    { code: 'KeyH', normal: '้', shift: '็', width: 1.0 },
    { code: 'KeyJ', normal: '่', shift: '๋', isHome: true, hasBump: true, width: 1.0 },
    { code: 'KeyK', normal: 'า', shift: 'ษ', isHome: true, width: 1.0 },
    { code: 'KeyL', normal: 'ส', shift: 'ศ', isHome: true, width: 1.0 },
    { code: 'Semicolon', normal: 'ว', shift: 'ซ', isHome: true, width: 1.0 },
    { code: 'Quote', normal: 'ง', shift: '.', width: 1.0 },
    { code: 'Enter', label: 'Enter', iconName: 'cornerDownLeft', isModifier: true, width: 1.95 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', iconName: 'arrowUp', isModifier: true, isShift: true, width: 2.25 },
    { code: 'KeyZ', normal: 'ผ', shift: '(', width: 1.0 },
    { code: 'KeyX', normal: 'ป', shift: ')', width: 1.0 },
    { code: 'KeyC', normal: 'แ', shift: 'ฉ', width: 1.0 },
    { code: 'KeyV', normal: 'อ', shift: 'ฮ', width: 1.0 },
    { code: 'KeyB', normal: 'ิ', shift: 'ฺ', width: 1.0 },
    { code: 'KeyN', normal: 'ื', shift: '์', width: 1.0 },
    { code: 'KeyM', normal: 'ท', shift: '?', width: 1.0 },
    { code: 'Comma', normal: 'ม', shift: 'ฒ', width: 1.0 },
    { code: 'Period', normal: 'ใ', shift: 'ฬ', width: 1.0 },
    { code: 'Slash', normal: 'ฝ', shift: 'ฦ', width: 1.0 },
    { code: 'ShiftRight', label: 'Shift', iconName: 'arrowUp', isModifier: true, isShift: true, width: 2.45 },
  ],
  [
    { code: 'SpacerL', label: '', isSpacer: true, width: 3.4 },
    { code: 'Space', normal: ' ', shift: ' ', label: 'เว้นวรรค (Space)', isSpace: true, width: 6.2 },
    { code: 'SpacerR', label: '', isSpacer: true, width: 3.4 },
  ],
];

export const KEDMANEE_CHAR_MAP = (() => {
  const map = new Map();
  for (const row of KEDMANEE_ROWS) {
    for (const key of row) {
      if (key.isSpacer) continue;
      if (typeof key.normal === 'string' && !map.has(key.normal)) {
        map.set(key.normal, { code: key.code, needsShift: false });
      }
      if (typeof key.shift === 'string' && key.shift !== key.normal && !map.has(key.shift)) {
        map.set(key.shift, { code: key.code, needsShift: true });
      }
    }
  }
  return map;
})();

export const KEDMANEE_CODE_MAP = (() => {
  const map = new Map();
  for (const row of KEDMANEE_ROWS) {
    for (const key of row) {
      if (key.isSpacer || key.isModifier) continue;
      if (typeof key.normal === 'string') {
        map.set(key.code, {
          normal: key.normal,
          shift: typeof key.shift === 'string' ? key.shift : key.normal,
        });
      }
    }
  }
  return map;
})();

export function resolveKedmaneeChar(eventCode, shiftKey) {
  const entry = KEDMANEE_CODE_MAP.get(eventCode);
  if (!entry) return '';
  return shiftKey ? entry.shift : entry.normal;
}

const COMBINING_MARKS = new Set([
  'ั', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ฺ',
  '่', '้', '๊', '๋', '็', '์', 'ํ',
]);

function displayGlyph(ch) {
  if (!ch) return '';
  return COMBINING_MARKS.has(ch) ? `◌${ch}` : ch;
}

export class KedmaneeKeyboard {
  constructor(container) {
    this.container = container;
    this.guideMode = 'FULL';
    this.currentExpectedChar = null;
    this.keyElements = new Map();
    this.flashTimers = new Map();
    this.hintTimers = new Map();
    this.shellEl = null;
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.keyElements.clear();

    const shell = document.createElement('div');
    shell.className = 'kb-shell';
    shell.setAttribute('aria-label', 'แป้นพิมพ์ภาษาไทยเกษมณี');
    this.shellEl = shell;

    for (const row of KEDMANEE_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';

      for (const def of row) {
        if (def.isSpacer) {
          const spacer = document.createElement('div');
          spacer.style.flex = `${def.width} 1 0`;
          rowEl.appendChild(spacer);
          continue;
        }

        const keyEl = document.createElement('div');
        keyEl.className = 'kb-key';
        keyEl.dataset.code = def.code;
        keyEl.style.flex = `${def.width || 1} 1 0`;

        if (def.isHome) keyEl.classList.add('kb-key-home');
        if (def.hasBump) keyEl.classList.add('kb-key-bump');
        if (def.isModifier) keyEl.classList.add('kb-key-modifier');
        if (def.isSpace) keyEl.classList.add('kb-key-space');

        if (def.isShift) {
          keyEl.innerHTML = `${icon(def.iconName, 'w-3.5 h-3.5')}<span>${def.label}</span><span class="kb-shift-hold-badge">กดค้าง</span>`;
        } else if (def.isModifier) {
          keyEl.innerHTML = def.iconName
            ? `${icon(def.iconName, 'w-3.5 h-3.5')}<span>${def.label}</span>`
            : `<span>${def.label}</span>`;
        } else if (def.isSpace) {
          keyEl.textContent = def.label;
        } else {
          const shiftSpan = document.createElement('span');
          shiftSpan.className = 'kb-glyph-shift';
          shiftSpan.textContent = displayGlyph(def.shift);

          const normalSpan = document.createElement('span');
          normalSpan.className = 'kb-glyph-normal';
          normalSpan.textContent = displayGlyph(def.normal);

          keyEl.appendChild(shiftSpan);
          keyEl.appendChild(normalSpan);

          if (def.badge) {
            const badge = document.createElement('span');
            badge.className = 'kb-lang-badge';
            badge.textContent = def.badge;
            keyEl.appendChild(badge);
          }
        }

        this.keyElements.set(def.code, keyEl);
        rowEl.appendChild(keyEl);
      }

      shell.appendChild(rowEl);
    }

    this.container.appendChild(shell);
  }

  setGuideMode(mode) {
    if (mode === 'FULL' || mode === 'ON_ERROR' || mode === 'NONE') {
      this.guideMode = mode;
    } else {
      this.guideMode = 'FULL';
    }
    this.clearHighlights();
    if (this.guideMode === 'FULL' && this.currentExpectedChar) {
      this.highlightTarget(this.currentExpectedChar);
    }
  }

  clearHighlights() {
    for (const timer of this.hintTimers.values()) {
      clearTimeout(timer);
    }
    this.hintTimers.clear();

    if (this.shellEl) {
      this.shellEl.classList.remove('shift-layer-active');
    }

    for (const el of this.keyElements.values()) {
      el.classList.remove('key-target', 'key-shift-target', 'key-hint-amber');
    }
  }

  highlightTarget(expectedChar) {
    this.currentExpectedChar = expectedChar || null;
    this.clearHighlights();

    if (this.guideMode !== 'FULL' || !expectedChar) {
      return;
    }

    const mapping = KEDMANEE_CHAR_MAP.get(expectedChar);
    if (!mapping) return;

    const targetEl = this.keyElements.get(mapping.code);
    if (targetEl) {
      targetEl.classList.add('key-target');
    }

    if (mapping.needsShift) {
      this.shellEl?.classList.add('shift-layer-active');
      this.keyElements.get('ShiftLeft')?.classList.add('key-shift-target');
      this.keyElements.get('ShiftRight')?.classList.add('key-shift-target');
    }
  }

  _flashAmberKey(code, durationMs = 850) {
    const el = this.keyElements.get(code);
    if (!el) return;

    if (this.hintTimers.has(code)) {
      clearTimeout(this.hintTimers.get(code));
    }

    el.classList.add('key-hint-amber');
    const timer = setTimeout(() => {
      el.classList.remove('key-hint-amber');
      this.hintTimers.delete(code);
      if (this.hintTimers.size === 0 && this.guideMode === 'ON_ERROR') {
        this.shellEl?.classList.remove('shift-layer-active');
      }
    }, durationMs);
    this.hintTimers.set(code, timer);
  }

  flashKeyPress(eventCode, isCorrect) {
    const pressedEl = this.keyElements.get(eventCode);
    if (pressedEl) {
      if (this.flashTimers.has(eventCode)) {
        clearTimeout(this.flashTimers.get(eventCode));
      }

      pressedEl.classList.remove('key-press-correct', 'key-press-error');
      const cls = isCorrect ? 'key-press-correct' : 'key-press-error';
      pressedEl.classList.add(cls);

      const timer = setTimeout(() => {
        pressedEl.classList.remove('key-press-correct', 'key-press-error');
        this.flashTimers.delete(eventCode);
      }, isCorrect ? 160 : 240);
      this.flashTimers.set(eventCode, timer);
    }

    if (!isCorrect && this.guideMode === 'ON_ERROR' && this.currentExpectedChar) {
      const mapping = KEDMANEE_CHAR_MAP.get(this.currentExpectedChar);
      if (mapping) {
        this._flashAmberKey(mapping.code, 900);
        if (mapping.needsShift) {
          this.shellEl?.classList.add('shift-layer-active');
          this._flashAmberKey('ShiftLeft', 900);
          this._flashAmberKey('ShiftRight', 900);
        }
      }
    }
  }
}
