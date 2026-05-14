/**
 * Partagé entre LeftView et NewsTicker.
 */
export function useDelayFormat() {
  function fmtDelay(min: number): string {
    if (min === 0) return "À l'heure"
    const abs = Math.abs(min)
    const m = Math.floor(abs)
    const s = Math.round((abs - m) * 60)
    const parts = m > 0 ? `${m}min` : ''
    const secPart = s > 0 ? `${s}s` : ''
    const formatted = [parts, secPart].filter(Boolean).join(' ')
    if (min < 0) return `${formatted} d'avance`
    return `+${formatted} de retard`
  }

  function delayColor(min: number): { light: string; dark: string } {
    if (min <= 0) return { light: '#16a34a', dark: '#4ade80' }
    if (min <= 3) return { light: '#d97706', dark: '#fbbf24' }
    return { light: '#dc2626', dark: '#f87171' }
  }

  function delayBadgeStyle(min: number): Record<string, string> {
    if (min <= 0) return { background: '#16a34a', boxShadow: '0 2px 8px rgba(22,163,74,0.45)' }
    if (min <= 3) return { background: '#d97706', boxShadow: '0 2px 8px rgba(217,119,6,0.45)' }
    return { background: '#dc2626', boxShadow: '0 2px 8px rgba(220,38,38,0.45)' }
  }

  return { fmtDelay, delayColor, delayBadgeStyle }
}
