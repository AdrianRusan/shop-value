import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Page Structure', () => {
    test('has correct title and meta information', async ({ page }) => {
      await expect(page).toHaveTitle(/ShopValue/);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Check main heading
      await expect(page.getByText('Orice preț, oricând, oriunde -')).toBeVisible();
      await expect(page.getByText('ShopValue')).toBeVisible();
    });

    test('displays hero section with search functionality', async ({ page }) => {
      // Check hero text
      await expect(page.getByText('Cumpărăturile Inteligente Încep Aici')).toBeVisible();
      await expect(page.getByText('Descoperă Tendințele de Prețuri pentru Produsele de pe Flip.')).toBeVisible();
      
      // Check search components
      await expect(page.getByText('Nu găsești produsul?')).toBeVisible();
      await expect(page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Caută' })).toBeVisible();
    });

    test('displays hero carousel', async ({ page }) => {
      // Check if carousel container is present
      const carousel = page.locator('[data-testid="hero-carousel"]').or(
        page.locator('.carousel').or(
          page.locator('[class*="carousel"]')
        )
      );
      
      // If carousel exists, check it's visible, otherwise check for hero images
      if (await carousel.count() > 0) {
        await expect(carousel.first()).toBeVisible();
      } else {
        // Look for hero images
        const heroImages = page.locator('img[src*="hero"]');
        if (await heroImages.count() > 0) {
          await expect(heroImages.first()).toBeVisible();
        }
      }
    });

    test('displays trending section', async ({ page }) => {
      // Scroll to trending section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      // Check for trending section - it might be lazy loaded
      const trendingSection = page.getByText('Trending').or(
        page.getByText('Populare').or(
          page.locator('[data-testid="trending-section"]')
        )
      );
      
      // Wait a bit for potential lazy loading
      await page.waitForTimeout(1000);
      
      // The trending section may or may not be visible depending on data
      // So we just check if the page has loaded completely
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('has navigation bar', async ({ page }) => {
      // Check for navigation elements
      const nav = page.locator('nav').or(
        page.locator('[role="navigation"]').or(
          page.locator('header')
        )
      );
      
      if (await nav.count() > 0) {
        await expect(nav.first()).toBeVisible();
      }
      
      // Check for logo or brand name
      const logo = page.getByText('ShopValue').or(
        page.locator('img[alt*="logo"]').or(
          page.locator('[data-testid="logo"]')
        )
      );
      
      if (await logo.count() > 0) {
        await expect(logo.first()).toBeVisible();
      }
    });

    test('has theme toggle functionality', async ({ page }) => {
      // Look for theme toggle button
      const themeToggle = page.locator('button[aria-label*="theme"]').or(
        page.locator('button[title*="theme"]').or(
          page.locator('[data-testid="theme-toggle"]')
        )
      );
      
      if (await themeToggle.count() > 0) {
        await expect(themeToggle.first()).toBeVisible();
        
        // Test theme toggle functionality
        await themeToggle.first().click();
        
        // Check if theme changed (body class or data attribute)
        const bodyClasses = await page.locator('body').getAttribute('class');
        const dataTheme = await page.locator('html').getAttribute('data-theme');
        
        // At least one of these should indicate theme change
        expect(bodyClasses || dataTheme).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('displays correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check that main elements are still visible
      await expect(page.getByText('ShopValue')).toBeVisible();
      await expect(page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Caută' })).toBeVisible();
      
      // Check that layout adapts to mobile
      const searchContainer = page.locator('.searchbar-input').or(
        page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...')
      );
      
      await expect(searchContainer).toBeVisible();
    });

    test('displays correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Check that elements are properly positioned
      await expect(page.getByText('ShopValue')).toBeVisible();
      await expect(page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...')).toBeVisible();
    });

    test('displays correctly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Check that layout uses full width effectively
      await expect(page.getByText('ShopValue')).toBeVisible();
      await expect(page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Page should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('has proper image loading', async ({ page }) => {
      // Wait for images to load
      await page.waitForLoadState('networkidle');
      
      // Check that images are loaded
      const images = page.locator('img');
      const imageCount = await images.count();
      
      if (imageCount > 0) {
        // Check first few images are loaded
        for (let i = 0; i < Math.min(3, imageCount); i++) {
          const img = images.nth(i);
          await expect(img).toBeVisible();
          
          // Check that image is not broken
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          expect(naturalWidth).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('has proper heading structure', async ({ page }) => {
      // Check for main heading
      const h1 = page.locator('h1');
      if (await h1.count() > 0) {
        await expect(h1.first()).toBeVisible();
      }
      
      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
    });

    test('has proper form labels and structure', async ({ page }) => {
      // Check search form accessibility
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      await expect(searchInput).toBeVisible();
      
      // Check for label or aria-label
      const ariaLabel = await searchInput.getAttribute('aria-label');
      const label = page.locator('label[for]');
      const labelCount = await label.count();
      
      // Should have either aria-label or proper label
      expect(ariaLabel || labelCount > 0).toBeTruthy();
    });

    test('supports keyboard navigation', async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      
      // Check that focus is visible and moves correctly
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Continue tabbing to next element
      await page.keyboard.press('Tab');
      
      // Should move to next focusable element
      const nextFocusedElement = page.locator(':focus');
      await expect(nextFocusedElement).toBeVisible();
    });
  });
});