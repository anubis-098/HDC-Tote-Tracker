import { test, expect } from '@playwright/test';

test('mobile landing page and real API readiness', async ({ page, request }, testInfo) => {
  const response = await request.get('/api/ready');
  expect(response.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ทุกกล่อง ติดตามได้' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เริ่มติดตาม Tote' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('entry-360.png'), fullPage: true });
});

test('scan, review, dispatch, return and reset on handheld', async ({ page }, testInfo) => {
  // UI contract fixture. Backend transitions/concurrency are tested independently against PostgreSQL.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const now = new Date().toISOString();
  const tote = {
    code: 'HDC12', status: 'READY', store_code: null as string | null, store_name: null as string | null,
    order_number: null as string | null,
    version: 0, updated_at: now, photos: [] as { id: string; slot: number; uploaded_at: string }[], history: [{ id: 'registered', action: 'REGISTER', store_code: null as string | null, store_name: null as string | null, order_number: null as string | null, worker_name: 'พนักงาน ทดสอบ', note: '', created_at: now }],
  };
  const transitions: Record<string, string> = { DISPATCH: 'AT_STORE', RETURN: 'RETURNED', RESET: 'READY' };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/worker/me' || path === '/api/actor/me') return route.fulfill({ json: { id: 'worker', name: 'พนักงาน ทดสอบ', role: 'worker' } });
    if (path === '/api/stores') return route.fulfill({ json: [{ memberships: [{group:'HLE',category:'Direct'}], code: 'S001', name: 'Store ทดสอบ', active: true }] });
    if (path.endsWith('/transitions')) {
      const body = route.request().postDataJSON();
      tote.status = transitions[body.action]; tote.version++;
      if (body.action === 'DISPATCH') { expect(body.order_number).toBe('ORDER-001'); expect(body.truck_registration).toBeUndefined(); tote.store_code = 'S001'; tote.store_name = 'Store ทดสอบ'; tote.order_number = body.order_number; }
      tote.history.unshift({ id: String(tote.version), action: body.action, store_code: tote.store_code, store_name: tote.store_name, order_number: tote.order_number, worker_name: 'พนักงาน ทดสอบ', note: body.note, created_at: now });
      if (body.action === 'RESET') { tote.store_code = null; tote.store_name = null; tote.order_number = null; }
      return route.fulfill({ json: tote });
    }
    if (path === '/api/totes/HDC12/photos/1') {
      if (route.request().method() === 'PUT') { tote.photos = [{ id: 'photo1', slot: 1, uploaded_at: now }]; return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#c9e3f2"/><rect x="80" y="100" width="480" height="280" rx="16" fill="#006da8"/><text x="320" y="260" text-anchor="middle" fill="white" font-size="48">HDC12</text></svg>' });
    }
    if (path === '/api/totes/HDC12') return route.fulfill({ json: tote });
    return route.fulfill({ status: 404, json: { detail: 'not found' } });
  });
  await page.goto('/scan');
  const scan = page.getByLabel('QR Code / หมายเลข Tote');
  await expect(scan).toBeEnabled();
  await scan.fill('hdc12'); await scan.press('Enter');
  await expect(page.getByRole('heading', { name: 'HDC12' })).toBeVisible();
  const camera = page.getByRole('button', { name: 'ถ่ายภาพสินค้า แตะเพื่อเปิดกล้อง' });
  await expect(camera).toBeEnabled();
  await expect(page.locator('.photo-placeholder')).toHaveCount(6);
  await expect(scan).toHaveCSS('background-color', 'rgb(255, 244, 191)');
  await expect(page.getByLabel('หมายเหตุ (ไม่บังคับ)')).toHaveCSS('background-color', 'rgb(240, 242, 245)');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('capture', 'environment');
  await page.screenshot({ path: testInfo.outputPath('camera-ready-360.png'), fullPage: true });
  const chooser = page.waitForEvent('filechooser'); await camera.click();
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('.counter')).toHaveText('1 / 6');
  await page.getByRole('button', { name: 'ดูรูป 1', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'ดูและซูมภาพสินค้า' });
  await expect(viewer).toBeVisible();
  await expect(page.getByRole('button', { name: 'ซูมเข้า', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  await expect(page.getByLabel('ระดับการซูม')).toHaveText('150%');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  await expect(page.getByLabel('ระดับการซูม')).toHaveText('400%');
  await expect(page.getByRole('button', { name: 'ซูมเข้า', exact: true })).toBeDisabled();
  expect(await page.locator('.zoom-viewport').evaluate(element => element.scrollWidth > element.clientWidth)).toBeTruthy();
  const viewport = page.locator('.zoom-viewport');
  const bounds = (await viewport.boundingBox())!;
  const beforePan = await viewport.evaluate(element => element.scrollLeft);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2); await page.mouse.up();
  expect(await viewport.evaluate(element => element.scrollLeft)).toBeLessThan(beforePan);
  await page.screenshot({ path: testInfo.outputPath('zoom-360.png') });
  await page.getByRole('button', { name: 'คืนขนาดภาพ', exact: true }).click();
  await expect(page.getByLabel('ระดับการซูม')).toHaveText('100%');
  const touch = await page.context().newCDPSession(page);
  const x = bounds.x + bounds.width / 2; const y = bounds.y + bounds.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 1 }, { x: x + 25, y, id: 2 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 50, y, id: 1 }, { x: x + 50, y, id: 2 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByLabel('ระดับการซูม')).toHaveText('200%');
  await touch.detach();
  await page.getByRole('button', { name: 'ปิดรูป', exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await page.locator('.store-picker-trigger').click();
  await page.locator('.store-picker-search input').fill('S001');
  await page.locator('.store-picker-option').click();
  await expect(page.getByLabel('ทะเบียนรถ', { exact: true })).toHaveJSProperty('required', false);
  await expect(page.getByLabel('เลขออเดอร์', { exact: true })).toHaveJSProperty('required', true);
  await page.getByRole('button', { name: 'ส่งไป Store', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('กรุณากรอกเลขออเดอร์');
  await page.getByLabel('เลขออเดอร์', { exact: true }).fill('ORDER-001');
  await page.getByRole('button', { name: 'ส่งไป Store', exact: true }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'ตรวจสอบก่อนยืนยัน' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('S001 · Store ทดสอบ');
  await expect(page.getByRole('dialog')).toContainText('ORDER-001');
  await page.getByRole('button', { name: 'ยืนยันบันทึก' }).click();
  await expect(page.locator('.success[role="status"]')).toContainText('บันทึกแล้ว · ส่งไป Store');
  await expect(scan).toHaveValue('');
  await expect(scan).toBeFocused();
  await expect(page.getByRole('heading', { name: 'พร้อมรับการสแกน' })).toBeVisible();
  await expect(page.getByLabel('Store ปลายทาง')).toHaveCount(0);
  await expect(page).toHaveURL(/\/scan$/);
  await scan.fill('HDC12'); await scan.press('Enter');
  await expect(page.getByRole('heading', { name: 'HDC12' })).toBeVisible();
  await expect(page.locator('input[type="file"]').first()).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('scan-360.png'), fullPage: true });
  await page.getByRole('button', { name: 'รับ Tote กลับ', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันบันทึก' }).click();
  await expect(page.locator('.success[role="status"]')).toContainText('รับกลับแล้ว');
  await page.getByRole('button', { name: 'ล้างปลายทาง · พร้อมใช้ใหม่', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันบันทึก' }).click();
  await expect(page.locator('.success[role="status"]')).toContainText('พร้อมใช้งาน');
  await expect(page.locator('.destination')).toContainText('อยู่ที่ HDC');
  await expect(page.locator('.timeline')).toContainText('S001 · Store ทดสอบ');
  await expect(page.locator('.timeline li')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('operator suggestions appear after three characters and fill the name', async ({ page }) => {
  const searches: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/workers/suggestions') {
      searches.push(url.searchParams.get('q') || '');
      return route.fulfill({ json: [{ name: 'Somchai Warehouse' }] });
    }
    return route.fulfill({ status: 401, json: { detail: 'กรุณาเข้าสู่ระบบ' } });
  });
  await page.goto('/');
  const name = page.getByRole('combobox', { name: 'ชื่อ–นามสกุล' });
  await name.fill('So');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await name.fill('Som');
  await expect(page.getByRole('option', { name: 'Somchai Warehouse' })).toBeVisible();
  await name.press('ArrowDown'); await name.press('Enter');
  await expect(name).toHaveValue('Somchai Warehouse');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  expect(searches).toEqual(['Som']);
});

test('admin deletion requires the exact typed text for both Store and Tote', async ({ page }, testInfo) => {
  let stores = [{ code: 'S001', name: 'Store ทดสอบ', active: true }];
  let items = [{ code: 'HDC12', status: 'READY', store_code: null }];
  const deleted: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'DELETE') {
      deleted.push(path);
      expect(route.request().postDataJSON().confirmation).toBe(path.includes('/stores/') ? 'DELETE S001' : 'DELETE HDC12');
      if (path.includes('/stores/')) stores = []; else items = [];
      return route.fulfill({ json: { ok: true } });
    }
    if (path === '/api/admin/stores') return route.fulfill({ json: stores });
    if (path === '/api/totes') return route.fulfill({ json: { items, total: items.length, counts: {} } });
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/admin/stores');
  await page.getByRole('button', { name: 'ลบ Store S001', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ยืนยันลบ', exact: true })).toBeDisabled();
  await page.locator('#delete-confirmation').fill('DELETE S00');
  await expect(page.getByRole('button', { name: 'ยืนยันลบ', exact: true })).toBeDisabled();
  expect(deleted).toEqual([]);
  await page.locator('#delete-confirmation').fill('DELETE S001');
  await page.screenshot({ path: testInfo.outputPath('delete-popup-360.png') });
  await page.getByRole('button', { name: 'ยืนยันลบ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ลบ Store S001', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'ลบ Tote HDC12', exact: true }).click();
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  expect(deleted).toEqual(['/api/admin/stores/S001']);
  await page.getByRole('button', { name: 'ลบ Tote HDC12', exact: true }).click();
  await page.locator('#delete-confirmation').fill('DELETE HDC12');
  await page.getByRole('button', { name: 'ยืนยันลบ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ลบ Tote HDC12', exact: true })).toHaveCount(0);
  expect(deleted).toEqual(['/api/admin/stores/S001', '/api/admin/totes/HDC12']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('donut shows global counts and filters the Tote list', async ({ page }, testInfo) => {
  const requests: string[] = [];
  await page.route('**/api/totes?**', async route => {
    const url = new URL(route.request().url()); requests.push(url.searchParams.get('status') || '');
    return route.fulfill({ json: { items: [], total: 0, counts: { READY: 60, AT_STORE: 30, RETURNED: 10 } } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('img', { name: /Tote ทั้งหมด 100 กล่อง/ })).toBeVisible();
  await expect(page.locator('.donut-center strong')).toHaveText('100');
  await expect(page.locator('.legend-percent')).toHaveText(['60%', '30%', '10%']);
  const store = page.getByRole('button', { name: /ส่งไป Store 30/ });
  await store.click();
  await expect(store).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'สถานะ', exact: true })).toHaveValue('AT_STORE');
  await expect.poll(() => requests.at(-1)).toBe('AT_STORE');
  await expect(page.locator('.donut-center strong')).toHaveText('100');
  await store.click();
  await expect.poll(() => requests.at(-1)).toBe('');
  await page.screenshot({ path: testInfo.outputPath('donut-360.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('donut handles an empty database', async ({ page }) => {
  await page.route('**/api/totes?**', route => route.fulfill({ json: { items: [], total: 0, counts: {} } }));
  await page.goto('/dashboard');
  await expect(page.locator('.donut-center strong')).toHaveText('0');
  await expect(page.locator('.legend-percent')).toHaveText(['0%', '0%', '0%']);
  await expect(page.locator('.donut-caption')).toContainText('ยังไม่มี Tote');
  await expect(page.locator('.donut-segment')).toHaveCount(0);
});

test('failed dispatch retains the draft until the same request succeeds', async ({ page }) => {
  const now = new Date().toISOString();
  const tote = { code: 'HDC9', status: 'READY', store_code: null, store_name: null, version: 0, updated_at: now, photos: [], history: [] };
  const requests: unknown[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/worker/me' || path === '/api/actor/me') return route.fulfill({ json: { id: 'worker', name: 'พนักงาน ทดสอบ', role: 'worker' } });
    if (path === '/api/stores') return route.fulfill({ json: [{ memberships: [{group:'HLE',category:'Direct'}], code: 'S001', name: 'Store ทดสอบ', active: true }] });
    if (path.endsWith('/transitions')) {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) return route.fulfill({ status: 503, json: { detail: 'กรุณาลองใหม่' } });
      return route.fulfill({ json: { ...tote, status: 'AT_STORE', version: 1 } });
    }
    if (path === '/api/totes/HDC9') return route.fulfill({ json: tote });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/scan?code=HDC9');
  await page.locator('.store-picker-trigger').click();
  await page.locator('.store-picker-search input').fill('S001');
  await page.locator('.store-picker-option').click();
  await page.getByLabel("\u0e40\u0e25\u0e02\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c", {exact:true}).fill("ORDER-RETRY");
  await page.getByLabel('หมายเหตุ (ไม่บังคับ)').fill('รอบเช้า');
  await page.getByRole('button', { name: 'ส่งไป Store', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันบันทึก' }).click();
  await expect(page.getByRole('alert')).toHaveText('กรุณาลองใหม่');
  await expect(page.getByLabel('QR Code / หมายเลข Tote')).toHaveValue('HDC9');
  await expect(page.getByLabel('หมายเหตุ (ไม่บังคับ)')).toHaveValue('รอบเช้า');
  await page.getByRole('button', { name: 'ยืนยันบันทึก' }).click();
  await expect(page.getByLabel('QR Code / หมายเลข Tote')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'พร้อมรับการสแกน' })).toBeVisible();
  expect(requests[0]).toMatchObject({order_number:'ORDER-RETRY'}); expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1]);
});

test('scan guards a draft and blocks actions for an edited QR', async ({ page }) => {
  const now = new Date().toISOString();
  const requests: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; requests.push(path);
    if (path === '/api/worker/me' || path === '/api/actor/me') return route.fulfill({ json: { id: 'worker', name: 'พนักงาน', role: 'worker' } });
    if (path === '/api/stores') return route.fulfill({ json: [{ memberships: [{group:'HLE',category:'Direct'}], code: 'S001', name: 'Store ทดสอบ', active: true }] });
    if (path === '/api/totes/HDC9') return route.fulfill({ json: { code: 'HDC9', status: 'READY', version: 0, updated_at: now, photos: [], history: [] } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/scan?code=HDC9');
  await page.locator('.store-picker-trigger').click();
  await page.locator('.store-picker-search input').fill('S001');
  await page.locator('.store-picker-option').click();
  await page.getByLabel('หมายเหตุ (ไม่บังคับ)').fill('ยังไม่ส่ง');
  const scan = page.getByLabel('QR Code / หมายเลข Tote');
  await scan.fill('HDC10');
  await expect(page.getByRole('button', { name: 'ส่งไป Store', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'ถ่ายภาพสินค้า แตะเพื่อเปิดกล้อง' })).toBeDisabled();
  page.on('dialog', dialog => dialog.dismiss());
  await scan.press('Enter');
  await expect(page.getByLabel('หมายเหตุ (ไม่บังคับ)')).toHaveValue('ยังไม่ส่ง');
  expect(requests).not.toContain('/api/totes/HDC10');
  await page.getByRole('link', { name: 'ภาพรวม', exact: true }).click();
  await expect(page).toHaveURL(/\/scan\?code=HDC9$/);
  await page.getByText('วิธีใช้งาน · เริ่มตรงไหน?').click();
  await expect(page.locator('.usage-guide')).toContainText('ถ่ายรูปได้สูงสุด 6 รูป');
});

test('web serves security headers and fonts without external requests', async ({ page, request }) => {
  const external: string[] = [];
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(page.url() || 'http://localhost:8081').origin && !request.url().startsWith('data:')) external.push(request.url()); });
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(home.headers()['x-frame-options']).toBe('DENY');
  expect((await request.get('/api/ready')).headers()['cache-control']).toBe('no-store');
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const script = await page.locator('script[type="module"]').getAttribute('src');
  const asset = await request.get(script!);
  expect(asset.headers()['cache-control']).toContain('immutable');
  expect(asset.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(external.filter(url => !url.startsWith('http://localhost:8081/'))).toEqual([]);
  await page.context().setOffline(true);
  await expect(page.locator('.offline-banner')).toContainText('ขาดการเชื่อมต่อเครือข่าย');
  await page.context().setOffline(false);
  await expect(page.locator('.offline-banner')).toHaveCount(0);
});
