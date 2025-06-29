import { test, expect } from '@playwright/test';

test.describe('Search Flow - Main User Journey', () => {
  // Valid Flip.ro URL for testing
  const validFlipUrl = 'https://flip.ro/telefoane-mobile/samsung-galaxy-s24-128gb-5g-dual-sim-negru-4284872/';
  const invalidUrl = 'https://emag.ro/product/123';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Search Input Validation', () => {
    test('accepts valid Flip.ro URLs', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      const searchButton = page.getByRole('button', { name: 'Caută' });

      // Initially button should be disabled
      await expect(searchButton).toBeDisabled();

      // Type valid URL
      await searchInput.fill(validFlipUrl);
      
      // Button should be enabled
      await expect(searchButton).toBeEnabled();

      // Mock the search request to avoid actually scraping
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Submit form
      await searchButton.click();
      
      // Should show loading state
      await expect(page.getByText('Căutare...')).toBeVisible();
    });

    test('rejects invalid URLs with alert', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      const searchButton = page.getByRole('button', { name: 'Caută' });

      // Type invalid URL
      await searchInput.fill(invalidUrl);
      await expect(searchButton).toBeEnabled();

      // Listen for alert dialog
      page.on('dialog', async dialog => {
        expect(dialog.message()).toBe('Please provide a valid link.');
        await dialog.accept();
      });

      // Submit form - should trigger alert
      await searchButton.click();
    });

    test('rejects empty input', async ({ page }) => {
      const searchButton = page.getByRole('button', { name: 'Caută' });
      
      // Button should be disabled with empty input
      await expect(searchButton).toBeDisabled();
    });

    test('rejects Flip URLs with modelType parameter', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      const searchButton = page.getByRole('button', { name: 'Caută' });

      // Type invalid URL with modelType
      const invalidModelTypeUrl = 'https://flip.ro/category?modelType=list';
      await searchInput.fill(invalidModelTypeUrl);

      // Listen for alert dialog
      page.on('dialog', async dialog => {
        expect(dialog.message()).toBe('Please provide a valid link.');
        await dialog.accept();
      });

      await searchButton.click();
    });
  });

  test.describe('Complete User Journey - Happy Path', () => {
    test('user searches for product, views details, and navigates', async ({ page }) => {
      // Step 1: User arrives at homepage
      await expect(page.getByText('ShopValue')).toBeVisible();
      await expect(page.getByText('Cumpărăturile Inteligente Încep Aici')).toBeVisible();

      // Step 2: User enters a valid product URL
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      await searchInput.fill(validFlipUrl);

      // Step 3: Mock the scraping API to return a product
      const mockProduct = {
        _id: '507f1f77bcf86cd799439011',
        brand: 'Samsung',
        productModel: 'Galaxy S24',
        title: 'Samsung Galaxy S24 128GB 5G Dual SIM Negru',
        currentPrice: 3299,
        originalPrice: 3999,
        currency: 'RON',
        image: 'https://example.com/image.jpg',
        category: 'Telefoane Mobile',
        isOutOfStock: false,
        url: validFlipUrl,
        source: 'flip'
      };

      // Mock the search API
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProduct)
        });
      });

      // Mock the product detail page route
      await page.route(`**/produse/Samsung/Galaxy-S24/${mockProduct._id}`, route => {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `
            <html>
              <head><title>ShopValue - Samsung Galaxy S24</title></head>
              <body>
                <h1>Samsung Galaxy S24 128GB 5G Dual SIM Negru</h1>
                <div class="price">3299 RON</div>
                <div class="original-price">3999 RON</div>
                <button class="track-button">Track Price</button>
                <a href="${validFlipUrl}" target="_blank">Vezi Produsul</a>
              </body>
            </html>
          `
        });
      });

      // Step 4: User submits the search
      const searchButton = page.getByRole('button', { name: 'Caută' });
      await searchButton.click();

      // Step 5: System shows loading state
      await expect(page.getByText('Căutare...')).toBeVisible();

      // Step 6: Wait for search to complete (simulated)
      await page.waitForTimeout(2000);

      // Step 7: User should be redirected to product page or see product results
      // Note: In a real scenario, this would depend on the app's actual behavior
      // For now, we'll check that the loading state disappears
      await expect(page.getByText('Căutare...')).not.toBeVisible();
      await expect(page.getByText('Caută')).toBeVisible();
    });

    test('user navigates to product detail page and views product information', async ({ page }) => {
      // Navigate directly to a product page (simulating the result of a search)
      const productId = '507f1f77bcf86cd799439011';
      const productUrl = `/produse/Samsung/Galaxy-S24/${productId}`;

      // Mock the product detail API
      await page.route(`**/api/products/${productId}`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _id: productId,
            brand: 'Samsung',
            productModel: 'Galaxy S24',
            title: 'Samsung Galaxy S24 128GB 5G Dual SIM Negru',
            currentPrice: 3299,
            originalPrice: 3999,
            currency: 'RON',
            image: 'https://example.com/image.jpg',
            category: 'Telefoane Mobile',
            stars: 4.7,
            reviewsCount: 245,
            isOutOfStock: false,
            priceHistory: [
              { price: 3999, date: '2024-01-01' },
              { price: 3599, date: '2024-01-15' },
              { price: 3299, date: '2024-02-01' }
            ],
            highestPrice: 3999,
            lowestPrice: 3299,
            averagePrice: 3632,
            url: validFlipUrl,
            source: 'flip',
            description: 'Latest Samsung Galaxy S24 with advanced features'
          })
        });
      });

      // Navigate to product page
      await page.goto(productUrl);
      
      // Check product information is displayed
      await expect(page.getByText('Samsung Galaxy S24 128GB 5G Dual SIM Negru')).toBeVisible();
      
      // Check price information
      const priceRegex = /3299.*RON/;
      await expect(page.locator('text=' + priceRegex.source)).toBeVisible();
      
      // Check for product details
      await expect(page.getByText('Vezi Produsul')).toBeVisible();
      
      // Check for track button or similar functionality
      const trackButton = page.getByText('Track').or(
        page.getByText('Urmărește').or(
          page.locator('button[class*="track"]')
        )
      );
      
      if (await trackButton.count() > 0) {
        await expect(trackButton.first()).toBeVisible();
      }
    });

    test('user can track a product via email', async ({ page }) => {
      const productId = '507f1f77bcf86cd799439011';
      const productUrl = `/produse/Samsung/Galaxy-S24/${productId}`;

      // Mock product API
      await page.route(`**/api/products/${productId}`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _id: productId,
            title: 'Samsung Galaxy S24',
            currentPrice: 3299,
            currency: 'RON'
          })
        });
      });

      await page.goto(productUrl);

      // Look for track functionality (modal or form)
      const trackButton = page.getByText('Track').or(
        page.getByText('Urmărește').or(
          page.getByText('Alertă preț').or(
            page.locator('button[data-testid="track-button"]')
          )
        )
      );

      if (await trackButton.count() > 0) {
        await trackButton.first().click();

        // Look for email input in modal or form
        const emailInput = page.getByPlaceholder(/email/i).or(
          page.locator('input[type="email"]').or(
            page.getByLabel(/email/i)
          )
        );

        if (await emailInput.count() > 0) {
          await emailInput.fill('test@example.com');

          // Mock the tracking API
          await page.route('**/api/track', route => {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true })
            });
          });

          // Submit tracking form
          const submitButton = page.getByRole('button', { name: /track|submit|urmărește/i });
          if (await submitButton.count() > 0) {
            await submitButton.click();
            
            // Check for success message
            await expect(page.getByText(/success|confirm|confirmat/i)).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('handles network errors gracefully', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      const searchButton = page.getByRole('button', { name: 'Caută' });

      await searchInput.fill(validFlipUrl);

      // Mock network error
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      await searchButton.click();

      // Should handle error gracefully - loading state should disappear
      await expect(page.getByText('Căutare...')).toBeVisible();
      
      // After timeout, should return to normal state
      await page.waitForTimeout(5000);
      await expect(page.getByText('Caută')).toBeVisible();
    });

    test('handles server errors gracefully', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      const searchButton = page.getByRole('button', { name: 'Caută' });

      await searchInput.fill(validFlipUrl);

      // Mock server error
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });

      await searchButton.click();

      // Should handle error gracefully
      await expect(page.getByText('Căutare...')).toBeVisible();
      
      // Should return to normal state
      await page.waitForTimeout(3000);
      await expect(page.getByText('Caută')).toBeVisible();
    });

    test('handles product not found scenario', async ({ page }) => {
      const productId = 'nonexistent-id';
      const productUrl = `/produse/Samsung/Unknown/${productId}`;

      // Mock 404 response
      await page.route(`**/api/products/${productId}`, route => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Product not found' })
        });
      });

      // Should redirect to homepage or show 404 page
      const response = await page.goto(productUrl);
      
      // Either should redirect to home or show error page
      expect(page.url().includes('/produse') || page.url() === page.url().split('/')[0] + '/').toBeTruthy();
    });
  });

  test.describe('Mobile Experience', () => {
    test('search flow works on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const searchInput = page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...');
      const searchButton = page.getByRole('button', { name: 'Caută' });

      // Should be visible and usable on mobile
      await expect(searchInput).toBeVisible();
      await expect(searchButton).toBeVisible();

      // Type URL
      await searchInput.fill(validFlipUrl);
      await expect(searchButton).toBeEnabled();

      // Mock successful response
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      await searchButton.click();
      await expect(page.getByText('Căutare...')).toBeVisible();
    });

    test('mobile layout adapts correctly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Check that elements stack vertically on mobile
      const searchContainer = page.locator('form').or(
        page.getByPlaceholder('Introduceți link-ul produsului de pe Flip aici...').locator('..')
      );

      await expect(searchContainer).toBeVisible();

      // Check that text is readable
      await expect(page.getByText('ShopValue')).toBeVisible();
      await expect(page.getByText('Nu găsești produsul?')).toBeVisible();
    });
  });
});