import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './web',
  testMatch: '**/*.spec.js',
  
  // Timeout for each test
  timeout: 30000,
  
  // Run tests in files in parallel
  fullyParallel: false,  // Web Audio tests should run sequentially (audio output)
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Reporter to use
  reporter: 'list',
  
  use: {
    // Base URL for page.goto()
    baseURL: 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    rTimeout: 30000,
  },
});
