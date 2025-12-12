import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests critical authentication flows
 */

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Grade Math/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
  });

  test('should navigate from login to signup', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/signup/);
  });

  test('should navigate from signup to login', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('should show validation errors on empty login submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Form should show validation errors
    await expect(page.getByText(/email/i)).toBeVisible();
  });

  test('should show forgot password link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /forgot.*password/i })).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot.*password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});
