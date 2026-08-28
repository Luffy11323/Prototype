import { test, expect } from '@playwright/test';

test.describe('Distributor Order Tracker MVP Flow', () => {
  
  test('should load the login page and show credentials helper', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h2')).toContainText('Order Tracker MVP');
    await expect(page.locator('text=demo@distributor.pk')).toBeVisible();
  });

  test('should log in successfully with valid credentials and redirect to dashboard', async ({ page }) => {
    // Note: This relies on Supabase credentials being configured in the environment,
    // otherwise the backend call will fail. We test the interface interaction.
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@distributor.pk');
    await page.fill('input[type="password"]', 'password123');
    
    // Tap sign in
    await page.click('button[type="submit"]');
    
    // We expect redirect to dashboard (either success or session fail depending on credentials)
    // For pure E2E test in CI, we assert the destination URL starts with dashboard or login on error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/dashboard');
  });

  test('should display dashboard tabs and search bar', async ({ page }) => {
    // Assuming logged-in session exists
    await page.goto('/dashboard');
    
    // Check if the search box is present
    await expect(page.locator('input[placeholder*="Search by customer"]')).toBeVisible();
    
    // Check if status tabs are visible
    await expect(page.locator('button:has-text("all")')).toBeVisible();
    await expect(page.locator('button:has-text("pending")')).toBeVisible();
  });

  test('should navigate to new order form and allow inputs', async ({ page }) => {
    await page.goto('/orders/new');
    
    // Check if header is present
    await expect(page.locator('h1')).toContainText('Log New Order');
    
    // Type customer search
    await page.fill('input[placeholder*="Type shop name"]', 'Test customer');
    
    // Should be able to toggle to new customer mode
    await page.click('text=Add "Test customer" Inline');
    await expect(page.locator('input[placeholder*="e.g. +92"]')).toBeVisible();
    
    // Type item details
    await page.fill('input[placeholder*="e.g. Tapal Tea"]', 'Tapal Danedar 475g');
    await page.fill('input[type="number"]', '15');
    
    // Should be able to add an item row
    await page.click('text=Add Another Item Row');
    
    // Check if we now have 2 item name fields
    const inputs = page.locator('input[placeholder*="e.g. Tapal Tea"]');
    expect(await inputs.count()).toBe(2);
  });
});
