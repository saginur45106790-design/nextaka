import { test,expect } from '@playwright/test';
// Requires a real TEST ENVIRONMENT server; uses no production mock API.
test('protected dashboard redirects a real anonymous session',async({page})=>{
 test.skip(!process.env.E2E_API_READY,'Start the test API and set E2E_API_READY=true.');
 await page.goto('/dashboard');await expect(page).toHaveURL(/\/login$/);
});
