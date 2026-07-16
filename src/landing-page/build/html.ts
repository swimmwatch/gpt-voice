export function getHtmlTags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

export function getHtmlAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));

  return match?.[1] ?? match?.[2] ?? match?.[3];
}
