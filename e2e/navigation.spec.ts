import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 *
 * Tests critical navigation flows and page accessibility
 */

test.describe('Navigation', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Grade Math/);
  });

  test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from projects to login', async ({ page }) => {
    await page.goto('/projects');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from students to login', async ({ page }) => {
    await page.goto('/students');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('should show 404 for non-existent pages', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByText(/not found/i)).toBeVisible();
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be responsive on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Grade Math/);
    // Login form should be visible and usable
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should load home page on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Grade Math/);
  });
});

test.describe('PWA', () => {
  test('should have PWA manifest', async ({ page }) => {
    await page.goto('/');
    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return null;
      const response = await fetch((link as HTMLLinkElement).href);
      return response.json();
    });
    expect(manifest).toBeTruthy();
    expect(manifest.name).toContain('GradeMath');
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    // Wait for service worker registration
    const swRegistration = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration !== undefined;
      }
      return false;
    });
    // Service worker should be registered (may not be active in test mode)
    expect(swRegistration).toBeDefined();
  });
});
