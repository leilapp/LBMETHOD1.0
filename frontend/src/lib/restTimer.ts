/**
 * Aviso al terminar el descanso: vibración (si el teléfono lo permite) y un tono corto.
 * El sonido se prepara en el mismo toque que inicia el descanso, porque los navegadores solo permiten sonar
 * después de una acción de la persona.
 */
let audio: AudioContext | null = null

export function primeRestSound() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audio ??= new Ctor()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

export function restFinishedAlert() {
  try {
    navigator.vibrate?.([300, 150, 300])
  } catch {
    /* sin vibración */
  }
  if (!audio) return
  try {
    const start = audio.currentTime
    for (const [offset, freq] of [
      [0, 880],
      [0.25, 1175],
    ] as const) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2)
      osc.connect(gain).connect(audio.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.22)
    }
  } catch {
    /* sin sonido */
  }
}

/** «1:05» a partir de segundos. */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
