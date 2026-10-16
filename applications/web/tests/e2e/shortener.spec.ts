import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function createShortLinkInBrowser(
  page: Page,
  destination = `https://example.com/${randomUUID()}`,
) {
  await page.getByLabel("Paste your link", { exact: true }).fill(destination);
  await page.getByRole("button", { name: "Shorten link", exact: true }).click();
  const creationResultRegion = page.getByRole("region", {
    name: "Ready to share.",
  });
  await expect(creationResultRegion).toBeVisible();
  const shortenedUrl = await creationResultRegion
    .getByRole("link")
    .getAttribute("href");
  if (shortenedUrl === null) throw new Error("The created link has no href.");
  expect(shortenedUrl).toMatch(
    /^http:\/\/127\.0\.0\.1:4173\/s\/[A-Za-z0-9]{8}$/,
  );
  return { creationResultRegion, shortenedUrl, destination };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("creates, copies and persists real click statistics after reloading", async ({
  page,
  request,
}) => {
  const { creationResultRegion, shortenedUrl, destination } =
    await createShortLinkInBrowser(page);
  await creationResultRegion
    .getByRole("button", { name: `Copy link ${shortenedUrl}`, exact: true })
    .click();
  await expect(creationResultRegion.getByRole("status")).toHaveText(
    "Link copied to clipboard.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shortenedUrl,
  );

  const response = await request.get(shortenedUrl, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  await page.reload();
  const createdLinkRow = page.getByRole("listitem").filter({
    has: page.getByRole("link", { name: destination, exact: true }),
  });
  await expect(createdLinkRow.locator(".link-row__clicks")).toHaveText("1");
  await page.reload();
  await expect(createdLinkRow.locator(".link-row__clicks")).toHaveText("1");
});

test("creates a Unicode destination and serves encoded GET and HEAD redirects", async ({
  page,
  request,
}) => {
  const destination = "https://例え.jp/€?q=niño#sección";
  const expectedLocation =
    "https://xn--r8jz45g.jp/%E2%82%AC?q=ni%C3%B1o#secci%C3%B3n";
  const { shortenedUrl } = await createShortLinkInBrowser(page, destination);

  const getResponse = await request.get(shortenedUrl, { maxRedirects: 0 });
  expect(getResponse.status()).toBe(302);
  expect(getResponse.headers().location).toBe(expectedLocation);

  const headResponse = await request.head(shortenedUrl, { maxRedirects: 0 });
  expect(headResponse.status()).toBe(302);
  expect(headResponse.headers().location).toBe(expectedLocation);
  expect(await headResponse.text()).toBe("");

  await page.reload();
  const createdLinkRow = page.getByRole("listitem").filter({
    has: page.getByRole("link", { name: destination, exact: true }),
  });
  await expect(createdLinkRow.locator(".link-row__clicks")).toHaveText("1");
});

test("preserves and focuses invalid input, then allows correction", async ({
  page,
}) => {
  const urlInput = page.getByLabel("Paste your link", { exact: true });
  await urlInput.fill("ftp://example.com/file");
  await page.getByRole("button", { name: "Shorten link", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(urlInput).toHaveValue("ftp://example.com/file");
  await expect(urlInput).toBeFocused();
  await expect(urlInput).toHaveAttribute("aria-invalid", "true");
  await urlInput.fill("https://example.com/corrected");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await createShortLinkInBrowser(page);
});

test("offers a selected manual copy field when the clipboard fails", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  const { creationResultRegion, shortenedUrl } =
    await createShortLinkInBrowser(page);
  await creationResultRegion
    .getByRole("button", { name: `Copy link ${shortenedUrl}`, exact: true })
    .click();
  await expect(creationResultRegion.getByRole("status")).toContainText(
    "Clipboard unavailable",
  );
  const manualCopyInput = creationResultRegion.getByLabel(
    "Link for manual copying",
  );
  await expect(manualCopyInput).toHaveValue(shortenedUrl);
  await expect(manualCopyInput).toBeFocused();
  expect(
    await manualCopyInput.evaluate((element: HTMLInputElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([0, shortenedUrl.length]);
});

test("disables editing and repeated submissions while a creation is pending", async ({
  page,
}) => {
  let creationRequestCount = 0;
  let releaseSubmission!: () => void;
  const pendingSubmission = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });
  await page.route("**/*.data*", async (route) => {
    if (route.request().method() === "POST") {
      creationRequestCount++;
      await pendingSubmission;
    }
    await route.continue();
  });
  const urlInput = page.getByLabel("Paste your link", { exact: true });
  await urlInput.fill(`https://example.com/${randomUUID()}`);
  await page.getByRole("button", { name: "Shorten link", exact: true }).click();
  try {
    await expect(
      page.getByRole("button", { name: "Creating link…", exact: true }),
    ).toBeDisabled();
    await expect(urlInput).toHaveAttribute("readonly", "");
    await urlInput.press("Enter");
  } finally {
    releaseSubmission();
  }
  await expect(
    page.getByRole("region", { name: "Ready to share." }),
  ).toBeVisible();
  expect(creationRequestCount).toBe(1);
});

test("shows the HTTP 413 error and recovers after an oversized submission", async ({
  page,
}) => {
  const urlInput = page.getByLabel("Paste your link", { exact: true });
  const value = `https://example.com/${"x".repeat(40_000)}`;
  await urlInput.fill(value);
  const response = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Shorten link", exact: true }).click();
  expect((await response).status()).toBe(413);
  await expect(page.getByRole("alert")).toHaveText(
    "The URL form is too large. Maximum size is 32 KiB.",
  );
  await expect(urlInput).toHaveValue(value);
  await createShortLinkInBrowser(page);
});
