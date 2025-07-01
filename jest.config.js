const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Use different test environments based on test location
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  projects: [
    // Client-side tests (components, client utils)
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/__tests__/components/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/__tests__/client/**/*.test.{js,jsx,ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(cheerio.*|parse5.*|htmlparser2.*|dom-serializer.*|domelementtype.*|entities.*)/)'
      ],
    },
    // Server-side tests (API routes, server utils, lib functions)
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/lib/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/__tests__/api/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/__tests__/server/**/*.test.{js,jsx,ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(@clerk/.*|cheerio.*|parse5.*|htmlparser2.*|dom-serializer.*|domelementtype.*|entities.*)/)'
      ],
      globals: {
        'ts-jest': {
          useESM: true,
        },
      },
      extensionsToTreatAsEsm: ['.ts', '.tsx'],
    }
  ],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/__tests__/e2e/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@clerk/.*|cheerio.*|parse5.*|htmlparser2.*|dom-serializer.*|domelementtype.*|entities.*)/)'
  ],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // Suppress Mongoose Jest warnings
  setupFiles: ['<rootDir>/jest.env.js'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)