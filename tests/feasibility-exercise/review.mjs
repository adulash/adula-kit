import { chromium } from 'playwright'
const base = 'http://127.0.0.1:3395'
const results = []
const check = (id, name, ok, detail = '') => { results.push({ id, name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', id, name, detail) }
const b = await chromium.launch()
const english = async (p) => {
  const text = await p.evaluate(() => document.body.innerText)
  return [...new Set((text.match(/[A-Za-z][A-Za-z ]{3,}/g) || []).map((s) => s.trim()).filter((s) => !/example|REACT/.test(s)))]
}
async function session(email, password = 'password123') {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } })
  const p = await ctx.newPage()
  p.on('dialog', (d) => d.accept())
  await p.goto(base + '/login')
  await p.fill('input[name=email]', email)
  await p.fill('input[name=password]', password)
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'دخول' }).click()])
  await p.waitForTimeout(500)
  return { ctx, p }
}
const rows = async (p) => p.locator('tbody tr').allInnerTexts()
const shot = (p, n) => p.screenshot({ path: `review/${n}.png`, fullPage: true })

// 1. Wrong password
{ const { ctx, p } = await session('manager.north@example.test', 'wrong-pass')
  const eng = await english(p); await shot(p, '01-wrong-password')
  check(1, 'wrong password stays on login', p.url().endsWith('/login'))
  check(2, 'login error message is Arabic', !eng.some((s) => /Invalid/.test(s)), eng.join(' | '))
  await ctx.close() }

// Manager north
{ const { ctx, p } = await session('manager.north@example.test')
  check(3, 'manager signs in', p.url().includes('/customers') || !p.url().endsWith('/login'), p.url())
  check(4, 'html is RTL Arabic', (await p.evaluate(() => document.documentElement.dir + '/' + document.documentElement.lang)) === 'rtl/ar')
  await p.goto(base + '/customers'); let r = await rows(p)
  check(5, 'manager north sees only north customers (2)', r.length === 2 && !r.join().includes('الجنوب'), `${r.length} rows`)
  // create
  await p.goto(base + '/customers/create')
  await p.fill('#name', 'عميل المراجعة'); await p.fill('#email', 'review@example.test'); await p.fill('#phone', '0551112233')
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'حفظ' }).click()]); await p.waitForTimeout(500)
  await p.goto(base + '/customers'); r = await rows(p)
  check(6, 'create adds the customer', r.join().includes('عميل المراجعة'), `${r.length} rows`)
  // duplicate, different case irrelevant for Arabic; try exact
  await p.goto(base + '/customers/create'); await p.fill('#name', 'عميل المراجعة')
  await p.getByRole('button', { name: 'حفظ' }).click(); await p.waitForTimeout(800); await shot(p, '02-duplicate')
  const dupText = await p.evaluate(() => document.body.innerText)
  check(7, 'duplicate name refused with an Arabic message', p.url().includes('/create') && /مستخدم|موجود|مسجل/.test(dupText), (dupText.match(/.*(مستخدم|موجود|مسجل).*/) || [''])[0])
  // server-side required (bypass native required)
  await p.goto(base + '/customers/create'); await p.evaluate(() => document.querySelectorAll('[required]').forEach((e) => e.removeAttribute('required')))
  await p.getByRole('button', { name: 'حفظ' }).click(); await p.waitForTimeout(800); await shot(p, '03-server-required')
  const reqText = await p.evaluate(() => document.body.innerText)
  check(8, 'server requires name with an Arabic message', /مطلوب|إلزامي|يجب/.test(reqText), (reqText.match(/.*(مطلوب|إلزامي|يجب).*/) || [''])[0])
  // invalid email
  await p.goto(base + '/customers/create'); await p.fill('#name', 'بريد خاطئ'); await p.evaluate(() => { const e = document.querySelector('#email'); e.type = 'text' }); await p.fill('#email', 'not-an-email')
  await p.getByRole('button', { name: 'حفظ' }).click(); await p.waitForTimeout(800)
  const emailText = await p.evaluate(() => document.body.innerText)
  check(9, 'invalid email refused', p.url().includes('/create') && /بريد/.test(emailText), (emailText.match(/.*بريد.*صالح.*|.*البريد.*/g) || []).slice(-1)[0] ?? '')
  // search
  await p.goto(base + '/customers'); await p.fill('input[type=search], input[name=search], input[placeholder*="ابحث"]', 'النور')
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'بحث' }).click()]); await p.waitForTimeout(500)
  r = await rows(p); check(10, 'search filters by name', r.length === 1 && r[0].includes('النور'), `${r.length} rows`)
  // sort
  await p.goto(base + '/customers'); await p.getByRole('button', { name: /الاسم/ }).click(); await p.waitForTimeout(700)
  const first = (await rows(p))[0]; await p.getByRole('button', { name: /الاسم/ }).click(); await p.waitForTimeout(700)
  const firstAgain = (await rows(p))[0]; check(11, 'sorting by name reverses the order', first !== firstAgain, `${first?.split('\t')[0]} -> ${firstAgain?.split('\t')[0]}`)
  // edit
  const id = await p.evaluate(() => [...document.querySelectorAll('tbody a')].find((a) => a.textContent.includes('عميل المراجعة'))?.getAttribute('href'))
  await p.goto(base + id + '/edit'); await p.fill('#phone', '0559990000')
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'حفظ' }).click()]); await p.waitForTimeout(500)
  await p.goto(base + id); const showText = await p.evaluate(() => document.body.innerText); await shot(p, '04-show-after-edit')
  check(12, 'edit saves', showText.includes('0559990000'))
  // delete (soft)
  await p.getByRole('button', { name: 'حذف' }).click(); await p.waitForTimeout(800)
  await p.goto(base + '/customers'); r = await rows(p)
  check(13, 'delete removes from list', !r.join().includes('عميل المراجعة'))
  const res = await p.goto(base + id); check(14, 'deleted customer page is not found', res.status() === 404, `status ${res.status()}`)
  // name reusable after soft delete
  await p.goto(base + '/customers/create'); await p.fill('#name', 'عميل المراجعة')
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'حفظ' }).click()]); await p.waitForTimeout(500)
  await p.goto(base + '/customers'); r = await rows(p); check(15, 'deleted name can be reused', r.join().includes('عميل المراجعة'))
  // cross-unit
  const cross = await p.goto(base + '/customers/3'); check(16, 'north manager cannot open a south customer', [403, 404].includes(cross.status()), `status ${cross.status()}`)
  const crossEdit = await p.goto(base + '/customers/3/edit'); check(17, 'north manager cannot edit a south customer', [403, 404].includes(crossEdit.status()), `status ${crossEdit.status()}`)
  // direct PUT/DELETE on south record via fetch with CSRF
  const put = await p.evaluate(async () => { const t = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || ''); const r = await fetch('/customers/3', { method: 'DELETE', headers: { 'X-XSRF-TOKEN': t, 'X-Inertia': 'true', Accept: 'text/html' } }); return r.status })
  check(18, 'north manager cannot delete a south customer by request', [403, 404].includes(put), `status ${put}`)
  const eng = new Set(); for (const u of ['/customers', '/customers/create', '/customers/1']) { await p.goto(base + u); (await english(p)).forEach((s) => eng.add(s)) }
  check(19, 'no English interface text on manager pages', eng.size === 0, [...eng].join(' | '))
  await ctx.close() }

// Employee north
{ const { ctx, p } = await session('employee.north@example.test')
  await p.goto(base + '/customers'); const r = await rows(p); await shot(p, '05-employee-list')
  check(20, 'employee sees own unit only', r.length === 3 && !r.join().includes('الجنوب'), `${r.length} rows`)
  check(21, 'employee has no add button', (await p.getByText('إضافة عميل').count()) === 0)
  await p.goto(base + '/customers/1'); check(22, 'employee detail has no edit/delete', (await p.getByRole('button', { name: 'حذف' }).count()) + (await p.getByText('تعديل', { exact: true }).count()) === 0)
  const c = await p.goto(base + '/customers/create'); check(23, 'employee create page refused', [403, 404].includes(c.status()), `status ${c.status()}`)
  const e = await p.goto(base + '/customers/1/edit'); check(24, 'employee edit page refused', [403, 404].includes(e.status()), `status ${e.status()}`)
  await p.goto(base + '/customers')
  const post = await p.evaluate(async () => { const t = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || ''); const r = await fetch('/customers', { method: 'POST', headers: { 'X-XSRF-TOKEN': t, 'Content-Type': 'application/json', 'X-Inertia': 'true' }, body: JSON.stringify({ name: 'تسلل' }) }); return r.status })
  check(25, 'employee create request refused', post === 403, `status ${post}`)
  await ctx.close() }

// Manager south
{ const { ctx, p } = await session('manager.south@example.test')
  await p.goto(base + '/customers'); const r = await rows(p)
  check(26, 'south manager sees only south customers', r.length === 1 && r[0].includes('الجنوب'), `${r.length} rows`)
  const x = await p.goto(base + '/customers/1'); check(27, 'south manager cannot open a north customer', [403, 404].includes(x.status()), `status ${x.status()}`)
  await ctx.close() }

// Mobile width
{ const { ctx, p } = await session('manager.north@example.test')
  await p.setViewportSize({ width: 390, height: 800 }); await p.goto(base + '/customers'); await shot(p, '06-mobile')
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check(28, 'no horizontal page overflow at phone width', !overflow)
  await ctx.close() }
await b.close()
const fs = await import('node:fs'); fs.writeFileSync('review/results.json', JSON.stringify(results, null, 2))
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`)
