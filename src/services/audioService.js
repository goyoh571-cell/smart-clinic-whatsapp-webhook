// ============================================================================
// AUDIO & SPEECH SYNTHESIS ENGINE (Hospital Dual-Tone Chime & Voice Broadcast)
// ============================================================================

export class AudioAnnouncementEngine {
  constructor() {
    this.ctx = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.enabled = false;
    this.isInitialized = false;
  }

  initContext() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.synth) {
        this.synth.resume();
        if (this.synth.getVoices().length === 0) {
          this.synth.onvoiceschanged = () => {};
        }
      }
      this.enabled = true;
      this.isInitialized = true;
    } catch (e) {
      console.warn('[Audio] Init warning:', e);
    }
  }

  // Play pleasant 2-tone hospital waiting room chime (587Hz -> 440Hz)
  playChime() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Tone 1: D5 (587.33 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // Tone 2: A4 (440.0 Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440.0, now + 0.26);
      gain2.gain.setValueAtTime(0.3, now + 0.26);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.26);
      osc2.stop(now + 0.85);
    } catch (e) {
      console.warn('[Audio] Chime playback warning:', e);
    }
  }

  // Voice announcement via Web Speech API with dynamic room name
  announce(tokenNumber, patientName, room = 'Consultation Room 1') {
    if (!this.enabled) return;
    this.playChime();

    if (this.synth) {
      setTimeout(() => {
        try {
          this.synth.cancel();
          const cleanToken = tokenNumber ? tokenNumber.replace('-', ' ') : 'Token';
          const text = `Token ${cleanToken}, ${patientName || 'Patient'}, please proceed to ${room}.`;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.92;
          utterance.pitch = 1.05;
          utterance.volume = 1.0;

          const voices = this.synth.getVoices();
          const naturalVoice = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female'))
          );
          if (naturalVoice) utterance.voice = naturalVoice;

          this.synth.speak(utterance);
        } catch (err) {
          console.warn('[Speech] Voice announcement warning:', err);
        }
      }, 600);
    }
  }
}

export const audioService = new AudioAnnouncementEngine();
