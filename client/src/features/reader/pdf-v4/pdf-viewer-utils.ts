export function lookupAccentHex(accentId: string, options: readonly { id: string; color: string }[]): string {
  return options.find((o) => o.id === accentId)?.color ?? '#3b82f6'
}

export function getIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}
