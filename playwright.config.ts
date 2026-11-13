import { defineConfig, devices } from "@playwright/test";

const frontendOrigin = "http://127.0.0.1:4174";
const isolatedApiBaseUrl =
  process.env.E2E_API_BASE_URL?.trim().replace(/\/+$/, "") || undefined;
const requiredIsolatedApiBaseUrl = "http://127.0.0.1:8001/api/v1";

if (isolatedApiBaseUrl && isolatedApiBaseUrl !== requiredIsolatedApiBaseUrl) {
  throw new Error(
    "E2E_API_BASE_URL must target the isolated local API at 127.0.0.1:8001/api/v1.",
  );
}

export default defineConfig({
  workers: 1,
  testDir: "./tests/e2e",
  outputDir: "./artifacts/playwright",
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: frontendOrigin,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: frontendOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL:
        isolatedApiBaseUrl ?? `${frontendOrigin}/api/v1`,
    },
  },
});
