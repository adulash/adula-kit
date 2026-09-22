import type { CalendarSystem, CalendarPreference } from '@adula/kit'

const dayMs = 86400000
const hijri = new Intl.DateTimeFormat('en-u-nu-latn', {
  calendar: 'islamic-umalqura',
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function calendarInput(iso: string, calendar: CalendarSystem): string {
  if (!iso) return ''
  if (calendar === 'gregory') return iso.slice(0, 10)
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(hijri.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year.padStart(4, '0')}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`
}

/** Invert the platform's Umm al-Qura calendar; never approximate lunar months. */
export function calendarIso(raw: string, calendar: CalendarSystem): string {
  const value = raw
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim()
  if (!value) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('أدخل التاريخ بصيغة سنة-شهر-يوم')
  if (calendar === 'gregory') {
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new Error('التاريخ الميلادي غير صالح')
    return value
  }
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 30)
    throw new Error('اختر تاريخ أم القرى بين عامي 1300 و1600 هـ')
  let low = Math.floor(Date.UTC(1882, 0, 1) / dayMs)
  let high = Math.floor(Date.UTC(2175, 11, 31) / dayMs)
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const iso = new Date(middle * dayMs).toISOString().slice(0, 10)
    const candidate = calendarInput(iso, calendar)
    if (candidate === value) return iso
    if (candidate < value) low = middle + 1
    else high = middle - 1
  }
  throw new Error('هذا اليوم غير موجود في تقويم أم القرى')
}

export function calendarDisplay(
  value: unknown,
  calendar: CalendarPreference,
  withTime = false
): string {
  if (!value) return '—'
  if (calendar === 'both')
    return `${calendarDisplay(value, 'gregory', withTime)} · ${calendarDisplay(value, 'islamic-umalqura', withTime)}`
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('ar-u-nu-latn', {
    calendar,
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : { timeZone: 'UTC' }),
  }).format(date)
}
