const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: 'list',
  use: {
    headless: true,
    viewport: {
      width: 390,
      height: 844,
    },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
