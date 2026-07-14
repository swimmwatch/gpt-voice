import './styles/globals.css';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Landing page root element is missing.');
}

const landingRoot = rootElement;

let landingHydration: Promise<void> | undefined;

function hydrateLanding(): void {
  landingHydration ??= import('./hydrate')
    .then(({ hydrateLandingPage }) => {
      hydrateLandingPage(landingRoot);
      document.documentElement.dataset.landingEnhanced = 'true';
    })
    .catch(() => undefined);
}

function scheduleLandingHydration(): void {
  const start = (): void => {
    window.removeEventListener('load', start);
    document.removeEventListener('keydown', start, true);
    document.removeEventListener('pointerdown', start, true);
    hydrateLanding();
  };

  window.addEventListener('load', start, { once: true });
  document.addEventListener('keydown', start, { capture: true, once: true });
  document.addEventListener('pointerdown', start, { capture: true, once: true });
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
          captions: { active: true, language: 'en', update: true },
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
enableSectionReveals();
enableDeferredDemoPlayer();
