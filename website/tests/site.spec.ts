import { expect, test, type Locator, type Page } from "@playwright/test";

const endpoint = "https://api.web3forms.com/submit";
const unconfigured = process.env.TEST_FORMS_UNCONFIGURED === "1";
const pages = [
  { path: "", label: "Home" },
  { path: "download/", label: "Download" },
  { path: "docs/", label: "Docs" },
  { path: "contact/", label: "Contact" },
];

async function signup(page: Page): Promise<Locator> {
  await page.goto("contact/");
  const form = page.locator('[data-form-kind="signup"]');
  await form.getByLabel("Email address").fill("viewer@example.com");
  await form.getByRole("checkbox").check();
  return form;
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px layout`, () => {
    test.use({ viewport });
    for (const route of pages) {
      test(`${route.label} has a title, heading, navigation, and no overflow`, async ({ page }) => {
        const response = await page.goto(route.path || "./");
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle(/CRT-TV/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        const nav = page.getByRole("navigation").first();
        for (const destination of pages) {
          const link = nav.getByRole("link", { name: destination.label, exact: true });
          await expect(link).toBeVisible();
          expect(await link.getAttribute("href")).toBe(`/shader-video-player/${destination.path}`);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  });
}

test("navigation opens each route under the GitHub Pages base", async ({ page }) => {
  await page.goto("./");
  for (const destination of pages.slice(1)) {
    await page.getByRole("navigation").first().getByRole("link", { name: destination.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/shader-video-player/${destination.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("download copies the visibly placeholder command", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("download/");
  await page.getByRole("button", { name: /copy/i }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    "curl -fsSL https://example.com/crt-tv/install.sh",
  );
});

test("keyboard skip link moves navigation into the page", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  expect(await skip.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("main").getByRole("link", { name: /Get CRT-TV/ })).toBeFocused();
});

test("reduced-motion preference disables smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("images, scripts, and styles resolve beneath the hosting base", async ({ page, request }) => {
  const assets = new Set<string>();
  for (const route of pages) {
    await page.goto(route.path || "./");
    const urls = await page.locator('img[src], script[src], link[rel="stylesheet"][href]').evaluateAll((nodes) =>
      nodes.map((node) => new URL(node.getAttribute("src") || node.getAttribute("href") || "", location.href).href),
    );
    for (const url of urls) assets.add(url);
  }
  expect(assets.size).toBeGreaterThan(3);
  for (const url of assets) {
    expect(new URL(url).pathname).toMatch(/^\/shader-video-player\//);
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()["content-type"], url).not.toContain("text/html");
  }
});

test("unknown routes provide a working Home recovery link", async ({ page }) => {
  const response = await page.goto("not-a-channel/");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(/404.*CRT-TV/);
  await page.getByRole("link", { name: /Back to Home/ }).click();
  await expect(page).toHaveURL(/\/shader-video-player\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your videos.");
});

test.describe("configured Web3Forms", () => {
  test.skip(unconfigured, "Requires a build with the test access key");

  test("signup requires consent before making a request", async ({ page }) => {
    let requests = 0;
    await page.route(endpoint, async (route) => {
      requests++;
      await route.fulfill({ json: { success: true } });
    });
    await page.goto("contact/");
    const form = page.locator('[data-form-kind="signup"]');
    await form.getByLabel("Email address").fill("viewer@example.com");
    await form.getByRole("button").click();
    expect(await form.evaluate((node: HTMLFormElement) => node.checkValidity())).toBe(false);
    expect(requests).toBe(0);
  });

  test("signup confirms only an accepted submission and records consent", async ({ page }) => {
    let payload: Record<string, unknown> = {};
    await page.route(endpoint, async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { success: true } });
    });
    const form = await signup(page);
    await form.getByRole("button").click();
    await expect(form.getByRole("status")).toContainText("has been received");
    expect(payload.email).toBe("viewer@example.com");
    expect(payload.subject).toBe("CRT-TV launch signup");
    expect(payload.launch_updates_consent).toBeTruthy();
    expect(payload.access_key).toBe("test-access-key");
    await expect(form.getByLabel("Email address")).toHaveValue("");
  });

  test("inquiry succeeds without subscribing the sender", async ({ page }) => {
    let payload: Record<string, unknown> = {};
    await page.route(endpoint, async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { success: true } });
    });
    await page.goto("contact/");
    const form = page.locator('[data-form-kind="inquiry"]');
    await form.getByLabel("Your name").fill("A viewer");
    await form.getByLabel("Email address").fill("viewer@example.com");
    await form.getByLabel("What's on your mind?").fill("Can I customize scanlines?");
    await form.getByRole("button").click();
    await expect(form.getByRole("status")).toContainText("Message received");
    expect(payload.subject).toBe("CRT-TV contact inquiry");
    expect(payload.message).toBe("Can I customize scanlines?");
    expect(payload).not.toHaveProperty("launch_updates_consent");
  });

  for (const scenario of [
    { name: "service rejection", status: 200, body: { success: false } },
    { name: "HTTP failure", status: 500, body: { success: true } },
  ]) {
    test(`${scenario.name} preserves inputs and permits retry`, async ({ page }) => {
      await page.route(endpoint, (route) => route.fulfill({ status: scenario.status, json: scenario.body }));
      const form = await signup(page);
      await form.getByRole("button").click();
      await expect(form.getByRole("status")).toContainText("couldn't confirm delivery");
      await expect(form.getByLabel("Email address")).toHaveValue("viewer@example.com");
      await expect(form.getByRole("checkbox")).toBeChecked();
      await expect(form.getByRole("button")).toBeEnabled();
    });
  }

  test("network failure preserves inputs", async ({ page }) => {
    await page.route(endpoint, (route) => route.abort());
    const form = await signup(page);
    await form.getByRole("button").click();
    await expect(form.getByRole("status")).toContainText("couldn't confirm delivery");
    await expect(form.getByLabel("Email address")).toHaveValue("viewer@example.com");
  });

  test("malformed service responses preserve inputs", async ({ page }) => {
    await page.route(endpoint, (route) => route.fulfill({
      status: 200, contentType: "application/json", body: "not valid JSON",
    }));
    const form = await signup(page);
    await form.getByRole("button").click();
    await expect(form.getByRole("status")).toContainText("couldn't confirm delivery");
    await expect(form.getByLabel("Email address")).toHaveValue("viewer@example.com");
    await expect(form.getByRole("button")).toBeEnabled();
  });

  test("a stalled request times out without clearing the form", async ({ page }) => {
    await page.clock.install();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(endpoint, async (route) => {
      await gate;
      await route.abort();
    });
    const form = await signup(page);
    await form.getByRole("button").click();
    await expect(form.getByRole("button")).toBeDisabled();
    await page.clock.fastForward(15_001);
    await expect(form.getByRole("status")).toContainText("timed out");
    await expect(form.getByLabel("Email address")).toHaveValue("viewer@example.com");
    await expect(form.getByRole("button")).toBeEnabled();
    release();
  });

  test("pending submissions cannot be sent twice", async ({ page }) => {
    let requests = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(endpoint, async (route) => {
      requests++;
      await gate;
      await route.fulfill({ json: { success: true } });
    });
    const form = await signup(page);
    await form.getByRole("button").click();
    await expect(form.getByRole("button")).toBeDisabled();
    await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
    await expect.poll(() => requests).toBe(1);
    release();
    await expect(form.getByRole("status")).toContainText("has been received");
    expect(requests).toBe(1);
  });
});

test("missing key visibly disables both forms without sending requests", async ({ page }) => {
  test.skip(!unconfigured, "Requires a build without a Web3Forms key");
  let requests = 0;
  await page.route(endpoint, async (route) => {
    requests++;
    await route.abort();
  });
  await page.goto("contact/");
  const forms = page.locator("[data-contact-form]");
  await expect(forms).toHaveCount(2);
  for (const form of await forms.all()) {
    await expect(form.getByRole("button")).toBeDisabled();
    await expect(form.getByRole("status")).toContainText("not connected yet");
    await form.evaluate((node: HTMLFormElement) => node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  }
  expect(requests).toBe(0);
});
