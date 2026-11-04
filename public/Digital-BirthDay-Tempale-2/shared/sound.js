/* ============================================================
   Little sounds, made in the browser (no audio files):
   page flips, pops, chimes – and a music-box "Happy Birthday"
   (the melody is in the public domain).
   ============================================================ */
window.SOUND = (() => {
  let ctx = null, master = null, musicGain = null, musicOn = false, musicTimer = null;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, t0, dur, { type = "sine", gain = 0.12, to = null, out = null } = {}) {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(t0, dur, from, to, gain) {
    const a = ac();
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf;
    f.type = "bandpass"; f.Q.value = 0.9;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // a soft music-box note: sine with a quiet octave on top
  function bell(freq, t0, dur, out) {
    tone(freq, t0, dur, { gain: 0.16, out });
    tone(freq * 2, t0, dur * 0.6, { gain: 0.04, out });
    tone(freq * 3, t0, dur * 0.25, { gain: 0.015, type: "triangle", out });
  }

  const N = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
  const SONG = [
    ["G4", .75], ["G4", .25], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
    ["G4", .75], ["G4", .25], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
    ["G4", .75], ["G4", .25], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 2],
    ["F5", .75], ["F5", .25], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 3],
  ];
  const BEAT = 0.42;

  function playSong() {
    const a = ac();
    let t = a.currentTime + 0.1;
    for (const [n, b] of SONG) { bell(N[n], t, Math.max(0.6, b * BEAT * 1.6), musicGain); t += b * BEAT; }
    const total = SONG.reduce((s, [, b]) => s + b, 0) * BEAT;
    musicTimer = setTimeout(() => { if (musicOn) playSong(); }, (total + 2.2) * 1000);
  }

  const safe = fn => (...args) => { try { fn(...args); } catch (e) { /* sound is optional */ } };
  return {
    unlock: safe(() => ac()),
    flip: safe(() => { const t = ac().currentTime; noise(t, 0.38, 2600, 500, 0.09); }),
    pop: safe(() => { const t = ac().currentTime; tone(520, t, 0.14, { to: 900, gain: 0.1 }); }),
    popBig: safe(() => { const t = ac().currentTime; noise(t, 0.12, 1800, 900, 0.22); tone(300, t, 0.1, { to: 120, gain: 0.1 }); }),
    tick: safe(() => { const t = ac().currentTime; tone(1400, t, 0.06, { type: "triangle", gain: 0.05 }); }),
    boing: safe(() => { const t = ac().currentTime; tone(180, t, 0.3, { to: 520, gain: 0.1, type: "triangle" }); }),
    chime: safe(() => { const t = ac().currentTime; [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, t + i * 0.08, 0.7)); }),
    blow: safe(() => { const t = ac().currentTime; noise(t, 0.7, 900, 250, 0.14); }),
    get musicOn() { return musicOn; },
    toggleMusic: safe(() => {
      musicOn = !musicOn;
      clearTimeout(musicTimer);
      if (musicOn) playSong();
      else if (musicGain) {
        // fade the music box out and start a fresh channel for next time
        const a = ac(), old = musicGain;
        old.gain.setTargetAtTime(0, a.currentTime, 0.15);
        setTimeout(() => old.disconnect(), 800);
        musicGain = a.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
      }
    }),
  };
})();
