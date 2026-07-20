import type { LandingLocale } from './content/schema';

export type PlyrLabels = Readonly<
  Record<
    | 'captions'
    | 'enterFullscreen'
    | 'exitFullscreen'
    | 'mute'
    | 'normal'
    | 'pause'
    | 'pip'
    | 'play'
    | 'settings'
    | 'speed'
    | 'unmute'
    | 'volume',
    string
  >
>;

export const plyrLabelsByLocale: Readonly<Record<LandingLocale, PlyrLabels>> = {
  en: {
    captions: 'Captions',
    enterFullscreen: 'Enter fullscreen',
    exitFullscreen: 'Exit fullscreen',
    mute: 'Mute',
    normal: 'Normal',
    pause: 'Pause',
    pip: 'Picture-in-picture',
    play: 'Play',
    settings: 'Settings',
    speed: 'Speed',
    unmute: 'Unmute',
    volume: 'Volume',
  },
  ru: {
    captions: 'Субтитры',
    enterFullscreen: 'Во весь экран',
    exitFullscreen: 'Выйти из полноэкранного режима',
    mute: 'Выключить звук',
    normal: 'Обычная',
    pause: 'Пауза',
    pip: 'Картинка в картинке',
    play: 'Воспроизвести',
    settings: 'Настройки',
    speed: 'Скорость',
    unmute: 'Включить звук',
    volume: 'Громкость',
  },
  be: {
    captions: 'Субцітры',
    enterFullscreen: 'На ўвесь экран',
    exitFullscreen: 'Выйсці з поўнаэкраннага рэжыму',
    mute: 'Выключыць гук',
    normal: 'Звычайная',
    pause: 'Паўза',
    pip: 'Карцінка ў карцінцы',
    play: 'Прайграць',
    settings: 'Налады',
    speed: 'Хуткасць',
    unmute: 'Уключыць гук',
    volume: 'Гучнасць',
  },
  uk: {
    captions: 'Субтитри',
    enterFullscreen: 'На весь екран',
    exitFullscreen: 'Вийти з повноекранного режиму',
    mute: 'Вимкнути звук',
    normal: 'Звичайна',
    pause: 'Пауза',
    pip: 'Зображення в зображенні',
    play: 'Відтворити',
    settings: 'Налаштування',
    speed: 'Швидкість',
    unmute: 'Увімкнути звук',
    volume: 'Гучність',
  },
  es: {
    captions: 'Subtítulos',
    enterFullscreen: 'Pantalla completa',
    exitFullscreen: 'Salir de pantalla completa',
    mute: 'Silenciar',
    normal: 'Normal',
    pause: 'Pausar',
    pip: 'Imagen en imagen',
    play: 'Reproducir',
    settings: 'Configuración',
    speed: 'Velocidad',
    unmute: 'Activar sonido',
    volume: 'Volumen',
  },
  'pt-BR': {
    captions: 'Legendas',
    enterFullscreen: 'Entrar em tela cheia',
    exitFullscreen: 'Sair da tela cheia',
    mute: 'Silenciar',
    normal: 'Normal',
    pause: 'Pausar',
    pip: 'Imagem em imagem',
    play: 'Reproduzir',
    settings: 'Configurações',
    speed: 'Velocidade',
    unmute: 'Ativar som',
    volume: 'Volume',
  },
  'zh-CN': {
    captions: '字幕',
    enterFullscreen: '进入全屏',
    exitFullscreen: '退出全屏',
    mute: '静音',
    normal: '正常',
    pause: '暂停',
    pip: '画中画',
    play: '播放',
    settings: '设置',
    speed: '速度',
    unmute: '取消静音',
    volume: '音量',
  },
  ja: {
    captions: '字幕',
    enterFullscreen: '全画面表示',
    exitFullscreen: '全画面表示を終了',
    mute: 'ミュート',
    normal: '標準',
    pause: '一時停止',
    pip: 'ピクチャーインピクチャー',
    play: '再生',
    settings: '設定',
    speed: '再生速度',
    unmute: 'ミュートを解除',
    volume: '音量',
  },
  de: {
    captions: 'Untertitel',
    enterFullscreen: 'Vollbild öffnen',
    exitFullscreen: 'Vollbild verlassen',
    mute: 'Stummschalten',
    normal: 'Normal',
    pause: 'Pausieren',
    pip: 'Bild-in-Bild',
    play: 'Wiedergabe',
    settings: 'Einstellungen',
    speed: 'Geschwindigkeit',
    unmute: 'Ton einschalten',
    volume: 'Lautstärke',
  },
  fr: {
    captions: 'Sous-titres',
    enterFullscreen: 'Passer en plein écran',
    exitFullscreen: 'Quitter le plein écran',
    mute: 'Couper le son',
    normal: 'Normale',
    pause: 'Mettre en pause',
    pip: 'Image dans l’image',
    play: 'Lire',
    settings: 'Paramètres',
    speed: 'Vitesse',
    unmute: 'Activer le son',
    volume: 'Volume',
  },
  hi: {
    captions: 'उपशीर्षक',
    enterFullscreen: 'पूर्ण स्क्रीन करें',
    exitFullscreen: 'पूर्ण स्क्रीन से बाहर निकलें',
    mute: 'आवाज़ बंद करें',
    normal: 'सामान्य',
    pause: 'रोकें',
    pip: 'पिक्चर-इन-पिक्चर',
    play: 'चलाएँ',
    settings: 'सेटिंग',
    speed: 'गति',
    unmute: 'आवाज़ चालू करें',
    volume: 'आवाज़',
  },
};

export function getPlyrLabels(locale: string): PlyrLabels {
  return plyrLabelsByLocale[locale as LandingLocale] ?? plyrLabelsByLocale.en;
}
