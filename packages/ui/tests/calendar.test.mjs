import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarInput, calendarIso, calendarDisplay } from '../registry/ui/calendar_date.ts'

test('Umm al-Qura conversion matches a known civil date and supports Arabic numerals', () => {
  assert.equal(calendarInput('2017-10-14', 'islamic-umalqura'), '1439-01-24')
  assert.equal(calendarIso('١٤٣٩-٠١-٢٤', 'islamic-umalqura'), '2017-10-14')
  assert.equal(calendarIso('۱۴۳۹-۰۱-۲۴', 'islamic-umalqura'), '2017-10-14')
})
test('date conversion roundtrips without time-zone shifts across calendar bounds and leap dates', () => {
  for (const raw of ['1300-01-01', '1439-01-24', '1447-09-01', '1600-12-29']) {
    const iso = calendarIso(raw, 'islamic-umalqura')
    assert.equal(calendarInput(iso, 'islamic-umalqura'), raw)
  }
  for (const iso of ['2000-02-29', '2024-02-29', '2026-09-19'])
    assert.equal(calendarIso(calendarInput(iso, 'islamic-umalqura'), 'islamic-umalqura'), iso)
})
test('invalid civil dates and nonexistent lunar days are rejected', () => {
  for (const raw of ['2025-02-29', '2026-13-01', '2026-04-31', '25-1-1'])
    assert.throws(() => calendarIso(raw, 'gregory'))
  for (const raw of ['1299-12-29', '1601-01-01', '1447-13-01', '1447-09-31', '1447-00-01'])
    assert.throws(() => calendarIso(raw, 'islamic-umalqura'))
  let shortMonths = 0
  for (let month = 1; month <= 12; month++) {
    try {
      calendarIso(`1447-${String(month).padStart(2, '0')}-30`, 'islamic-umalqura')
    } catch {
      shortMonths++
    }
  }
  assert.ok(shortMonths >= 5 && shortMonths <= 7)
})
test('both display mode presents the same date in both calendars and leaves empty values empty', () => {
  const value = '2017-10-14'
  assert.equal(
    calendarDisplay(value, 'both'),
    `${calendarDisplay(value, 'gregory')} · ${calendarDisplay(value, 'islamic-umalqura')}`
  )
  assert.match(calendarDisplay(value, 'both'), /2017/)
  assert.match(calendarDisplay(value, 'both'), /1439/)
  assert.equal(calendarDisplay(null, 'both'), '—')
  assert.equal(calendarIso('', 'islamic-umalqura'), '')
})
test('Arabic display strings carry no bidi marks that reorder digits inside isolated spans', () => {
  for (const calendar of ['gregory', 'islamic-umalqura', 'both']) {
    for (const withTime of [false, true]) {
      const text = calendarDisplay('2026-12-31T09:30:00Z', calendar, withTime)
      assert.doesNotMatch(text, /[‎‏؜]/, `${calendar} withTime=${withTime}`)
    }
  }
  assert.equal(calendarDisplay('2026-12-31', 'gregory'), '31/12/2026')
})
