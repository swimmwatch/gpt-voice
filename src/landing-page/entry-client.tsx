import './styles/globals.css';
import { getPlyrLabels } from './plyr-i18n';

const landingDocument = document.documentElement;
const loaderStartedAt = performance.now();
const loaderMinimumDurationMs = 280;
const loaderMaximumDurationMs = 5000;
const localeFontLoaders: Readonly<Record<string, () => Promise<unknown>>> = {
  hi: () => import('@fontsource-variable/noto-sans-devanagari/wght.css'),
  ja: () => import('@fontsource-variable/noto-sans-jp/wght.css'),
  'zh-CN': () => import('@fontsource-variable/noto-sans-sc/wght.css'),
};
const localeFontLoading =
  localeFontLoaders[document.documentElement.lang]?.().catch(() => undefined) ?? Promise.resolve();

landingDocument.dataset.landingLoading = 'true';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Landing page root element is missing.');
}

const landingRoot = rootElement;
const plyrIconUrl = new URL('../../node_modules/plyr/dist/plyr.svg', import.meta.url).href;

landingRoot.setAttribute('aria-busy', 'true');

let landingHydration: Promise<void> | undefined;

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function waitForWindowLoad(): Promise<void> {
  if (document.readyState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}

async function waitForFonts(): Promise<void> {
  await localeFontLoading;
  await document.fonts?.ready?.catch(() => undefined);
}

async function waitForCriticalImages(): Promise<void> {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>('.site-header img, .hero-section img, .landing-loader img'),
  );

  await Promise.all(
    images.map((image) =>
      typeof image.decode === 'function' ? image.decode().catch(() => undefined) : Promise.resolve(),
    ),
  );
}

function waitForStablePaint(): Promise<void> {
  return new Promise((resolve) =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
    ),
  );
}

function correctInitialHashPosition(): void {
  const targetId = window.location.hash.slice(1);
  const target = targetId ? document.getElementById(targetId) : null;
  const header = document.querySelector<HTMLElement>('.site-header');

  if (!target || !header) {
    return;
  }

  const overlap = target.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
  if (overlap < 0) {
    window.scrollBy(0, overlap);
  }
}

function hydrateLanding(): Promise<void> {
  landingHydration ??= import('./hydrate')
    .then(({ hydrateLandingPage }) => {
      hydrateLandingPage(landingRoot);
      document.documentElement.dataset.landingEnhanced = 'true';
      enableDeferredDemoPlayer();
      requestAnimationFrame(() => requestAnimationFrame(correctInitialHashPosition));
    })
    .catch(() => undefined);

  return landingHydration;
}

function scheduleLandingHydration(): void {
  const start = (): void => {
    window.removeEventListener('load', start);
    document.removeEventListener('keydown', start, true);
    document.removeEventListener('pointerdown', start, true);
    void hydrateLanding();
  };

  window.addEventListener('load', start, { once: true });
  document.addEventListener('keydown', start, { capture: true, once: true });
  document.addEventListener('pointerdown', start, { capture: true, once: true });
}

async function settleInitialLandingLayout(): Promise<void> {
  const minimumDuration = Math.max(0, loaderMinimumDurationMs - (performance.now() - loaderStartedAt));
  const prepareLayout = waitForWindowLoad().then(async () => {
    await Promise.all([hydrateLanding(), waitForFonts(), waitForCriticalImages()]);
    await waitForStablePaint();
  });

  await Promise.race([Promise.all([prepareLayout, delay(minimumDuration)]), delay(loaderMaximumDurationMs)]);
  delete landingDocument.dataset.landingLoading;
  landingRoot.removeAttribute('aria-busy');
}

function revealInitialHashTarget(): void {
  const targetId = window.location.hash.slice(1);
  const target = targetId ? document.getElementById(targetId) : null;

  if (target?.matches('[data-landing-reveal]')) {
    target.dataset.revealed = 'true';
  }
}

function enableSectionReveals(): void {
  if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-reveal]'));
  if (targets.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.revealed = 'true';
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
  );

  requestAnimationFrame(() => {
    document.documentElement.dataset.landingReveal = 'true';
    targets.forEach((target) => observer.observe(target));
  });
}

type PlyrConstructor = new (
  target: HTMLVideoElement,
  options: {
    captions: { active: boolean; language: string; update: boolean };
    controls: readonly string[];
    i18n: Readonly<Record<string, string>>;
    iconUrl: string;
    keyboard: { focused: boolean; global: boolean };
    settings: readonly string[];
    speed: { options: readonly number[]; selected: number };
  },
) => unknown;

function enableDeferredDemoPlayer(): void {
  const video = document.querySelector<HTMLVideoElement>('[data-demo-video]');
  if (!video || typeof IntersectionObserver === 'undefined') {
    return;
  }

  let enhanced = false;
  const enhance = (): void => {
    if (enhanced) {
      return;
    }
    enhanced = true;

    void Promise.all([import('plyr'), import('plyr/dist/plyr.css')])
      .then(([module]) => {
        const Plyr = module.default as PlyrConstructor;
        new Plyr(video, {
          captions: { active: true, language: document.documentElement.lang, update: true },
          controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'mute',
            'volume',
            'settings',
            'pip',
            'fullscreen',
          ],
          iconUrl: plyrIconUrl,
          i18n: getPlyrLabels(document.documentElement.lang),
          keyboard: { focused: true, global: false },
          settings: ['captions', 'speed'],
          speed: { options: [0.5, 0.75, 1, 1.25, 1.5, 2], selected: 1 },
        });
      })
      .catch(() => undefined);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        enhance();
      }
    },
    { rootMargin: '600px 0px' },
  );

  video.addEventListener('play', enhance, { once: true });
  observer.observe(video);
}

scheduleLandingHydration();
revealInitialHashTarget();
enableSectionReveals();
void settleInitialLandingLayout();
