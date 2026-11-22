import { existsSync } from 'node:fs';
import { AppError } from './http.js';

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChrome(): string | null {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/** Renders HTML to PDF with a headless Chromium so Bangla Unicode shaping is correct. */
export async function htmlToPdf(html: string, pageSize: string, marginMm: number): Promise<Buffer> {
  const executablePath = findChrome();
  if (!executablePath) {
    throw new AppError(503, 'The PDF engine is not available on the server. Set CHROME_PATH to a Chrome/Edge executable, or use Print.', 'PDF_ENGINE');
  }
  const puppeteer = await import('puppeteer-core');
  let browser;
  try {
    browser = await puppeteer.default.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: pageSize as any,
      margin: { top: `${marginMm}mm`, bottom: `${marginMm}mm`, left: `${marginMm}mm`, right: `${marginMm}mm` },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font-size:9px;text-align:right;padding-right:12mm;color:#555">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
    return Buffer.from(pdf);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(500, 'Could not generate the PDF (engine or font error). Try Print instead.', 'PDF_FAILED');
  } finally {
    await browser?.close().catch(() => {});
  }
}
