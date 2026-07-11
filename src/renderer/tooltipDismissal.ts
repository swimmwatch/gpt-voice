export function shouldDismissTooltipForPointerExit(relatedTarget: EventTarget | null): boolean {
  return relatedTarget === null;
}
