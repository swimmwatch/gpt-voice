import { getDocumentationRoute, getLocaleDefinition } from '../locale-registry';
import type { FutureProviders, LandingContent, LandingLocale, PlannedProvider, ProviderRoute } from '../schema';
import { englishContent } from './en';

type LocalizedProviderRoute = Omit<ProviderRoute, 'id'>;

type LocaleCopy = Omit<LandingContent, 'links' | 'providers'> & {
  providers: Omit<LandingContent['providers'], 'chatGptWeb' | 'future' | 'openAiApi'> & {
    chatGptWeb: LocalizedProviderRoute;
    future: Omit<FutureProviders, 'providers'> & { providers: readonly Omit<PlannedProvider, 'id'>[] };
    openAiApi: LocalizedProviderRoute;
  };
};

function withLocalizedGuideRoute(locale: LandingLocale, content: LocaleCopy): LandingContent {
  const canonicalFaqItems = englishContent.faq.items.map((fallback, index) => ({
    ...fallback,
    ...content.faq.items[index],
    id: fallback.id,
  }));
  const canonicalFutureProviders = englishContent.providers.future.providers.map((fallback, index) => ({
    ...fallback,
    ...content.providers.future.providers[index],
    id: fallback.id,
  }));

  return {
    ...content,
    demo: {
      ...content.demo,
      transcriptCues: content.demo.transcriptCues.map((cue, index) => ({
        ...cue,
        soundCues:
          cue.soundCues.length > 0 ? cue.soundCues : (englishContent.demo.transcriptCues[index]?.soundCues ?? []),
      })),
    },
    faq: {
      ...content.faq,
      items: canonicalFaqItems,
    },
    links: {
      documentation: getDocumentationRoute(getLocaleDefinition(locale)),
      issues: 'https://github.com/swimmwatch/gpt-voice/issues',
      latestRelease: 'https://github.com/swimmwatch/gpt-voice/releases/latest',
      license: 'https://github.com/swimmwatch/gpt-voice/blob/main/LICENSE',
      repository: 'https://github.com/swimmwatch/gpt-voice',
    },
    providers: {
      ...content.providers,
      chatGptWeb: { ...content.providers.chatGptWeb, id: 'chatgpt-web' },
      future: {
        ...content.providers.future,
        providers: canonicalFutureProviders,
      },
      openAiApi: { ...content.providers.openAiApi, id: 'openai-api' },
    },
  };
}

type CompactLocaleCopy = {
  actions: readonly [string, string, string, string];
  currentLanguage: string;
  demo: {
    captions: string;
    cues: readonly [string, string, string, string, string, string, string, string, string];
    lead: string;
    note: string;
    title: string;
    unsupported: string;
    videoLabel: string;
  };
  faq: { eyebrow: string; items: readonly [string, string][]; title: string };
  final: { lead: string; title: string };
  footer: {
    description: string;
    disclaimer: string;
    issues: string;
    license: string;
    releases: string;
    repository: string;
  };
  hero: { badge: string; lead: string; title: string };
  navigation: {
    documentation: string;
    faq: string;
    language: string;
    menuClose: string;
    menuOpen: string;
    providers: string;
    skip: string;
    workflow: string;
  };
  providers: {
    apiKey: string;
    audioInput: string;
    available: string;
    future: string;
    lead: string;
    noApiKey: string;
    planned: string;
    savedSession: string;
    subscription: string;
    title: string;
    usageBased: string;
    voice: string;
  };
  workflow: {
    eyebrow: string;
    lead: string;
    prettify: string;
    record: string;
    retry: string;
    title: string;
    translate: string;
  };
};

/** Expands concise locale copy into the complete landing-content contract. */
function compactLocalizedContent(
  locale: Exclude<LandingLocale, 'en' | 'ru' | 'be'>,
  copy: CompactLocaleCopy,
): LandingContent {
  const [record, retry, translate, prettify] = copy.actions;
  const cueIds = [
    'prompt-problem',
    'product-bridge',
    'transcription-sample',
    'transcription-result',
    'retry',
    'translation',
    'prettify',
    'providers',
    'final-cta',
  ] as const;

  return withLocalizedGuideRoute(locale, {
    metadata: {
      title: `GPT-Voice — ${copy.hero.title}`,
      description: copy.hero.lead,
      socialCardAlt: copy.hero.lead,
    },
    navigation: {
      brand: 'GPT-Voice',
      currentLanguage: copy.currentLanguage,
      documentation: copy.navigation.documentation,
      faq: copy.navigation.faq,
      howItWorks: copy.navigation.workflow,
      language: copy.navigation.language,
      mobileMenu: copy.navigation.menuOpen,
      mobileMenuClose: copy.navigation.menuClose,
      mobileMenuLabel: copy.navigation.menuOpen,
      providers: copy.navigation.providers,
      releaseCta: copy.footer.releases,
      repositoryCta: 'GitHub',
      skipLink: copy.navigation.skip,
    },
    hero: {
      badge: copy.hero.badge,
      lead: copy.hero.lead,
      primaryCta: copy.footer.releases,
      secondaryCta: copy.footer.repository,
      screenshotAlt: copy.hero.lead,
      shortcuts: [
        { action: record, keys: ['F9'] },
        { action: retry, keys: ['Ctrl+F8'] },
        { action: translate, keys: ['F11'] },
        { action: prettify, keys: ['F12'] },
      ],
      shortcutsLabel: copy.navigation.workflow,
      title: copy.hero.title,
    },
    demo: {
      captionTrackLabel: copy.demo.captions,
      eyebrow: copy.workflow.eyebrow,
      lead: copy.demo.lead,
      summary: [record, retry, translate, prettify].join(' · '),
      supportingNote: copy.demo.note,
      title: copy.demo.title,
      transcriptControl: copy.demo.title,
      transcriptCues: cueIds.map((id, index) => ({
        id,
        narration: copy.demo.cues[index],
        soundCues: [],
        visualDescription: copy.demo.cues[index],
      })),
      transcriptRequirement: copy.demo.lead,
      videoLabel: copy.demo.videoLabel,
      videoUnsupported: copy.demo.unsupported,
    },
    workflow: {
      eyebrow: copy.workflow.eyebrow,
      lead: copy.workflow.lead,
      prettify: {
        compactResult: copy.workflow.prettify,
        description: copy.workflow.prettify,
        footnote: copy.workflow.lead,
        id: 'prettify',
        order: '03',
        shortcuts: ['F12', 'Escape'],
        title: prettify,
      },
      retry: {
        comparisonLabel: copy.workflow.retry,
        comparisonNote: copy.workflow.retry,
        compactResult: copy.workflow.retry,
        condition: copy.workflow.retry,
        description: copy.workflow.retry,
        footnote: copy.workflow.lead,
        id: 'retry',
        shortcuts: ['Ctrl+F8'],
        statusLabel: copy.providers.available,
        title: retry,
      },
      title: copy.workflow.title,
      transcribe: {
        compactResult: copy.workflow.record,
        description: copy.workflow.record,
        footnote: copy.workflow.lead,
        id: 'transcribe',
        order: '01',
        shortcuts: ['F9', 'F10', 'Escape'],
        title: record,
      },
      translate: {
        compactNote: copy.workflow.translate,
        compactResult: copy.workflow.translate,
        description: copy.workflow.translate,
        footnote: copy.workflow.lead,
        id: 'translate',
        languages: englishContent.workflow.translate.languages,
        order: '02',
        serviceDetail: englishContent.workflow.translate.serviceDetail,
        shortcuts: ['F11'],
        title: translate,
      },
    },
    providers: {
      availableNow: copy.providers.available,
      chatGptWeb: {
        claim: englishContent.providers.chatGptWeb.claim,
        facts: [copy.providers.subscription, copy.providers.savedSession, copy.providers.noApiKey],
        provider: 'ChatGPT Web',
        qualification: englishContent.providers.chatGptWeb.qualification,
        status: copy.providers.available,
      },
      eyebrow: copy.navigation.providers,
      future: {
        blockLabel: copy.providers.future,
        independenceNote: copy.footer.disclaimer,
        longerTermCopy: englishContent.providers.future.longerTermCopy,
        providers: [
          { provider: 'Claude Web', status: copy.providers.planned },
          { provider: 'Gemini Web', status: copy.providers.planned },
        ],
        qualification: englishContent.providers.future.qualification,
      },
      futureRouteLegend: copy.providers.future,
      groupDescription: copy.providers.lead,
      inputDetail: copy.providers.audioInput,
      inputNode: copy.providers.voice,
      lead: copy.providers.lead,
      openAiApi: {
        facts: ['whisper-1', copy.providers.usageBased, copy.providers.apiKey],
        provider: 'OpenAI API',
        status: copy.providers.available,
      },
      requirementsLabel: copy.providers.lead,
      title: copy.providers.title,
    },
    faq: {
      eyebrow: copy.faq.eyebrow,
      items: copy.faq.items.map(([question, answer], index) => ({ answer, id: `faq-${index + 1}`, question })),
      title: copy.faq.title,
    },
    finalCta: {
      lead: copy.final.lead,
      licenseNote: copy.footer.license,
      primaryCta: copy.footer.releases,
      secondaryCta: copy.footer.repository,
      title: copy.final.title,
    },
    footer: {
      brand: 'GPT-Voice',
      copyright: '© 2026 Dmitry Vasiliev',
      description: copy.footer.description,
      disclaimer: copy.footer.disclaimer,
      links: [
        { href: 'documentation', label: copy.navigation.documentation },
        { href: 'latestRelease', label: copy.footer.releases },
        { href: 'repository', label: copy.footer.repository },
        { href: 'issues', label: copy.footer.issues },
        { href: 'license', label: copy.footer.license },
      ],
    },
  });
}

export const localizedLandingContent = {
  ru: withLocalizedGuideRoute('ru', {
    metadata: {
      title: 'GPT-Voice — голос в текст для быстрых AI-запросов',
      description:
        'Быстрее создавайте запросы для ИИ с помощью голосового ввода. Используйте ChatGPT Web или OpenAI API, повторяйте аудио, переводите выделенный текст и улучшайте формулировки.',
      socialCardAlt: 'Панель команд GPT-Voice рядом с текстом о более быстрых и качественных AI-запросах.',
    },
    navigation: {
      brand: 'GPT-Voice',
      providers: 'Провайдеры',
      howItWorks: 'Как это работает',
      faq: 'Вопросы и ответы',
      documentation: 'Документация',
      language: 'Язык сайта',
      currentLanguage: 'Русский',
      repositoryCta: 'GitHub',
      releaseCta: 'Скачать',
      mobileMenu: 'Открыть навигацию',
      mobileMenuClose: 'Закрыть навигацию',
      mobileMenuLabel: 'Навигация сайта',
      skipLink: 'Перейти к основному содержимому',
    },
    hero: {
      badge: 'Настольная утилита · Windows + Linux',
      title: 'Пишите лучшие AI-запросы быстрее.',
      lead: 'Чёткие, структурированные запросы требуют времени. GPT-Voice превращает речь в готовый для вставки текст, помогает перевести его и убрать грамматические ошибки, повторы и слова-паразиты.',
      primaryCta: 'Скачать последнюю версию',
      secondaryCta: 'Открыть исходный код на GitHub',
      shortcutsLabel: 'Сочетания клавиш',
      shortcuts: [
        { keys: ['F9'], action: 'Запись' },
        { keys: ['Ctrl+F8'], action: 'Повтор' },
        { keys: ['F11'], action: 'Перевод' },
        { keys: ['F12'], action: 'Улучшение' },
      ],
      screenshotAlt:
        'Панель команд GPT-Voice с подключением ChatGPT Web, моделью улучшения текста и статусом скопированного перевода.',
    },
    demo: {
      eyebrow: 'ОДНОМИНУТНАЯ ДЕМОНСТРАЦИЯ',
      title: 'Посмотрите полный рабочий процесс.',
      lead: 'Распознавание, повтор, перевод, улучшение текста и выбор провайдера — в реальном приложении.',
      videoLabel: 'Воспроизвести одноминутную демонстрацию GPT-Voice на английском языке',
      summary: 'Говорите · Повторяйте · Переводите · Улучшайте',
      supportingNote: '60 секунд · 60 кадров/с · английская видеодемонстрация с русскими субтитрами',
      captionTrackLabel: 'Русские субтитры',
      transcriptControl: 'Прочитать описание видеодемонстрации',
      transcriptRequirement: 'Хронологическое описание речи, звуков и важных действий в кадре.',
      videoUnsupported: 'Ваш браузер не поддерживает HTML-видео.',
      transcriptCues: [
        {
          id: 'prompt-problem',
          narration: 'На экране показано, как неясный запрос мешает работе.',
          soundCues: ['Фоновая музыка'],
          visualDescription: 'Черновик запроса содержит пробелы в цели, контексте и формулировках.',
        },
        {
          id: 'product-bridge',
          narration: 'GPT-Voice убирает лишние усилия при вводе.',
          soundCues: ['Короткий сигнал'],
          visualDescription: 'Появляются действия распознавания, повтора, перевода и улучшения.',
        },
        {
          id: 'transcription-sample',
          narration: 'Пользователь записывает голосовой запрос.',
          soundCues: ['Нажатие клавиш'],
          visualDescription: 'F9 начинает запись, F10 завершает её.',
        },
        {
          id: 'transcription-result',
          narration: 'Текст готов к вставке.',
          soundCues: ['Сигнал копирования'],
          visualDescription: 'Результат копируется в буфер обмена.',
        },
        {
          id: 'retry',
          narration: 'При ошибке можно отправить то же аудио повторно.',
          soundCues: ['Сигнал повтора'],
          visualDescription: 'Ctrl+F8 повторно отправляет сохранённое аудио.',
        },
        {
          id: 'translation',
          narration: 'F11 переводит выделенный текст.',
          soundCues: ['Нажатие F11'],
          visualDescription: 'Перевод возвращается в буфер обмена.',
        },
        {
          id: 'prettify',
          narration: 'F12 делает текст чище, сохраняя смысл.',
          soundCues: ['Нажатие F12'],
          visualDescription: 'Убираются ошибки, повторы и слова-паразиты.',
        },
        {
          id: 'providers',
          narration: 'Доступны ChatGPT Web и OpenAI API.',
          soundCues: ['Подтверждающий сигнал'],
          visualDescription: 'Показаны доступные маршруты распознавания и их ограничения.',
        },
        {
          id: 'final-cta',
          narration: 'Пишите лучшие запросы быстрее.',
          soundCues: ['Финальный аккорд'],
          visualDescription: 'Финальная карточка GPT-Voice.',
        },
      ],
    },
    workflow: {
      eyebrow: 'КАК ЭТО РАБОТАЕТ',
      title: 'Три шага к лучшим запросам.',
      lead: 'Распознавайте, переводите и улучшайте текст. Повтор нужен только после ошибки голосового провайдера.',
      transcribe: {
        id: 'transcribe',
        order: '01',
        title: 'Распознавайте',
        description:
          'Нажмите F9, чтобы начать говорить. Нажмите F9 для паузы, F10 для остановки или Escape для отмены.',
        compactResult: 'Скопировано в буфер · сохранено в локальной истории',
        shortcuts: ['F9', 'F10', 'Escape'],
        footnote: 'Удалённое распознавание; локальная модель Whisper и GPU не требуются.',
      },
      retry: {
        id: 'retry',
        statusLabel: 'НЕОБЯЗАТЕЛЬНО · ОШИБКА ПРОВАЙДЕРА',
        title: 'Повторите',
        condition: 'Только если голосовой провайдер вернул ошибку.',
        description: 'Нажмите Ctrl+F8, чтобы снова отправить последнее аудио из памяти.',
        compactResult: 'Повторная отправка сохранённого аудио',
        shortcuts: ['Ctrl+F8'],
        comparisonLabel: 'GPT-Voice: отправить то же аудио',
        comparisonNote: 'ChatGPT Web: записать заново',
        footnote: 'Доступно, пока новая запись не заменит аудио или приложение не будет перезапущено.',
      },
      translate: {
        id: 'translate',
        order: '02',
        title: 'Переводите для модели',
        description: 'Переведите запрос на язык, подходящий модели или задаче, не открывая отдельный переводчик.',
        compactResult: 'Выделенный текст → перевод → буфер обмена',
        compactNote: 'Без отдельного переводчика',
        shortcuts: ['F11'],
        languages: 'Английский · Русский · Украинский · Белорусский',
        footnote: 'Перевод можно включить или отключить в настройках.',
        serviceDetail:
          'Для этой функции GPT-Voice использует Google Translate. Пользователь выбирает и проверяет целевой язык.',
      },
      prettify: {
        id: 'prettify',
        order: '03',
        title: 'Улучшайте текст',
        description: 'Уберите грамматические ошибки, повторы и слова-паразиты, сохраняя инструкции и смысл запроса.',
        compactResult: 'Исправить грамматику, повторы и слова-паразиты',
        shortcuts: ['F12', 'Escape'],
        footnote: 'Выберите модель, промпт, температуру и расширенные параметры генерации.',
      },
    },
    providers: {
      eyebrow: 'ПРОВАЙДЕРЫ РАСПОЗНАВАНИЯ',
      title: 'Два способа превратить речь в запрос.',
      lead: 'Выберите веб-сеанс с подпиской или API с оплатой за использование.',
      inputNode: 'ВАШ ГОЛОС',
      inputDetail: 'Аудиовход',
      requirementsLabel: 'требования',
      availableNow: 'Доступно сейчас',
      futureRouteLegend: 'Будущее · недоступно',
      groupDescription: 'Оба поддерживаемых маршрута распознавания подключены к одному источнику голоса.',
      chatGptWeb: {
        provider: 'ChatGPT Web',
        status: 'Доступно сейчас',
        facts: ['Подписка', 'Сохранённая сессия', 'Без API-ключа'],
        claim: 'Качественное, практически неограниченное распознавание*',
        qualification:
          'Зависит от тарифа ChatGPT, доступности, правил добросовестного использования и лимитов провайдера. GPT-Voice не обходит квоты.',
      },
      openAiApi: {
        provider: 'OpenAI API',
        status: 'Доступно сейчас',
        facts: ['whisper-1', 'Оплата за использование', 'API-ключ, биллинг или квота'],
      },
      future: {
        blockLabel: 'ПЕРСПЕКТИВА · НЕДОСТУПНО',
        providers: [
          { provider: 'Claude Web', status: 'Планируется' },
          { provider: 'Gemini Web', status: 'Планируется' },
        ],
        longerTermCopy: 'Другие провайдеры могут появиться, если это будет технически и юридически возможно.',
        qualification: 'Совместимость и сроки не обещаются.',
        independenceNote: 'GPT-Voice независим и не связан с OpenAI, Anthropic или Google.',
      },
    },
    faq: {
      eyebrow: 'ВОПРОСЫ И ОТВЕТЫ',
      title: 'Как работает GPT-Voice.',
      items: [
        {
          id: 'record-and-transcribe',
          question: 'Как записать и распознать речь?',
          answer:
            'Нажмите F9 для записи, F10 для остановки и отправки, либо Escape для отмены. Успешный результат копируется в буфер и добавляется в локальную историю.',
        },
        {
          id: 'transcription-providers',
          question: 'Какие провайдеры доступны?',
          answer:
            'Сейчас доступны ChatGPT Web и OpenAI API. Для ChatGPT Web используется сохранённая сессия, а для OpenAI API нужен собственный ключ с биллингом или квотой.',
        },
        {
          id: 'retry',
          question: 'Можно повторить запрос без новой записи?',
          answer:
            'Да. После ошибки провайдера Ctrl+F8 повторно отправляет то же аудио из памяти. Новая запись заменяет этот кэш.',
        },
        {
          id: 'translation',
          question: 'Как работает перевод выделенного текста?',
          answer:
            'Выделите текст и нажмите F11. GPT-Voice отправит его в Google Translate и скопирует перевод в буфер обмена. Проверьте результат перед использованием.',
        },
        {
          id: 'prettify',
          question: 'Что делает улучшение текста?',
          answer:
            'Нажмите F12 для обработки выбранного текста в Ollama или vLLM. Функция убирает ошибки, повторы и слова-паразиты, сохраняя смысл; результат следует проверить.',
        },
      ],
    },
    finalCta: {
      title: 'Пишите лучшие запросы быстрее и с меньшими усилиями.',
      lead: 'Говорите естественно, переводите запрос для модели или задачи и очищайте черновой текст без лишних инструментов.',
      primaryCta: 'Скачать последнюю версию',
      secondaryCta: 'Открыть исходный код на GitHub',
      licenseNote: 'Исходный код доступен по лицензии PolyForm Noncommercial 1.0.0.',
    },
    footer: {
      brand: 'GPT-Voice',
      description: 'Голосовой ввод для более качественных AI-запросов.',
      links: [
        { label: 'Документация', href: 'documentation' },
        { label: 'Релизы', href: 'latestRelease' },
        { label: 'Репозиторий', href: 'repository' },
        { label: 'Проблемы', href: 'issues' },
        { label: 'Лицензия', href: 'license' },
      ],
      disclaimer: 'Независимый проект. Не связан с OpenAI, Anthropic или Google.',
      copyright: '© 2026 Dmitry Vasiliev',
    },
  }),
  be: withLocalizedGuideRoute('be', {
    metadata: {
      title: 'GPT-Voice — голас у тэкст для хуткіх AI-запытаў',
      description:
        'Стварайце AI-запыты хутчэй з настольным галасавым уводам. Выкарыстоўвайце ChatGPT Web або OpenAI API, паўтарайце аўдыё, перакладайце вылучаны тэкст і паляпшайце фармулёўкі.',
      socialCardAlt: 'Панэль каманд GPT-Voice побач з тэкстам пра хутчэйшыя і лепшыя AI-запыты.',
    },
    navigation: {
      brand: 'GPT-Voice',
      providers: 'Пастаўшчыкі',
      howItWorks: 'Як гэта працуе',
      faq: 'Пытанні і адказы',
      documentation: 'Дакументацыя',
      language: 'Мова сайта',
      currentLanguage: 'Беларуская',
      repositoryCta: 'GitHub',
      releaseCta: 'Спампаваць',
      mobileMenu: 'Адкрыць навігацыю',
      mobileMenuClose: 'Закрыць навігацыю',
      mobileMenuLabel: 'Навігацыя сайта',
      skipLink: 'Перайсці да асноўнага змесціва',
    },
    hero: {
      badge: 'Настольная ўтыліта · Windows + Linux',
      title: 'Пішыце лепшыя AI-запыты хутчэй.',
      lead: 'Выразныя структураваныя запыты патрабуюць часу. GPT-Voice ператварае маўленне ў гатовы тэкст, дапамагае перакласці яго і прыбраць граматычныя памылкі, паўторы і словы-паразіты.',
      primaryCta: 'Спампаваць апошні рэліз',
      secondaryCta: 'Адкрыць зыходны код на GitHub',
      shortcutsLabel: 'Спалучэнні клавіш',
      shortcuts: [
        { keys: ['F9'], action: 'Запіс' },
        { keys: ['Ctrl+F8'], action: 'Паўтор' },
        { keys: ['F11'], action: 'Пераклад' },
        { keys: ['F12'], action: 'Паляпшэнне' },
      ],
      screenshotAlt:
        'Панэль каманд GPT-Voice з ChatGPT Web, мадэллю паляпшэння тэксту і статусам скапіяванага перакладу.',
    },
    demo: {
      eyebrow: 'ДЭМАНСТРАЦЫЯ НА АДНУ ХВІЛІНУ',
      title: 'Паглядзіце ўвесь працоўны працэс.',
      lead: 'Распазнаванне, паўтор, пераклад, паляпшэнне тэксту і выбар пастаўшчыка — у рэальным дадатку.',
      videoLabel: 'Прайграць англамоўную аднахвілінную дэманстрацыю GPT-Voice',
      summary: 'Гаварыце · Паўтарайце · Перакладайце · Паляпшайце',
      supportingNote: '60 секунд · 60 кадраў/с · англамоўная відэадэманстрацыя з беларускімі субтытрамі',
      captionTrackLabel: 'Беларускія субтытры',
      transcriptControl: 'Прачытаць апісанне відэадэманстрацыі',
      transcriptRequirement: 'Храналагічнае апісанне маўлення, гукаў і важных дзеянняў у кадры.',
      videoUnsupported: 'Ваш браўзер не падтрымлівае HTML-відэа.',
      transcriptCues: [
        {
          id: 'prompt-problem',
          narration: 'На экране відаць, як няясны запыт перашкаджае працы.',
          soundCues: ['Фонавая музыка'],
          visualDescription: 'Чарнавік мае прабелы ў мэце, кантэксце і фармулёўках.',
        },
        {
          id: 'product-bridge',
          narration: 'GPT-Voice спрашчае ўвод.',
          soundCues: ['Кароткі сігнал'],
          visualDescription: 'З’яўляюцца дзеянні распазнавання, паўтору, перакладу і паляпшэння.',
        },
        {
          id: 'transcription-sample',
          narration: 'Карыстальнік запісвае галасавы запыт.',
          soundCues: ['Націск клавіш'],
          visualDescription: 'F9 пачынае запіс, F10 яго заканчвае.',
        },
        {
          id: 'transcription-result',
          narration: 'Тэкст гатовы да ўстаўкі.',
          soundCues: ['Сігнал капіявання'],
          visualDescription: 'Вынік капіруецца ў буфер абмену.',
        },
        {
          id: 'retry',
          narration: 'Пасля памылкі можна паўторна адправіць тое ж аўдыё.',
          soundCues: ['Сігнал паўтору'],
          visualDescription: 'Ctrl+F8 паўторна адпраўляе захаванае аўдыё.',
        },
        {
          id: 'translation',
          narration: 'F11 перакладае вылучаны тэкст.',
          soundCues: ['Націск F11'],
          visualDescription: 'Пераклад вяртаецца ў буфер абмену.',
        },
        {
          id: 'prettify',
          narration: 'F12 ачышчае тэкст, захоўваючы сэнс.',
          soundCues: ['Націск F12'],
          visualDescription: 'Прыбіраюцца памылкі, паўторы і словы-паразіты.',
        },
        {
          id: 'providers',
          narration: 'Даступныя ChatGPT Web і OpenAI API.',
          soundCues: ['Сігнал пацвярджэння'],
          visualDescription: 'Паказаны даступныя маршруты распазнавання і іх абмежаванні.',
        },
        {
          id: 'final-cta',
          narration: 'Пішыце лепшыя запыты хутчэй.',
          soundCues: ['Фінальны акорд'],
          visualDescription: 'Фінальная картка GPT-Voice.',
        },
      ],
    },
    workflow: {
      eyebrow: 'ЯК ГЭТА ПРАЦУЕ',
      title: 'Тры крокі да лепшых запытаў.',
      lead: 'Распазнавайце, перакладайце і паляпшайце тэкст. Паўтор патрэбны толькі пасля памылкі галасавога пастаўшчыка.',
      transcribe: {
        id: 'transcribe',
        order: '01',
        title: 'Распазнавайце',
        description: 'Націсніце F9, каб пачаць гаварыць. F9 ставіць на паўзу, F10 спыняе, Escape адмяняе.',
        compactResult: 'Скапіявана ў буфер · захавана ў лакальнай гісторыі',
        shortcuts: ['F9', 'F10', 'Escape'],
        footnote: 'Аддаленае распазнаванне; лакальная мадэль Whisper і GPU не патрэбныя.',
      },
      retry: {
        id: 'retry',
        statusLabel: 'НЕАБАВЯЗКОВА · ПАМЫЛКА ПАСТАЎШЧЫКА',
        title: 'Паўтарыце',
        condition: 'Толькі калі галасавы пастаўшчык вярнуў памылку.',
        description: 'Націсніце Ctrl+F8, каб паўторна адправіць апошняе аўдыё з памяці.',
        compactResult: 'Паўторная адпраўка захаванага аўдыё',
        shortcuts: ['Ctrl+F8'],
        comparisonLabel: 'GPT-Voice: адправіць тое ж аўдыё',
        comparisonNote: 'ChatGPT Web: запісаць наноў',
        footnote: 'Даступна, пакуль новы запіс не заменіць аўдыё або дадатак не перазапусціцца.',
      },
      translate: {
        id: 'translate',
        order: '02',
        title: 'Перакладайце для мадэлі',
        description: 'Перакладзіце запыт на мову, якая пасуе мадэлі або задачы, без асобнага перакладчыка.',
        compactResult: 'Вылучаны тэкст → пераклад → буфер абмену',
        compactNote: 'Без асобнага перакладчыка',
        shortcuts: ['F11'],
        languages: 'Англійская · Руская · Украінская · Беларуская',
        footnote: 'Пераклад можна ўключыць або выключыць у наладах.',
        serviceDetail:
          'Для гэтай функцыі GPT-Voice выкарыстоўвае Google Translate. Карыстальнік выбірае і правярае мэтавую мову.',
      },
      prettify: {
        id: 'prettify',
        order: '03',
        title: 'Паляпшайце тэкст',
        description: 'Прыбярыце граматычныя памылкі, паўторы і словы-паразіты, захоўваючы інструкцыі і сэнс.',
        compactResult: 'Выправіць граматыку, паўторы і словы-паразіты',
        shortcuts: ['F12', 'Escape'],
        footnote: 'Выберыце мадэль, промпт, тэмпературу і дадатковыя параметры генерацыі.',
      },
    },
    providers: {
      eyebrow: 'ПАСТАЎШЧЫКІ РАСПАЗНАВАННЯ',
      title: 'Два спосабы ператварыць маўленне ў запыт.',
      lead: 'Выберыце вэб-сеанс з падпіскай або API з аплатай за выкарыстанне.',
      inputNode: 'ВАШ ГОЛАС',
      inputDetail: 'Аўдыяўвод',
      requirementsLabel: 'патрабаванні',
      availableNow: 'Даступна зараз',
      futureRouteLegend: 'Будучыня · недаступна',
      groupDescription: 'Абодва падтрыманыя маршруты распазнавання падключаны да аднаго крыніцы голасу.',
      chatGptWeb: {
        provider: 'ChatGPT Web',
        status: 'Даступна зараз',
        facts: ['Падпіска', 'Захаваная сесія', 'Без API-ключа'],
        claim: 'Якаснае, практычна неабмежаванае распазнаванне*',
        qualification:
          'Залежыць ад плана ChatGPT, даступнасці, правілаў добрасумленнага выкарыстання і лімітаў пастаўшчыка. GPT-Voice не абыходзіць квоты.',
      },
      openAiApi: {
        provider: 'OpenAI API',
        status: 'Даступна зараз',
        facts: ['whisper-1', 'Аплата за выкарыстанне', 'API-ключ, білінг або квота'],
      },
      future: {
        blockLabel: 'БУДУЧЫНЯ · НЕДАСТУПНА',
        providers: [
          { provider: 'Claude Web', status: 'Плануецца' },
          { provider: 'Gemini Web', status: 'Плануецца' },
        ],
        longerTermCopy: 'Іншыя пастаўшчыкі могуць з’явіцца, калі гэта будзе тэхнічна і юрыдычна магчыма.',
        qualification: 'Сумяшчальнасць і тэрміны не абяцаюцца.',
        independenceNote: 'GPT-Voice незалежны і не звязаны з OpenAI, Anthropic або Google.',
      },
    },
    faq: {
      eyebrow: 'ПЫТАННІ І АДКАЗЫ',
      title: 'Як працуе GPT-Voice.',
      items: [
        {
          id: 'record-and-transcribe',
          question: 'Як запісаць і распазнаць маўленне?',
          answer:
            'Націсніце F9 для запісу, F10 для спынення і адпраўкі або Escape для адмены. Паспяховы вынік капіруецца ў буфер і дадаецца ў лакальную гісторыю.',
        },
        {
          id: 'transcription-providers',
          question: 'Якія пастаўшчыкі даступныя?',
          answer:
            'Цяпер даступныя ChatGPT Web і OpenAI API. ChatGPT Web выкарыстоўвае захаваную сесію, а OpenAI API патрабуе ўласны ключ з білінгам або квотай.',
        },
        {
          id: 'retry',
          question: 'Ці можна паўтарыць без новага запісу?',
          answer:
            'Так. Пасля памылкі пастаўшчыка Ctrl+F8 паўторна адпраўляе тое ж аўдыё з памяці; новы запіс замяняе кэш.',
        },
        {
          id: 'translation',
          question: 'Як працуе пераклад вылучанага тэксту?',
          answer:
            'Вылучыце тэкст і націсніце F11. GPT-Voice адправіць яго ў Google Translate і скапіюе пераклад у буфер. Праверце вынік перад выкарыстаннем.',
        },
        {
          id: 'prettify',
          question: 'Што робіць паляпшэнне тэксту?',
          answer:
            'Націсніце F12 для апрацоўкі вылучанага тэксту ў Ollama або vLLM. Функцыя прыбірае памылкі, паўторы і словы-паразіты, захоўваючы сэнс; вынік трэба праверыць.',
        },
      ],
    },
    finalCta: {
      title: 'Пішыце лепшыя запыты хутчэй і з меншымі намаганнямі.',
      lead: 'Гаварыце натуральна, перакладайце запыт для мадэлі або задачы і ачышчайце чарнавы тэкст без лішніх інструментаў.',
      primaryCta: 'Спампаваць апошні рэліз',
      secondaryCta: 'Адкрыць зыходны код на GitHub',
      licenseNote: 'Зыходны код даступны паводле ліцэнзіі PolyForm Noncommercial 1.0.0.',
    },
    footer: {
      brand: 'GPT-Voice',
      description: 'Галасавы ўвод для лепшых AI-запытаў.',
      links: [
        { label: 'Дакументацыя', href: 'documentation' },
        { label: 'Рэлізы', href: 'latestRelease' },
        { label: 'Рэпазітарый', href: 'repository' },
        { label: 'Праблемы', href: 'issues' },
        { label: 'Ліцэнзія', href: 'license' },
      ],
      disclaimer: 'Незалежны праект. Не звязаны з OpenAI, Anthropic або Google.',
      copyright: '© 2026 Dmitry Vasiliev',
    },
  }),
  uk: compactLocalizedContent('uk', {
    currentLanguage: 'Українська',
    navigation: {
      providers: 'Провайдери',
      workflow: 'Як це працює',
      faq: 'Запитання й відповіді',
      documentation: 'Документація',
      language: 'Мова сайту',
      menuOpen: 'Відкрити навігацію',
      menuClose: 'Закрити навігацію',
      skip: 'Перейти до основного вмісту',
    },
    hero: {
      badge: 'Настільна утиліта · Windows + Linux',
      title: 'Пишіть кращі AI-запити швидше.',
      lead: 'GPT-Voice перетворює мовлення на готовий текст для запитів, допомагає перекладати виділений текст і прибирати граматичні помилки, повтори та зайві слова.',
    },
    actions: ['Запис', 'Повтор', 'Переклад', 'Покращення'],
    demo: {
      title: 'Перегляньте повний робочий процес.',
      lead: 'Розпізнавання, повтор, переклад, покращення тексту та вибір провайдера показано в реальному застосунку.',
      videoLabel: 'Відтворити англомовну одноминутну демонстрацію GPT-Voice',
      note: '60 секунд · 60 кадрів/с · англомовне відео з українськими субтитрами',
      captions: 'Українські субтитри',
      unsupported: 'Ваш браузер не підтримує HTML-відео.',
      cues: [
        'Нечіткі запити уповільнюють роботу: може бракувати мети, контексту та критеріїв.',
        'GPT-Voice прибирає зайві труднощі введення, не вигадуючи вашого наміру.',
        'Скажіть: «Переглянь цей pull request і підсумуй три найважливіші ризики».',
        'Розпізнаний текст скопійовано до буфера й вставлено до чернетки.',
        'У разі помилки Ctrl+F8 повторно надсилає те саме аудіо без нового запису.',
        'F11 перекладає виділений текст мовою, обраною для моделі чи завдання.',
        'F12 прибирає граматичні помилки, повтори й зайві слова, зберігаючи зміст.',
        'Показано ChatGPT Web: збережена сесія, без API-ключа, у межах лімітів постачальника.',
        'Пишіть кращі запити швидше й з меншими зусиллями.',
      ],
    },
    workflow: {
      eyebrow: 'ЯК ЦЕ ПРАЦЮЄ',
      title: 'Три кроки до кращих запитів.',
      lead: 'Розпізнавайте, перекладайте та покращуйте текст. Повтор потрібен лише після помилки голосового провайдера.',
      record:
        'Натисніть F9, щоб почати запис; F10 — щоб зупинити, Escape — щоб скасувати. Успішний результат копіюється до буфера й локальної історії.',
      retry: 'Після помилки провайдера Ctrl+F8 повторно надсилає те саме аудіо з пам’яті без нового запису.',
      translate:
        'Виділіть текст і натисніть F11, щоб перекласти його через Google Translate та скопіювати результат до буфера.',
      prettify: 'Виділіть текст і натисніть F12, щоб очистити його в Ollama або vLLM, зберігаючи зміст.',
    },
    providers: {
      title: 'Два способи перетворити мовлення на запит.',
      lead: 'Оберіть вебсеанс із передплатою або API з оплатою за використання.',
      voice: 'ВАШ ГОЛОС',
      audioInput: 'Аудіовхід',
      available: 'Доступно зараз',
      future: 'Майбутнє · недоступно',
      subscription: 'Передплата',
      savedSession: 'Збережена сесія',
      noApiKey: 'Без API-ключа',
      usageBased: 'Оплата за використання',
      apiKey: 'API-ключ, білінг або квота',
      planned: 'Заплановано',
    },
    faq: {
      eyebrow: 'ЗАПИТАННЯ Й ВІДПОВІДІ',
      title: 'Як працює GPT-Voice.',
      items: [
        [
          'Як записати й розпізнати мовлення?',
          'Натисніть F9 для запису, F10 для зупинки та надсилання або Escape для скасування. Результат копіюється до буфера й локальної історії.',
        ],
        [
          'Які провайдери доступні?',
          'Зараз доступні ChatGPT Web і OpenAI API. ChatGPT Web використовує збережену сесію, а OpenAI API потребує ваш ключ із білінгом або квотою.',
        ],
        [
          'Чи можна повторити без нового запису?',
          'Так. Після помилки Ctrl+F8 повторно надсилає аудіо з пам’яті; новий запис замінює цей кеш.',
        ],
        [
          'Як працює переклад?',
          'Виділіть текст, натисніть F11 і перевірте переклад, який GPT-Voice копіює до буфера обміну.',
        ],
        [
          'Що робить покращення тексту?',
          'F12 надсилає виділений текст до налаштованого Ollama або vLLM, прибирає помилки, повтори й зайві слова. Перевірте отриманий результат.',
        ],
      ],
    },
    final: {
      title: 'Пишіть кращі запити швидше й з меншими зусиллями.',
      lead: 'Говоріть природно, перекладайте запит для моделі чи завдання та очищуйте чернетку без зайвих інструментів.',
    },
    footer: {
      description: 'Голосовий ввід для кращих AI-запитів.',
      disclaimer: 'Незалежний проєкт. Не пов’язаний з OpenAI, Anthropic або Google.',
      releases: 'Завантажити',
      repository: 'Репозиторій',
      issues: 'Проблеми',
      license: 'Ліцензія PolyForm Noncommercial 1.0.0',
    },
  }),
  es: compactLocalizedContent('es', {
    currentLanguage: 'Español',
    navigation: {
      providers: 'Proveedores',
      workflow: 'Cómo funciona',
      faq: 'Preguntas frecuentes',
      documentation: 'Documentación',
      language: 'Idioma del sitio',
      menuOpen: 'Abrir navegación',
      menuClose: 'Cerrar navegación',
      skip: 'Ir al contenido principal',
    },
    hero: {
      badge: 'Utilidad de escritorio · Windows + Linux',
      title: 'Escribe mejores instrucciones para IA más rápido.',
      lead: 'GPT-Voice convierte la voz en texto listo para instrucciones, permite traducir texto seleccionado y ayuda a eliminar errores gramaticales, repeticiones y palabras de relleno.',
    },
    actions: ['Grabar', 'Reintentar', 'Traducir', 'Mejorar'],
    demo: {
      title: 'Consulta el flujo de trabajo completo.',
      lead: 'Transcripción, reintento, traducción, mejora de texto y elección de proveedor en la aplicación real.',
      videoLabel: 'Reproducir la demostración de un minuto de GPT-Voice en inglés',
      note: '60 segundos · 60 fps · vídeo en inglés con subtítulos en español',
      captions: 'Subtítulos en español',
      unsupported: 'Tu navegador no admite vídeo HTML.',
      cues: [
        'Las instrucciones poco claras interrumpen el flujo: pueden faltar objetivo, contexto y criterios.',
        'GPT-Voice elimina fricción al escribir sin inventar tu intención.',
        'Di: «Revisa esta solicitud de cambios y resume los tres riesgos más importantes».',
        'El texto transcrito se copia al portapapeles y se pega en el borrador.',
        'Si falla, Ctrl+F8 reenvía el mismo audio sin volver a grabarlo.',
        'F11 traduce el texto seleccionado al idioma elegido para el modelo o la tarea.',
        'F12 elimina errores gramaticales, repeticiones y relleno sin cambiar el significado.',
        'Se muestra ChatGPT Web: sesión guardada, sin clave API y dentro de los límites del proveedor.',
        'Escribe mejores instrucciones más rápido y con menos esfuerzo.',
      ],
    },
    workflow: {
      eyebrow: 'CÓMO FUNCIONA',
      title: 'Tres pasos para mejores instrucciones.',
      lead: 'Transcribe, traduce y mejora. Solo reintenta después de un error del proveedor de voz.',
      record:
        'Pulsa F9 para grabar, F10 para detener y Escape para cancelar. El resultado se copia al portapapeles y al historial local.',
      retry:
        'Después de un error del proveedor, Ctrl+F8 vuelve a enviar el mismo audio almacenado sin grabarlo otra vez.',
      translate:
        'Selecciona texto y pulsa F11 para traducirlo con Google Translate y copiar el resultado al portapapeles.',
      prettify: 'Selecciona texto y pulsa F12 para limpiarlo mediante Ollama o vLLM sin perder su significado.',
    },
    providers: {
      title: 'Dos formas de convertir voz en instrucciones.',
      lead: 'Elige una sesión web con suscripción o una API de pago por uso.',
      voice: 'TU VOZ',
      audioInput: 'Entrada de audio',
      available: 'Disponible ahora',
      future: 'Futuro · no disponible',
      subscription: 'Suscripción',
      savedSession: 'Sesión guardada',
      noApiKey: 'Sin clave API',
      usageBased: 'Pago por uso',
      apiKey: 'Clave API, facturación o cuota',
      planned: 'Planeado',
    },
    faq: {
      eyebrow: 'PREGUNTAS FRECUENTES',
      title: 'Cómo funciona GPT-Voice.',
      items: [
        [
          '¿Cómo grabo y transcribo voz?',
          'Pulsa F9 para grabar, F10 para detener y enviar, o Escape para cancelar. Un resultado correcto se copia al portapapeles y al historial local.',
        ],
        [
          '¿Qué proveedores puedo usar?',
          'ChatGPT Web y OpenAI API están disponibles. ChatGPT Web usa una sesión guardada; OpenAI API necesita una clave propia con facturación o cuota.',
        ],
        [
          '¿Puedo reintentar sin grabar de nuevo?',
          'Sí. Tras un error, Ctrl+F8 vuelve a enviar el audio de la memoria. Una grabación nueva sustituye la caché.',
        ],
        [
          '¿Cómo funciona la traducción?',
          'Selecciona texto, pulsa F11 y revisa la traducción que GPT-Voice copia al portapapeles.',
        ],
        [
          '¿Qué hace Mejorar?',
          'F12 procesa el texto seleccionado con Ollama o vLLM para quitar errores, repeticiones y relleno. Revisa el resultado generado.',
        ],
      ],
    },
    final: {
      title: 'Escribe mejores instrucciones más rápido y con menos esfuerzo.',
      lead: 'Habla con naturalidad, traduce para el modelo o la tarea y limpia borradores sin abrir más herramientas.',
    },
    footer: {
      description: 'Voz a texto para mejores instrucciones de IA.',
      disclaimer: 'Proyecto independiente. No está afiliado a OpenAI, Anthropic ni Google.',
      releases: 'Descargar',
      repository: 'Repositorio',
      issues: 'Problemas',
      license: 'Licencia PolyForm Noncommercial 1.0.0',
    },
  }),
  'pt-BR': compactLocalizedContent('pt-BR', {
    currentLanguage: 'Português (Brasil)',
    navigation: {
      providers: 'Provedores',
      workflow: 'Como funciona',
      faq: 'Perguntas frequentes',
      documentation: 'Documentação',
      language: 'Idioma do site',
      menuOpen: 'Abrir navegação',
      menuClose: 'Fechar navegação',
      skip: 'Ir para o conteúdo principal',
    },
    hero: {
      badge: 'Utilitário para desktop · Windows + Linux',
      title: 'Escreva prompts de IA melhores mais rápido.',
      lead: 'O GPT-Voice transforma fala em texto pronto para prompts, traduz o texto selecionado e ajuda a remover erros gramaticais, repetições e palavras desnecessárias.',
    },
    actions: ['Gravar', 'Tentar novamente', 'Traduzir', 'Aprimorar'],
    demo: {
      title: 'Veja o fluxo de trabalho completo.',
      lead: 'Transcrição, nova tentativa, tradução, aprimoramento de texto e escolha de provedor no aplicativo real.',
      videoLabel: 'Reproduzir a demonstração de um minuto do GPT-Voice em inglês',
      note: '60 segundos · 60 fps · vídeo em inglês com legendas em português',
      captions: 'Legendas em português',
      unsupported: 'Seu navegador não oferece suporte a vídeo HTML.',
      cues: [
        'Prompts pouco claros quebram o fluxo: podem faltar objetivo, contexto e critérios.',
        'O GPT-Voice reduz o atrito da digitação sem inventar sua intenção.',
        'Diga: «Revise este pull request e resuma os três riscos mais importantes».',
        'O texto transcrito é copiado para a área de transferência e colado no rascunho.',
        'Se houver falha, Ctrl+F8 reenvia o mesmo áudio sem gravar novamente.',
        'F11 traduz o texto selecionado para o idioma escolhido para o modelo ou a tarefa.',
        'F12 remove erros gramaticais, repetições e excesso de palavras, preservando o significado.',
        'O ChatGPT Web aparece com sessão salva, sem chave de API e dentro dos limites do provedor.',
        'Escreva prompts melhores mais rápido e com menos esforço.',
      ],
    },
    workflow: {
      eyebrow: 'COMO FUNCIONA',
      title: 'Três passos para prompts melhores.',
      lead: 'Transcreva, traduza e aprimore. Tente novamente apenas após um erro do provedor de voz.',
      record:
        'Pressione F9 para gravar, F10 para parar e Escape para cancelar. O resultado é copiado para a área de transferência e o histórico local.',
      retry: 'Após um erro do provedor, Ctrl+F8 envia novamente o mesmo áudio armazenado sem uma nova gravação.',
      translate: 'Selecione um texto e pressione F11 para traduzi-lo com Google Translate e copiar o resultado.',
      prettify: 'Selecione um texto e pressione F12 para limpá-lo com Ollama ou vLLM, preservando o significado.',
    },
    providers: {
      title: 'Duas formas de transformar fala em prompts.',
      lead: 'Escolha uma sessão web por assinatura ou uma API com cobrança por uso.',
      voice: 'SUA VOZ',
      audioInput: 'Entrada de áudio',
      available: 'Disponível agora',
      future: 'Futuro · indisponível',
      subscription: 'Assinatura',
      savedSession: 'Sessão salva',
      noApiKey: 'Sem chave de API',
      usageBased: 'Cobrança por uso',
      apiKey: 'Chave de API, cobrança ou cota',
      planned: 'Planejado',
    },
    faq: {
      eyebrow: 'PERGUNTAS FREQUENTES',
      title: 'Como o GPT-Voice funciona.',
      items: [
        [
          'Como gravo e transcrevo a fala?',
          'Pressione F9 para gravar, F10 para parar e enviar ou Escape para cancelar. O resultado é copiado para a área de transferência e o histórico local.',
        ],
        [
          'Quais provedores estão disponíveis?',
          'ChatGPT Web e OpenAI API estão disponíveis. O ChatGPT Web usa uma sessão salva; a OpenAI API exige uma chave própria com cobrança ou cota.',
        ],
        [
          'Posso tentar novamente sem gravar?',
          'Sim. Depois de um erro, Ctrl+F8 reenvia o áudio da memória. Uma nova gravação substitui o cache.',
        ],
        [
          'Como funciona a tradução?',
          'Selecione o texto, pressione F11 e revise a tradução que o GPT-Voice copia para a área de transferência.',
        ],
        [
          'O que o Aprimorar faz?',
          'F12 processa o texto selecionado com Ollama ou vLLM para remover erros, repetições e excesso de palavras. Revise o resultado.',
        ],
      ],
    },
    final: {
      title: 'Escreva prompts melhores mais rápido e com menos esforço.',
      lead: 'Fale naturalmente, traduza para o modelo ou tarefa e limpe rascunhos sem abrir mais ferramentas.',
    },
    footer: {
      description: 'Voz para texto para melhores prompts de IA.',
      disclaimer: 'Projeto independente. Não é afiliado à OpenAI, Anthropic ou Google.',
      releases: 'Baixar',
      repository: 'Repositório',
      issues: 'Problemas',
      license: 'Licença PolyForm Noncommercial 1.0.0',
    },
  }),
  'zh-CN': compactLocalizedContent('zh-CN', {
    currentLanguage: '简体中文',
    navigation: {
      providers: '服务提供商',
      workflow: '工作原理',
      faq: '常见问题',
      documentation: '文档',
      language: '网站语言',
      menuOpen: '打开导航',
      menuClose: '关闭导航',
      skip: '跳到主要内容',
    },
    hero: {
      badge: '桌面工具 · Windows + Linux',
      title: '更快地编写更好的 AI 提示词。',
      lead: 'GPT-Voice 可将语音转换为可直接使用的提示词文本，翻译选中文本，并帮助去除语法错误、重复和冗余表达。',
    },
    actions: ['录音', '重试', '翻译', '润色'],
    demo: {
      title: '查看完整工作流程。',
      lead: '真实应用中的转录、重试、翻译、文本润色和服务提供商选择。',
      videoLabel: '播放英文版 GPT-Voice 一分钟演示',
      note: '60 秒 · 60 fps · 英语视频，配简体中文字幕',
      captions: '简体中文字幕',
      unsupported: '您的浏览器不支持 HTML 视频。',
      cues: [
        '不清晰的提示词会打断工作流程：可能缺少目标、上下文和成功标准。',
        'GPT-Voice 减少输入阻力，但不会臆造您的意图。',
        '说出：“审查这个拉取请求，并总结三个最重要的风险。”',
        '转录后的文本会复制到剪贴板并粘贴到提示词草稿中。',
        '发生失败时，Ctrl+F8 会重新发送同一段音频，无需重新录音。',
        'F11 会将所选文本翻译成适合模型或任务的语言。',
        'F12 会去除语法错误、重复和冗余表达，同时保留原意。',
        '展示 ChatGPT Web：已保存会话、无需 API 密钥，并受服务提供商限制。',
        '用更少的精力更快地编写更好的提示词。',
      ],
    },
    workflow: {
      eyebrow: '工作原理',
      title: '三步获得更好的提示词。',
      lead: '转录、翻译和润色。仅在语音服务提供商报错后重试。',
      record: '按 F9 开始录音，按 F10 停止，按 Escape 取消。成功的结果会复制到剪贴板并保存到本地历史记录。',
      retry: '服务提供商出错后，按 Ctrl+F8 可重新发送内存中的同一段音频，无需重新录音。',
      translate: '选中文本并按 F11，通过 Google Translate 翻译后将结果复制到剪贴板。',
      prettify: '选中文本并按 F12，使用 Ollama 或 vLLM 清理文本，同时保留原意。',
    },
    providers: {
      title: '两种将语音转换为提示词的方式。',
      lead: '可选择订阅支持的网页会话，或按用量付费的 API。',
      voice: '您的声音',
      audioInput: '音频输入',
      available: '现已可用',
      future: '未来 · 尚不可用',
      subscription: '订阅',
      savedSession: '已保存的会话',
      noApiKey: '无需 API 密钥',
      usageBased: '按用量付费',
      apiKey: 'API 密钥、账单或配额',
      planned: '计划中',
    },
    faq: {
      eyebrow: '常见问题',
      title: 'GPT-Voice 的工作方式。',
      items: [
        [
          '如何录音和转录语音？',
          '按 F9 录音，按 F10 停止并发送，或按 Escape 取消。成功结果会复制到剪贴板并加入本地历史记录。',
        ],
        [
          '可以使用哪些服务提供商？',
          '目前可使用 ChatGPT Web 和 OpenAI API。ChatGPT Web 使用已保存的会话；OpenAI API 需要具有账单或配额的个人密钥。',
        ],
        ['无需重新录音可以重试吗？', '可以。发生错误后，Ctrl+F8 会重新发送内存中的音频；新录音会替换该缓存。'],
        ['翻译如何工作？', '选中文本后按 F11，GPT-Voice 会将翻译复制到剪贴板；使用前请检查结果。'],
        ['润色功能做什么？', 'F12 会通过 Ollama 或 vLLM 处理选中文本，去除错误、重复和冗余表达。请检查生成结果。'],
      ],
    },
    final: {
      title: '用更少的精力更快地编写更好的提示词。',
      lead: '自然说话，为模型或任务翻译提示词，并且无需打开更多工具即可清理草稿。',
    },
    footer: {
      description: '为更好的 AI 提示词提供语音转文本。',
      disclaimer: '独立项目，与 OpenAI、Anthropic 或 Google 没有隶属关系。',
      releases: '下载',
      repository: '代码仓库',
      issues: '问题反馈',
      license: 'PolyForm Noncommercial 1.0.0 许可',
    },
  }),
  ja: compactLocalizedContent('ja', {
    currentLanguage: '日本語',
    navigation: {
      providers: 'プロバイダー',
      workflow: '仕組み',
      faq: 'よくある質問',
      documentation: 'ドキュメント',
      language: 'サイトの言語',
      menuOpen: 'ナビゲーションを開く',
      menuClose: 'ナビゲーションを閉じる',
      skip: 'メインコンテンツへ移動',
    },
    hero: {
      badge: 'デスクトップユーティリティ · Windows + Linux',
      title: 'より良い AI プロンプトを、より速く。',
      lead: 'GPT-Voice は音声をすぐに使えるプロンプト用テキストへ変換し、選択したテキストの翻訳や、文法ミス・重複・不要な語句の削除を支援します。',
    },
    actions: ['録音', '再試行', '翻訳', '整形'],
    demo: {
      title: '一連のワークフローを見る。',
      lead: '実際のアプリでの文字起こし、再試行、翻訳、テキスト整形、プロバイダー選択を紹介します。',
      videoLabel: '英語版の GPT-Voice 一分間デモを再生する',
      note: '60 秒 · 60 fps · 日本語字幕付き英語動画',
      captions: '日本語字幕',
      unsupported: 'お使いのブラウザーは HTML 動画に対応していません。',
      cues: [
        '曖昧なプロンプトは作業を妨げます。目的、文脈、成功基準が欠けていることがあります。',
        'GPT-Voice は意図を勝手に補わず、入力の手間を減らします。',
        '「このプルリクエストをレビューし、最も重要なリスクを三つ要約して」と話します。',
        '文字起こしされたテキストはクリップボードにコピーされ、プロンプトの下書きへ貼り付けられます。',
        '失敗した場合、Ctrl+F8 で録り直さずに同じ音声を再送します。',
        'F11 は、モデルやタスクに選んだ言語へ選択テキストを翻訳します。',
        'F12 は意味を保ったまま、文法ミス、重複、不要な語句を取り除きます。',
        'ChatGPT Web の保存済みセッション、API キー不要、プロバイダー制限が表示されます。',
        'より良いプロンプトを、より速く、より少ない手間で。',
      ],
    },
    workflow: {
      eyebrow: '仕組み',
      title: 'より良いプロンプトへの三つのステップ。',
      lead: '文字起こし、翻訳、整形を行います。再試行は音声プロバイダーのエラー後だけ使用します。',
      record:
        'F9 で録音を開始し、F10 で停止、Escape でキャンセルします。成功した結果はクリップボードとローカル履歴に保存されます。',
      retry: 'プロバイダーのエラー後、Ctrl+F8 でメモリ内の同じ音声を録り直さずに再送できます。',
      translate: 'テキストを選択して F11 を押すと、Google Translate で翻訳し、結果をクリップボードへコピーします。',
      prettify: 'テキストを選択して F12 を押すと、Ollama または vLLM で意味を保ちながら整形します。',
    },
    providers: {
      title: '音声をプロンプトへ変換する二つの方法。',
      lead: 'サブスクリプション対応の Web セッション、または従量課金 API を選べます。',
      voice: 'あなたの声',
      audioInput: '音声入力',
      available: '利用可能',
      future: '今後 · 未提供',
      subscription: 'サブスクリプション',
      savedSession: '保存済みセッション',
      noApiKey: 'API キー不要',
      usageBased: '従量課金',
      apiKey: 'API キー、請求またはクォータ',
      planned: '予定',
    },
    faq: {
      eyebrow: 'よくある質問',
      title: 'GPT-Voice の仕組み。',
      items: [
        [
          '音声を録音して文字起こしするには？',
          'F9 で録音し、F10 で停止・送信、Escape でキャンセルします。成功結果はクリップボードとローカル履歴へ保存されます。',
        ],
        [
          'どのプロバイダーを使えますか？',
          '現在は ChatGPT Web と OpenAI API を利用できます。ChatGPT Web は保存済みセッションを使用し、OpenAI API には請求またはクォータのある自分のキーが必要です。',
        ],
        [
          '録り直さずに再試行できますか？',
          'はい。エラー後、Ctrl+F8 はメモリ内の音声を再送します。新しい録音を行うとキャッシュは置き換えられます。',
        ],
        [
          '翻訳はどのように機能しますか？',
          'テキストを選択して F11 を押します。GPT-Voice は翻訳をクリップボードへコピーするため、利用前に確認してください。',
        ],
        [
          '整形機能は何をしますか？',
          'F12 は選択テキストを Ollama または vLLM で処理し、誤り、重複、不要な語句を削除します。生成結果を確認してください。',
        ],
      ],
    },
    final: {
      title: 'より良いプロンプトを、より速く、少ない手間で。',
      lead: '自然に話し、モデルやタスクに合わせて翻訳し、余分なツールを開かずに下書きを整えます。',
    },
    footer: {
      description: 'より良い AI プロンプトのための音声テキスト変換。',
      disclaimer: '独立したプロジェクトです。OpenAI、Anthropic、Google との提携はありません。',
      releases: 'ダウンロード',
      repository: 'リポジトリ',
      issues: '問題を報告',
      license: 'PolyForm Noncommercial 1.0.0 ライセンス',
    },
  }),
  de: compactLocalizedContent('de', {
    currentLanguage: 'Deutsch',
    navigation: {
      providers: 'Anbieter',
      workflow: 'So funktioniert es',
      faq: 'Häufige Fragen',
      documentation: 'Dokumentation',
      language: 'Sprache der Website',
      menuOpen: 'Navigation öffnen',
      menuClose: 'Navigation schließen',
      skip: 'Zum Hauptinhalt springen',
    },
    hero: {
      badge: 'Desktop-Werkzeug · Windows + Linux',
      title: 'Bessere KI-Prompts schneller schreiben.',
      lead: 'GPT-Voice wandelt Sprache in einsatzbereiten Prompt-Text um, übersetzt ausgewählten Text und hilft dabei, Grammatikfehler, Wiederholungen und Füllwörter zu entfernen.',
    },
    actions: ['Aufnehmen', 'Wiederholen', 'Übersetzen', 'Überarbeiten'],
    demo: {
      title: 'Den vollständigen Workflow ansehen.',
      lead: 'Transkription, Wiederholung, Übersetzung, Textüberarbeitung und Anbieterauswahl in der echten Anwendung.',
      videoLabel: 'Die einminütige englische GPT-Voice-Demonstration abspielen',
      note: '60 Sekunden · 60 fps · englisches Video mit deutschen Untertiteln',
      captions: 'Deutsche Untertitel',
      unsupported: 'Ihr Browser unterstützt kein HTML-Video.',
      cues: [
        'Unklare Prompts unterbrechen den Arbeitsfluss: Ziel, Kontext und Erfolgskriterien können fehlen.',
        'GPT-Voice verringert Eingabereibung, ohne Ihre Absicht zu erfinden.',
        'Sagen Sie: „Prüfe diesen Pull Request und fasse die drei wichtigsten Risiken zusammen.“',
        'Der transkribierte Text wird in die Zwischenablage kopiert und in den Prompt-Entwurf eingefügt.',
        'Bei einem Fehler sendet Ctrl+F8 dasselbe Audio erneut, ohne dass Sie noch einmal aufnehmen müssen.',
        'F11 übersetzt den ausgewählten Text in die für Modell oder Aufgabe gewählte Sprache.',
        'F12 entfernt Grammatikfehler, Wiederholungen und Füllwörter, ohne die Bedeutung zu verändern.',
        'ChatGPT Web wird mit gespeicherter Sitzung, ohne API-Schlüssel und innerhalb der Anbieterlimits gezeigt.',
        'Bessere KI-Prompts schneller und mit weniger Aufwand schreiben.',
      ],
    },
    workflow: {
      eyebrow: 'SO FUNKTIONIERT ES',
      title: 'Drei Schritte zu besseren Prompts.',
      lead: 'Transkribieren, übersetzen und überarbeiten. Wiederholen Sie nur nach einem Fehler des Sprachanbieters.',
      record:
        'Mit F9 starten Sie die Aufnahme, mit F10 stoppen Sie sie und mit Escape brechen Sie ab. Erfolgreicher Text wird in die Zwischenablage und den lokalen Verlauf kopiert.',
      retry:
        'Nach einem Anbieterfehler sendet Ctrl+F8 dasselbe gespeicherte Audio erneut, ohne dass Sie es noch einmal aufnehmen müssen.',
      translate:
        'Wählen Sie Text aus und drücken Sie F11, um ihn mit Google Translate zu übersetzen und das Ergebnis in die Zwischenablage zu kopieren.',
      prettify:
        'Wählen Sie Text aus und drücken Sie F12, um ihn mit Ollama oder vLLM bei erhaltenem Sinn zu überarbeiten.',
    },
    providers: {
      title: 'Zwei Wege von Sprache zu Prompts.',
      lead: 'Wählen Sie eine abonnementgestützte Web-Sitzung oder eine nutzungsbasierte API.',
      voice: 'IHRE STIMME',
      audioInput: 'Audioeingang',
      available: 'Jetzt verfügbar',
      future: 'Zukunft · nicht verfügbar',
      subscription: 'Abonnement',
      savedSession: 'Gespeicherte Sitzung',
      noApiKey: 'Kein API-Schlüssel',
      usageBased: 'Nutzungsbasiert',
      apiKey: 'API-Schlüssel, Abrechnung oder Kontingent',
      planned: 'Geplant',
    },
    faq: {
      eyebrow: 'HÄUFIGE FRAGEN',
      title: 'So funktioniert GPT-Voice.',
      items: [
        [
          'Wie nehme ich Sprache auf und transkribiere sie?',
          'Drücken Sie F9 zum Aufnehmen, F10 zum Stoppen und Senden oder Escape zum Abbrechen. Ergebnisse werden in die Zwischenablage und den lokalen Verlauf kopiert.',
        ],
        [
          'Welche Anbieter kann ich verwenden?',
          'ChatGPT Web und OpenAI API sind verfügbar. ChatGPT Web verwendet eine gespeicherte Sitzung; für OpenAI API benötigen Sie einen eigenen Schlüssel mit Abrechnung oder Kontingent.',
        ],
        [
          'Kann ich ohne neue Aufnahme wiederholen?',
          'Ja. Nach einem Fehler sendet Ctrl+F8 das Audio aus dem Speicher erneut. Eine neue Aufnahme ersetzt den Cache.',
        ],
        [
          'Wie funktioniert die Übersetzung?',
          'Wählen Sie Text aus, drücken Sie F11 und prüfen Sie die Übersetzung, die GPT-Voice in die Zwischenablage kopiert.',
        ],
        [
          'Was macht Überarbeiten?',
          'F12 verarbeitet ausgewählten Text mit Ollama oder vLLM und entfernt Fehler, Wiederholungen und Füllwörter. Prüfen Sie das erzeugte Ergebnis.',
        ],
      ],
    },
    final: {
      title: 'Bessere Prompts schneller und mit weniger Aufwand schreiben.',
      lead: 'Sprechen Sie natürlich, übersetzen Sie für Modell oder Aufgabe und bereinigen Sie Entwürfe ohne weitere Werkzeuge.',
    },
    footer: {
      description: 'Sprache-zu-Text für bessere KI-Prompts.',
      disclaimer: 'Unabhängiges Projekt. Nicht mit OpenAI, Anthropic oder Google verbunden.',
      releases: 'Herunterladen',
      repository: 'Repository',
      issues: 'Probleme',
      license: 'Lizenz PolyForm Noncommercial 1.0.0',
    },
  }),
  fr: compactLocalizedContent('fr', {
    currentLanguage: 'Français',
    navigation: {
      providers: 'Fournisseurs',
      workflow: 'Fonctionnement',
      faq: 'Questions fréquentes',
      documentation: 'Documentation',
      language: 'Langue du site',
      menuOpen: 'Ouvrir la navigation',
      menuClose: 'Fermer la navigation',
      skip: 'Aller au contenu principal',
    },
    hero: {
      badge: 'Utilitaire de bureau · Windows + Linux',
      title: 'Écrivez de meilleurs prompts IA plus vite.',
      lead: 'GPT-Voice transforme la parole en texte prêt pour les prompts, traduit le texte sélectionné et aide à supprimer les fautes de grammaire, les répétitions et les mots superflus.',
    },
    actions: ['Enregistrer', 'Réessayer', 'Traduire', 'Améliorer'],
    demo: {
      title: 'Découvrez le flux de travail complet.',
      lead: 'Transcription, nouvelle tentative, traduction, amélioration du texte et choix du fournisseur dans l’application réelle.',
      videoLabel: 'Lire la démonstration GPT-Voice d’une minute en anglais',
      note: '60 secondes · 60 i/s · vidéo en anglais avec sous-titres français',
      captions: 'Sous-titres français',
      unsupported: 'Votre navigateur ne prend pas en charge la vidéo HTML.',
      cues: [
        'Les prompts imprécis coupent votre élan : objectif, contexte et critères de réussite peuvent manquer.',
        'GPT-Voice réduit la friction de saisie sans inventer votre intention.',
        'Dites : « Examine cette pull request et résume les trois risques les plus importants. »',
        'Le texte transcrit est copié dans le presse-papiers puis collé dans le brouillon de prompt.',
        'En cas d’échec, Ctrl+F8 renvoie le même audio sans nouvel enregistrement.',
        'F11 traduit le texte sélectionné dans la langue choisie pour le modèle ou la tâche.',
        'F12 supprime les fautes de grammaire, répétitions et mots superflus en préservant le sens.',
        'ChatGPT Web est montré avec une session enregistrée, sans clé API et dans les limites du fournisseur.',
        'Écrivez de meilleurs prompts plus vite, avec moins d’effort.',
      ],
    },
    workflow: {
      eyebrow: 'FONCTIONNEMENT',
      title: 'Trois étapes vers de meilleurs prompts.',
      lead: 'Transcrivez, traduisez et améliorez. Réessayez seulement après une erreur du fournisseur vocal.',
      record:
        'Appuyez sur F9 pour enregistrer, sur F10 pour arrêter et sur Échap pour annuler. Le résultat est copié dans le presse-papiers et l’historique local.',
      retry: 'Après une erreur du fournisseur, Ctrl+F8 renvoie le même audio conservé sans nouvel enregistrement.',
      translate:
        'Sélectionnez du texte et appuyez sur F11 pour le traduire avec Google Translate et copier le résultat.',
      prettify:
        'Sélectionnez du texte et appuyez sur F12 pour le nettoyer avec Ollama ou vLLM tout en préservant son sens.',
    },
    providers: {
      title: 'Deux façons de transformer la parole en prompts.',
      lead: 'Choisissez une session web par abonnement ou une API facturée à l’usage.',
      voice: 'VOTRE VOIX',
      audioInput: 'Entrée audio',
      available: 'Disponible maintenant',
      future: 'À venir · indisponible',
      subscription: 'Abonnement',
      savedSession: 'Session enregistrée',
      noApiKey: 'Sans clé API',
      usageBased: 'Facturation à l’usage',
      apiKey: 'Clé API, facturation ou quota',
      planned: 'Prévu',
    },
    faq: {
      eyebrow: 'QUESTIONS FRÉQUENTES',
      title: 'Fonctionnement de GPT-Voice.',
      items: [
        [
          'Comment enregistrer et transcrire la parole ?',
          'Appuyez sur F9 pour enregistrer, F10 pour arrêter et envoyer, ou Échap pour annuler. Le résultat est copié dans le presse-papiers et l’historique local.',
        ],
        [
          'Quels fournisseurs sont disponibles ?',
          'ChatGPT Web et OpenAI API sont disponibles. ChatGPT Web utilise une session enregistrée ; OpenAI API requiert votre clé avec facturation ou quota.',
        ],
        [
          'Puis-je réessayer sans réenregistrer ?',
          'Oui. Après une erreur, Ctrl+F8 renvoie l’audio en mémoire. Un nouvel enregistrement remplace ce cache.',
        ],
        [
          'Comment fonctionne la traduction ?',
          'Sélectionnez du texte, appuyez sur F11 et vérifiez la traduction copiée dans le presse-papiers par GPT-Voice.',
        ],
        [
          'Que fait Améliorer ?',
          'F12 traite le texte sélectionné avec Ollama ou vLLM pour supprimer les erreurs, répétitions et mots superflus. Vérifiez le résultat généré.',
        ],
      ],
    },
    final: {
      title: 'Écrivez de meilleurs prompts plus vite, avec moins d’effort.',
      lead: 'Parlez naturellement, traduisez pour le modèle ou la tâche et nettoyez les brouillons sans ouvrir d’autres outils.',
    },
    footer: {
      description: 'De la voix au texte pour de meilleurs prompts IA.',
      disclaimer: 'Projet indépendant. Sans affiliation avec OpenAI, Anthropic ou Google.',
      releases: 'Télécharger',
      repository: 'Dépôt',
      issues: 'Problèmes',
      license: 'Licence PolyForm Noncommercial 1.0.0',
    },
  }),
  hi: compactLocalizedContent('hi', {
    currentLanguage: 'हिन्दी',
    navigation: {
      providers: 'प्रदाता',
      workflow: 'यह कैसे काम करता है',
      faq: 'अक्सर पूछे जाने वाले प्रश्न',
      documentation: 'दस्तावेज़',
      language: 'वेबसाइट की भाषा',
      menuOpen: 'नेविगेशन खोलें',
      menuClose: 'नेविगेशन बंद करें',
      skip: 'मुख्य सामग्री पर जाएँ',
    },
    hero: {
      badge: 'डेस्कटॉप उपयोगिता · Windows + Linux',
      title: 'बेहतर AI प्रॉम्प्ट तेज़ी से लिखें।',
      lead: 'GPT-Voice आवाज़ को प्रॉम्प्ट के लिए तैयार टेक्स्ट में बदलता है, चुने हुए टेक्स्ट का अनुवाद करता है और व्याकरण की गलतियाँ, दोहराव और अनावश्यक शब्द हटाने में मदद करता है।',
    },
    actions: ['रिकॉर्ड करें', 'फिर से भेजें', 'अनुवाद करें', 'सुधारें'],
    demo: {
      title: 'पूरा कार्यप्रवाह देखें।',
      lead: 'वास्तविक ऐप में ट्रांसक्रिप्शन, पुनः प्रयास, अनुवाद, टेक्स्ट सुधार और प्रदाता चयन देखें।',
      videoLabel: 'अंग्रेज़ी में GPT-Voice का एक मिनट का प्रदर्शन चलाएँ',
      note: '60 सेकंड · 60 fps · हिन्दी उपशीर्षकों के साथ अंग्रेज़ी वीडियो',
      captions: 'हिन्दी उपशीर्षक',
      unsupported: 'आपका ब्राउज़र HTML वीडियो का समर्थन नहीं करता है।',
      cues: [
        'अस्पष्ट प्रॉम्प्ट काम की लय तोड़ते हैं: लक्ष्य, संदर्भ और सफलता के मानदंड छूट सकते हैं।',
        'GPT-Voice आपके इरादे को गढ़े बिना इनपुट की परेशानी कम करता है।',
        'कहें: “इस पुल रिक्वेस्ट की समीक्षा करें और तीन सबसे महत्वपूर्ण जोखिमों का सार दें।”',
        'ट्रांसक्राइब किया गया टेक्स्ट क्लिपबोर्ड में कॉपी होकर प्रॉम्प्ट ड्राफ़्ट में चिपक जाता है।',
        'विफलता पर Ctrl+F8 बिना दोबारा रिकॉर्ड किए उसी ऑडियो को फिर भेजता है।',
        'F11 चुने हुए टेक्स्ट को मॉडल या कार्य के लिए चुनी गई भाषा में अनुवाद करता है।',
        'F12 अर्थ बनाए रखते हुए व्याकरण की गलतियाँ, दोहराव और अनावश्यक शब्द हटाता है।',
        'ChatGPT Web को सहेजे हुए सत्र, बिना API कुंजी और प्रदाता सीमाओं के साथ दिखाया गया है।',
        'कम प्रयास में बेहतर प्रॉम्प्ट तेज़ी से लिखें।',
      ],
    },
    workflow: {
      eyebrow: 'यह कैसे काम करता है',
      title: 'बेहतर प्रॉम्प्ट के लिए तीन चरण।',
      lead: 'ट्रांसक्राइब करें, अनुवाद करें और सुधारें। केवल आवाज़ प्रदाता की त्रुटि के बाद फिर से भेजें।',
      record:
        'रिकॉर्डिंग शुरू करने के लिए F9, रोकने के लिए F10 और रद्द करने के लिए Escape दबाएँ। सफल परिणाम क्लिपबोर्ड और स्थानीय इतिहास में कॉपी होता है।',
      retry: 'प्रदाता की त्रुटि के बाद Ctrl+F8 बिना दोबारा रिकॉर्ड किए मेमोरी में मौजूद उसी ऑडियो को फिर भेजता है।',
      translate: 'टेक्स्ट चुनें और Google Translate से अनुवाद करके परिणाम क्लिपबोर्ड में कॉपी करने के लिए F11 दबाएँ।',
      prettify: 'टेक्स्ट चुनें और अर्थ बनाए रखते हुए Ollama या vLLM से साफ़ करने के लिए F12 दबाएँ।',
    },
    providers: {
      title: 'आवाज़ को प्रॉम्प्ट में बदलने के दो तरीके।',
      lead: 'सदस्यता-आधारित वेब सत्र या उपयोग के अनुसार भुगतान वाले API में से चुनें।',
      voice: 'आपकी आवाज़',
      audioInput: 'ऑडियो इनपुट',
      available: 'अभी उपलब्ध',
      future: 'भविष्य · उपलब्ध नहीं',
      subscription: 'सदस्यता',
      savedSession: 'सहेजा गया सत्र',
      noApiKey: 'API कुंजी नहीं',
      usageBased: 'उपयोग के अनुसार भुगतान',
      apiKey: 'API कुंजी, बिलिंग या कोटा',
      planned: 'नियोजित',
    },
    faq: {
      eyebrow: 'अक्सर पूछे जाने वाले प्रश्न',
      title: 'GPT-Voice कैसे काम करता है।',
      items: [
        [
          'आवाज़ को कैसे रिकॉर्ड और ट्रांसक्राइब करूँ?',
          'रिकॉर्डिंग के लिए F9, रोककर भेजने के लिए F10 या रद्द करने के लिए Escape दबाएँ। परिणाम क्लिपबोर्ड और स्थानीय इतिहास में कॉपी होता है।',
        ],
        [
          'कौन से प्रदाता उपलब्ध हैं?',
          'ChatGPT Web और OpenAI API उपलब्ध हैं। ChatGPT Web सहेजे हुए सत्र का उपयोग करता है; OpenAI API के लिए बिलिंग या कोटा वाली आपकी अपनी कुंजी चाहिए।',
        ],
        [
          'क्या बिना फिर रिकॉर्ड किए दोबारा भेज सकता हूँ?',
          'हाँ। त्रुटि के बाद Ctrl+F8 मेमोरी के ऑडियो को फिर भेजता है। नई रिकॉर्डिंग कैश को बदल देती है।',
        ],
        [
          'अनुवाद कैसे काम करता है?',
          'टेक्स्ट चुनें, F11 दबाएँ और GPT-Voice द्वारा क्लिपबोर्ड में कॉपी किए गए अनुवाद की जाँच करें।',
        ],
        [
          'सुधार सुविधा क्या करती है?',
          'F12 चुने हुए टेक्स्ट को Ollama या vLLM से संसाधित कर गलतियाँ, दोहराव और अनावश्यक शब्द हटाती है। परिणाम की जाँच करें।',
        ],
      ],
    },
    final: {
      title: 'कम प्रयास में बेहतर प्रॉम्प्ट तेज़ी से लिखें।',
      lead: 'स्वाभाविक रूप से बोलें, मॉडल या कार्य के लिए अनुवाद करें और अतिरिक्त उपकरण खोले बिना ड्राफ्ट साफ़ करें।',
    },
    footer: {
      description: 'बेहतर AI प्रॉम्प्ट के लिए आवाज़ से टेक्स्ट।',
      disclaimer: 'स्वतंत्र परियोजना। OpenAI, Anthropic या Google से संबद्ध नहीं।',
      releases: 'डाउनलोड',
      repository: 'रिपॉज़िटरी',
      issues: 'समस्याएँ',
      license: 'PolyForm Noncommercial 1.0.0 लाइसेंस',
    },
  }),
} satisfies Record<Exclude<LandingLocale, 'en'>, LandingContent>;
