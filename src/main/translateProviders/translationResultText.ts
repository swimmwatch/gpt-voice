/** Normalizes provider line endings without collapsing Markdown-significant internal whitespace. */
export function normalizeTranslationResultText(text: string): string {
  return text.replace(/\r\n?/gu, '\n');
}

/** Restores the source document's line-ending convention after provider result stabilization. */
export function matchTranslationResultLineEndings(sourceText: string, translatedText: string): string {
  const sourceLineEnding = /\r\n|\r|\n/u.exec(sourceText)?.[0];
  if (!sourceLineEnding || sourceLineEnding === '\n') return translatedText;
  return translatedText.replace(/\n/gu, sourceLineEnding);
}
