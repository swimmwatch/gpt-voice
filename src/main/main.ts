import { app, BrowserWindow, globalShortcut, ipcMain, session, clipboard, Notification, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { BrowserContext } from 'playwright';

import * as os from 'os';

if (app.isPackaged) {
  process.env.ELECTRON_DISABLE_SANDBOX = '1';
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isRecording = false;
let isQuitting = false;

const APP_DIR = path.join(os.homedir(), '.webvoice');
if (!fs.existsSync(APP_DIR)) {
  fs.mkdirSync(APP_DIR, { recursive: true });
}
const SESSION_FILE = path.join(APP_DIR, 'chatgpt-session.json');

chromium.use(StealthPlugin());

function findChrome(): string {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return ''; // fallback: let Playwright use its bundled browser
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: undefined,
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray-like behavior: hide on close
  mainWindow.on('close', (event) => {
    if (mainWindow && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function getTrayIconPath(recording: boolean): string {
  const filename = recording ? 'tray-icon-recording-solid-even-larger-dot.png' : 'tray-icon-white-transparent.png';
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', filename)
    : path.join(__dirname, '..', 'assets', filename);
}

function updateTrayIcon(recording: boolean): void {
  if (!tray) return;
  const icon = nativeImage.createFromPath(getTrayIconPath(recording));
  tray.setImage(icon);
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getTrayIconPath(false));
  tray = new Tray(icon);
  tray.setToolTip('Voice Transcriber');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

function registerShortcuts(): void {
  const registered = globalShortcut.register('F8', () => {
    console.log('F8 pressed, isRecording:', !isRecording);
    isRecording = !isRecording;
    updateTrayIcon(isRecording);
    if (mainWindow) {
      mainWindow.webContents.send('toggle-recording', isRecording);
      mainWindow.show();
    }
  });
  console.log('F8 shortcut registered:', registered);
}

function loadSession(): { cookies: any[]; origins: any[] } | null {
  if (!fs.existsSync(SESSION_FILE)) return null;
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
}

function getLaunchOptions() {
  const executablePath = findChrome();
  const opts: any = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
    ],
  };
  if (executablePath) {
    opts.executablePath = executablePath;
  } else {
    opts.channel = 'chrome';
  }
  return opts;
}

ipcMain.handle('transcribe-audio', async (_event, buffer: ArrayBuffer) => {
  let context: BrowserContext | null = null;
  try {
    console.log('[transcribe] Starting transcription, audio size:', buffer.byteLength, 'bytes');

    const sessionData = loadSession();
    if (!sessionData) {
      console.log('[transcribe] No session file found');
      return { success: false, error: 'Not logged in. Please login first.' };
    }
    console.log('[transcribe] Session loaded, cookies:', sessionData.cookies.length);

    console.log('[transcribe] Launching headless browser...');
    const browser = await chromium.launch(getLaunchOptions());
    context = await browser.newContext({
      storageState: SESSION_FILE,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    const page = await context.newPage();

    // Navigate to ChatGPT to establish session cookies and pass Cloudflare
    console.log('[transcribe] Navigating to chatgpt.com...');
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    console.log('[transcribe] Page loaded, URL:', page.url());

    // Get access token from session endpoint
    console.log('[transcribe] Fetching access token...');
    const accessToken = await page.evaluate(async () => {
      const res = await fetch('/api/auth/session');
      const json = await res.json();
      return json.accessToken || '';
    });
    if (!accessToken) {
      await browser.close();
      return { success: false, error: 'No access token. Session may have expired — please login again.' };
    }
    console.log('[transcribe] Got access token, length:', accessToken.length);

    // Send transcription request
    const audioBase64 = Buffer.from(buffer).toString('base64');
    console.log('[transcribe] Sending audio to /backend-api/transcribe, base64 length:', audioBase64.length);

    const transcribeResp = await page.evaluate(async ({ audioBase64, accessToken }: { audioBase64: string; accessToken: string }) => {
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
      const formData = new FormData();
      formData.append('file', blob, 'whisper.webm');

      const res = await fetch('/backend-api/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const text = await res.text();
      return { status: res.status, body: text };
    }, { audioBase64, accessToken });

    console.log('[transcribe] Transcribe response status:', transcribeResp.status);
    console.log('[transcribe] Transcribe response body:', transcribeResp.body.substring(0, 500));

    await browser.close();

    let result: any;
    try {
      result = JSON.parse(transcribeResp.body);
    } catch {
      return { success: false, error: `Transcribe endpoint returned non-JSON (status ${transcribeResp.status}): ${transcribeResp.body.substring(0, 300)}` };
    }

    const text = result.text || result.transcript || '';
    if (text) {
      console.log('[transcribe] Success! Text:', text);
      clipboard.writeText(text);
      return { success: true, text };
    } else {
      console.log('[transcribe] No text in response. Full result:', JSON.stringify(result));
      return { success: false, error: 'No transcription in response', raw: JSON.stringify(result) };
    }
  } catch (err: any) {
    console.error('[transcribe] Error:', err.message);
    if (context) {
      try { await context.browser()?.close(); } catch { /* ignore */ }
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('translate-text', async (_event, text: string, targetLang: string) => {
  let browser: any = null;
  try {
    console.log('[translate] Starting translation via Google Translate, text length:', text.length, 'target:', targetLang);

    // Google Translate uses language codes: en, ru
    const sourceLang = 'auto';
    const url = `https://translate.google.ru/?sl=${sourceLang}&tl=${targetLang}&op=translate`;

    browser = await chromium.launch(getLaunchOptions());
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    console.log('[translate] Google Translate page loaded');

    // Type text into the source textarea
    const sourceArea = page.locator('textarea.er8xn');
    await sourceArea.waitFor({ timeout: 10000 });
    await sourceArea.fill(text);
    console.log('[translate] Text entered, waiting for translation...');

    // Wait for translation result to appear
    const resultSelector = '.ryNqvb';
    await page.waitForSelector(resultSelector, { timeout: 15000 });
    // Give it a moment for full translation to render
    await page.waitForTimeout(1500);

    // Extract translated text
    const translated = await page.evaluate((sel: string) => {
      const spans = document.querySelectorAll(sel);
      return Array.from(spans).map(s => s.textContent || '').join('');
    }, resultSelector);

    console.log('[translate] Result:', translated);
    await browser.close();
    browser = null;

    if (translated) {
      clipboard.writeText(translated);
      return { success: true, text: translated };
    }
    return { success: false, error: 'No translation result found on page' };
  } catch (err: any) {
    console.error('[translate] Error:', err.message);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-recording-status', () => {
  return isRecording;
});

ipcMain.handle('chatgpt-login', async () => {
  let context: BrowserContext | null = null;
  try {
    const browser = await chromium.launch({ ...getLaunchOptions(), headless: false });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    const page = await context.newPage();

    await page.goto('https://chatgpt.com');

    // Wait until the user closes the browser window
    await new Promise<void>((resolve) => {
      browser.on('disconnected', () => resolve());
      page.on('close', () => {
        // Save session and close browser when the last page is closed
        context!.storageState().then((state) => {
          fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
          browser.close().catch(() => {}).finally(() => resolve());
        }).catch(() => {
          browser.close().catch(() => {}).finally(() => resolve());
        });
      });
    });

    return { success: true, path: SESSION_FILE };
  } catch (err: any) {
    if (context) {
      try { await context.browser()?.close(); } catch { /* ignore */ }
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('check-session', () => {
  return fs.existsSync(SESSION_FILE);
});

ipcMain.handle('show-notification', (_event, title: string, body: string) => {
  const notification = new Notification({ title, body });
  notification.show();
});

app.on('ready', () => {
  // Grant microphone permission
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  createWindow();
  createTray();
  registerShortcuts();
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});
