const MUTE_STORAGE_KEY = 'thai_typing_sound_muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = this._loadMuted();
  }

  _loadMuted() {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  _ensureContext() {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  _playTone({ freqStart, freqEnd = freqStart, duration = 0.06, type = 'sine', gain = 0.08, delay = 0 }) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  playCorrect() {
    this._playTone({
      freqStart: 720,
      freqEnd: 880,
      duration: 0.045,
      type: 'sine',
      gain: 0.065,
    });
  }

  playError() {
    this._playTone({
      freqStart: 210,
      freqEnd: 145,
      duration: 0.09,
      type: 'triangle',
      gain: 0.095,
    });
  }

  playWordComplete() {
    this._playTone({ freqStart: 523.25, duration: 0.075, type: 'sine', gain: 0.075, delay: 0 });
    this._playTone({ freqStart: 659.25, duration: 0.085, type: 'sine', gain: 0.075, delay: 0.055 });
    this._playTone({ freqStart: 783.99, duration: 0.12, type: 'sine', gain: 0.08, delay: 0.11 });
  }

  playFinish() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this._playTone({
        freqStart: freq,
        duration: idx === notes.length - 1 ? 0.34 : 0.12,
        type: 'sine',
        gain: 0.09,
        delay: idx * 0.095,
      });
    });
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    } catch {
      // Ignore storage errors
    }
    if (!this.muted) {
      this.playCorrect();
    }
    return this.muted;
  }
}

export const soundEngine = new SoundEngine();
