// TIDECHART DUEL — WebAudio sounds, all synthesised in code, no audio
// files: a card snap, a low mill rumble when cards are milled off a deck, a
// tide chime when the tide flips, a win fanfare and a loss sting.
export function createAudio() {
  let context = null;
  let master = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  return {
    /** Call on the first key press so the browser unlocks audio. */
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume(); },
    /** A card snapping onto the table. */
    play() {
      tone(520, 0.08, 'triangle', 0.35);
      tone(180, 0.1, 'sine', 0.25, 0.02);
    },
    /** Cards milling off a deck — a low wash. */
    mill() {
      tone(160, 0.25, 'sawtooth', 0.12);
      tone(110, 0.3, 'sawtooth', 0.12, 0.08);
    },
    /** The tide flips. */
    tide() {
      tone(660, 0.15, 'sine', 0.25);
      tone(880, 0.2, 'sine', 0.22, 0.1);
    },
    /** The rival deck ran dry. */
    win() {
      [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.28, 'triangle', 0.3, index * 0.12));
    },
    /** Your deck ran dry. */
    lose() {
      tone(220, 0.3, 'sawtooth', 0.25);
      tone(147, 0.5, 'sawtooth', 0.25, 0.22);
    },
  };
}
