import { test,expect } from '@playwright/test';
test('public page has no false balances and fits narrow viewports',async({page})=>{
 await page.goto('/');await expect(page.locator('h1')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Change language'}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByText('No guaranteed returns',{exact:true})).toBeVisible();
 await page.goto('/legal/risk');await expect(page.getByRole('heading',{name:'Financial risk disclosure',exact:true})).toBeVisible();
});
test('login page clearly disables unconfigured CAPTCHA',async({page})=>{
 await page.goto('/login');await expect(page.locator('input[name="password"]')).toHaveAttribute('type','password');
 await expect(page.locator('button[type="submit"]')).toBeDisabled();
});
