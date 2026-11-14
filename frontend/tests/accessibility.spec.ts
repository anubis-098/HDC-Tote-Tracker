import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('main handheld screens have no serious accessibility violations', async ({ page }) => {
  const now = new Date().toISOString();
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/worker/me') return route.fulfill({ json: { id: 'worker', name: 'พนักงาน ทดสอบ', role: 'worker' } });
    if (path === '/api/stores' || path === '/api/admin/stores') return route.fulfill({ json: [{ code: 'S001', name: 'Store ทดสอบ', active: true }] });
    if (path === '/api/totes/HDC1') return route.fulfill({ json: { code: 'HDC1', status: 'READY', version: 0, updated_at: now, photos: [], history: [] } });
    if (path === '/api/totes') return route.fulfill({ json: { items: [], total: 0, counts: { READY: 6, AT_STORE: 3, RETURNED: 1 } } });
    if (path === '/api/workers/suggestions') return route.fulfill({ json: [] });
    return route.fulfill({ status: 401, json: {} });
  });
  for (const path of ['/', '/scan?code=HDC1', '/dashboard', '/admin/stores', '/admin/login']) {
    await page.goto(path);
    if (path.startsWith('/scan')) await expect(page.getByRole('heading', { name: 'HDC1' })).toBeVisible();
    if (path === '/admin/stores') await expect(page.getByRole('button', { name: 'ลบ Store S001' })).toBeVisible();
    if (path === '/dashboard') await expect(page.locator('.donut-center strong')).toHaveText('10');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const failures = audit.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
    expect.soft(failures.map(item => ({ id: item.id, description: item.description, nodes: item.nodes.map(node => node.target) })), path).toEqual([]);
  }
});
