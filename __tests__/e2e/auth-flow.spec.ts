import { test, expect } from '@playwright/test';

const TEST_USER_EMAIL = 'test-shopvalue@example.com';
const TEST_USER_PASSWORD = 'TestPassword123!';
const TEST_USER_FIRSTNAME = 'Test';
const TEST_USER_LASTNAME = 'User';

test.describe('ShopValue Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the homepage
    await page.goto('/');
  });

  test('should display sign-in button for unauthenticated users', async ({ page }) => {
    // Check that the sign-in button is visible
    await expect(page.getByRole('button', { name: /conectare/i })).toBeVisible();
    
    // Check that dashboard link is not visible
    await expect(page.getByRole('link', { name: /dashboard/i })).not.toBeVisible();
  });

  test('should navigate to sign-in page', async ({ page }) => {
    // Click the sign-in button
    await page.getByRole('button', { name: /conectare/i }).click();
    
    // Should be on sign-in page or modal
    await expect(page).toHaveURL(/.*sign-in.*/);
    
    // Check for sign-in form elements
    await expect(page.getByRole('heading', { name: /conectează-te/i })).toBeVisible();
  });

  test('should navigate to sign-up page from sign-in page', async ({ page }) => {
    // Navigate to sign-in
    await page.goto('/sign-in');
    
    // Click sign-up link
    await page.getByRole('link', { name: /înregistrează-te aici/i }).click();
    
    // Should be on sign-up page
    await expect(page).toHaveURL(/.*sign-up.*/);
    await expect(page.getByRole('heading', { name: /creează cont nou/i })).toBeVisible();
  });

  test('should display validation errors for invalid sign-in', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Try to sign in with invalid credentials
    await page.fill('input[name="identifier"]', 'invalid@email.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should display error message
    await expect(page.locator('.cl-formFieldError, .cl-globalError')).toBeVisible();
  });

  test('should handle sign-up flow with validation', async ({ page }) => {
    await page.goto('/sign-up');
    
    // Test empty form validation
    await page.click('button[type="submit"]');
    await expect(page.locator('.cl-formFieldError')).toBeVisible();
    
    // Test invalid email format
    await page.fill('input[name="emailAddress"]', 'invalid-email');
    await page.fill('input[name="firstName"]', TEST_USER_FIRSTNAME);
    await page.fill('input[name="lastName"]', TEST_USER_LASTNAME);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Should show email format error
    await expect(page.locator('.cl-formFieldError')).toBeVisible();
  });

  test('should protect dashboard route for unauthenticated users', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/.*sign-in.*/);
  });

  test('should display proper styling and branding', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Check for ShopValue branding
    await expect(page.getByText(/shopvalue/i)).toBeVisible();
    
    // Check for Romanian localization
    await expect(page.getByText(/conectează-te/i)).toBeVisible();
    await expect(page.getByText(/pentru a-ți urmări produsele/i)).toBeVisible();
    
    // Check styling classes are applied
    const signInCard = page.locator('.cl-card, .shadow-2xl');
    await expect(signInCard).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/sign-in');
    
    // Sign-in form should still be visible and usable
    await expect(page.getByRole('heading', { name: /conectează-te/i })).toBeVisible();
    
    // Check that form is not cut off
    const signInForm = page.locator('form, .cl-rootBox');
    await expect(signInForm).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: /conectează-te/i })).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: /conectează-te/i })).toBeVisible();
  });

  test('should handle dark mode correctly', async ({ page }) => {
    // Enable dark mode if available
    await page.goto('/');
    
    // Look for theme toggle
    const themeToggle = page.locator('[data-testid="theme-toggle"], .theme-toggle, button:has-text("🌙"), button:has-text("☀️")');
    
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
    }
    
    // Navigate to sign-in
    await page.goto('/sign-in');
    
    // Check that dark mode classes are applied
    const body = page.locator('body');
    const hasDarkClass = await body.evaluate(el => 
      el.classList.contains('dark') || 
      el.classList.contains('theme-dark') ||
      getComputedStyle(el).backgroundColor === 'rgb(17, 24, 39)' // dark gray
    );
    
    // If dark mode is supported, verify elements are styled correctly
    if (hasDarkClass) {
      await expect(page.locator('.dark\\:bg-gray-900, .bg-gray-900')).toBeVisible();
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);
    
    await page.goto('/sign-in');
    
    // Try to submit form while offline
    await page.fill('input[name="identifier"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Should handle the error gracefully (not crash)
    // The exact error handling depends on Clerk's implementation
    await page.waitForTimeout(2000);
    
    // Go back online
    await page.context().setOffline(false);
  });

  test('should maintain navigation accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Check keyboard navigation
    await page.keyboard.press('Tab');
    
    // Should be able to navigate to sign-in button
    const signInButton = page.getByRole('button', { name: /conectare/i });
    await expect(signInButton).toBeFocused();
    
    // Enter should activate the button
    await page.keyboard.press('Enter');
    
    // Should navigate to sign-in
    await expect(page).toHaveURL(/.*sign-in.*/);
  });

  test('should display correct meta information', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Check page title
    await expect(page).toHaveTitle(/shopvalue/i);
    
    // Check meta description (if present)
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count() > 0) {
      const content = await metaDescription.getAttribute('content');
      expect(content).toContain('ShopValue');
    }
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    
    // Navigate to sign-in
    await page.getByRole('button', { name: /conectare/i }).click();
    await expect(page).toHaveURL(/.*sign-in.*/);
    
    // Navigate to sign-up
    await page.getByRole('link', { name: /înregistrează-te aici/i }).click();
    await expect(page).toHaveURL(/.*sign-up.*/);
    
    // Use browser back button
    await page.goBack();
    await expect(page).toHaveURL(/.*sign-in.*/);
    
    // Use browser forward button
    await page.goForward();
    await expect(page).toHaveURL(/.*sign-up.*/);
  });
});

// Additional test for webhook handling (requires test webhook endpoint)
test.describe('Webhook Integration', () => {
  test('should have webhook endpoint accessible', async ({ request }) => {
    // Test that webhook endpoint exists and returns proper error for missing signature
    const response = await request.post('/api/webhooks/clerk', {
      data: { test: 'data' },
      headers: {
        'content-type': 'application/json'
      }
    });
    
    // Should return 400 for missing webhook signature
    expect(response.status()).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toContain('Missing required headers');
  });
});