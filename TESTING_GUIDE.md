# Testing Guide for ShopValue Application

## Overview

This comprehensive test suite covers the entire ShopValue application with both unit/component tests and end-to-end (E2E) tests. The test suite ensures the application works correctly across different scenarios including happy paths, edge cases, and error states.

## Test Structure

### Component Tests (Jest + React Testing Library)
Located in `__tests__/components/`
- **Searchbar.test.tsx** - Tests for the main search functionality
- **ProductCard.test.tsx** - Tests for product display components  
- **PriceInfoCard.test.tsx** - Tests for price information display

### Unit Tests (Jest)
Located in `__tests__/lib/`
- **actions.test.ts** - Tests for server actions and API functions

### E2E Tests (Playwright)
Located in `tests/e2e/`
- **homepage.spec.ts** - Tests for homepage functionality and navigation
- **search-flow.spec.ts** - Tests for complete user journey and search flow

## Test Coverage

### 🎯 Happy Path Scenarios
- User searches for a valid Flip.ro product URL
- User navigates to product detail page
- User views product information (price, description, reviews)
- User tracks product via email notifications
- Theme toggle functionality works correctly
- Responsive design adapts to different screen sizes

### ⚠️ Edge Cases
- Empty search input
- Invalid URLs (non-Flip.ro domains)
- URLs with invalid parameters (modelType)
- Very long product titles
- Zero or extremely high prices
- Products without images
- Out of stock products
- Network timeouts and errors

### 🚨 Error States
- Invalid product URLs trigger alerts
- Network errors are handled gracefully
- Server errors don't break the application
- Missing products redirect appropriately
- Database connection errors are handled

## Running Tests

### Prerequisites
```bash
npm install
```

### Component/Unit Tests
```bash
# Run all component tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

### Run All Tests
```bash
npm run test:all
```

## Test Configuration

### Jest Configuration
- **File**: `jest.config.js`
- **Setup**: `jest.setup.js`
- **Environment**: jsdom for React component testing
- **Mocks**: Next.js components (Image, Link, Navigation)

### Playwright Configuration
- **File**: `playwright.config.ts`
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile Testing**: Pixel 5, iPhone 12
- **Base URL**: `http://localhost:3000`

## Key Testing Scenarios

### 1. Main User Journey (E2E)
```typescript
// User Flow:
1. User visits homepage
2. User enters valid Flip.ro product URL
3. System validates URL
4. System scrapes product data
5. User views product details
6. User tracks product via email
7. User receives confirmation
```

### 2. Search Validation (Component)
```typescript
// Valid URLs:
- https://flip.ro/telefoane-mobile/samsung-galaxy-s24/
- https://www.flip.ro/laptopuri/macbook-air-13/

// Invalid URLs:
- https://emag.ro/product/123
- https://flip.ro/category?modelType=list
- not-a-url
```

### 3. Product Display (Component)
```typescript
// Test Cases:
- In-stock products show price and "Buy Now" button
- Out-of-stock products show "Stoc Epuizat" message
- Discounted products show both original and current price
- Product images load correctly with fallbacks
```

### 4. Error Handling (E2E + Component)
```typescript
// Error Scenarios:
- Network failures during search
- Invalid product URLs
- Server errors (500, 404)
- Database connection issues
- Missing product data
```

## Test Data

### Mock Products
The test suite uses comprehensive mock data located in `tests/utils/test-helpers.ts`:
- `mockProduct` - Standard in-stock product
- `mockOutOfStockProduct` - Out of stock product
- `mockProductWithoutPrice` - Product with no pricing data
- `createMockProduct()` - Utility to create custom test products

### Mock URLs
- **Valid Flip URLs**: Tested for acceptance
- **Invalid URLs**: Tested for rejection
- **Edge Case URLs**: Tested for proper handling

## Accessibility Testing

The test suite includes accessibility checks:
- Proper heading structure (h1, h2, h3...)
- Form labels and ARIA attributes
- Keyboard navigation support
- Screen reader compatibility
- Focus management

## Performance Testing

E2E tests include performance validation:
- Page load times (< 5 seconds)
- Image loading optimization
- Network request optimization
- Mobile performance

## Browser Compatibility

Tests run across multiple browsers:
- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Mobile Chrome, Mobile Safari
- **Viewports**: 375px (mobile), 768px (tablet), 1920px (desktop)

## Debugging Tests

### Component Tests
```bash
# Run specific test file
npm test -- Searchbar.test.tsx

# Run tests with verbose output
npm test -- --verbose

# Run single test
npm test -- --testNamePattern="renders all elements correctly"
```

### E2E Tests
```bash
# Run specific test file
npx playwright test homepage.spec.ts

# Run with debug mode
npx playwright test --debug

# Run with headed browser
npx playwright test --headed
```

## Continuous Integration

The test suite is designed to run in CI environments:
- Tests run in headless mode by default
- Screenshots captured on failures
- Test reports generated in HTML format
- Coverage reports for component tests

## Test Best Practices

1. **Isolation**: Each test is independent and can run in any order
2. **Mocking**: External dependencies are mocked appropriately
3. **Assertions**: Clear, descriptive assertions with proper error messages
4. **Coverage**: Comprehensive coverage of happy paths, edge cases, and errors
5. **Maintenance**: Tests are maintainable and well-documented

## Future Enhancements

Potential areas for test expansion:
- Visual regression testing
- API endpoint testing
- Database integration testing
- Security testing
- Load testing
- Cross-browser compatibility matrix

## Troubleshooting

### Common Issues

1. **Tests failing due to timeouts**
   - Increase timeout values in test configuration
   - Check if application is running on correct port

2. **Mock data not matching real data**
   - Update mock data to reflect actual API responses
   - Verify mock data structure matches TypeScript types

3. **E2E tests failing in CI**
   - Ensure proper browser dependencies are installed
   - Check viewport sizes and responsive behavior

4. **Component tests failing**
   - Verify mocks are properly configured
   - Check if components are using correct props

For more help, see the individual test files for detailed examples and patterns.