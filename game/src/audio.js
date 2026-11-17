// EMBERDRIFT — every sound the game makes, synthesized live with WebAudio.
// No audio files: each effect is a small oscillator/noise recipe, and the
// background is a slow two-voice pad that starts on the first user gesture
// (browsers forbid audio before one).

const NOTE = { C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, E5: 659.25, G5: 783.99 };

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    return true;
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, volume, lowpass) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
  }

  // A slow, quiet pad: two detuned triangle voices stepping through a
  // four-chord loop (Am – F – C – G) every 2.4 seconds.
  function startMusic() {
    if (!context || musicTimer !== null) return;
    const chords = [
      [NOTE.A4, NOTE.C5, NOTE.E5],
      [NOTE.C4, NOTE.E4, NOTE.G4],
      [NOTE.C4, NOTE.E4, NOTE.G5],
      [NOTE.G4, NOTE.A4, NOTE.G5],
    ];
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const chord = chords[musicStep % chords.length];
      musicStep += 1;
      for (const freq of chord) tone(freq, 2.6, 'triangle', 0.035);
    }, 2400);
  }

  return {
    unlock() {
      if (ensure()) startMusic();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      tone(880, 0.08, 'square', 0.08, 320);
    },
    hit() {
      noise(0.12, 0.16, 1200);
      tone(180, 0.1, 'sawtooth', 0.1, 60);
    },
    explode() {
      noise(0.35, 0.3, 900);
      tone(120, 0.3, 'sawtooth', 0.16, 40);
    },
    ember() {
      tone(1046, 0.12, 'sine', 0.12);
      window.setTimeout(() => tone(1568, 0.16, 'sine', 0.1), 60);
    },
    hurt() {
      tone(220, 0.3, 'sawtooth', 0.22, 55);
      noise(0.25, 0.2, 600);
    },
    dash() {
      noise(0.14, 0.1, 3200);
    },
    wave() {
      tone(NOTE.C4, 0.25, 'triangle', 0.14);
      window.setTimeout(() => tone(NOTE.G4, 0.25, 'triangle', 0.14), 140);
      window.setTimeout(() => tone(NOTE.C5, 0.4, 'triangle', 0.14), 280);
    },
    upgrade() {
      tone(NOTE.E4, 0.14, 'sine', 0.14);
      window.setTimeout(() => tone(NOTE.G4, 0.14, 'sine', 0.14), 90);
      window.setTimeout(() => tone(NOTE.C5, 0.22, 'sine', 0.14), 180);
    },
    gameOver() {
      tone(NOTE.A4, 0.4, 'triangle', 0.16, NOTE.E4);
      window.setTimeout(() => tone(NOTE.C4, 0.7, 'triangle', 0.16, NOTE.G4), 350);
    },
  };
}
