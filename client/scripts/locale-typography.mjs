// Catalogs never carry a Unicode em dash. That is a house style rule rather than a correctness one,
// and translators reach for the character constantly, so rejecting the message would discard a sound
// translation over punctuation and stall the sync until somebody edits Crowdin by hand. The English
// source writes a plain hyphen in the same place, so the sync rewrites the character instead.
export function normalizeMessageTypography(message) {
  return message.replaceAll('\u2014', '-')
}

export function findTypographyDrift({ catalogs }) {
  const drift = []
  for (const [locale, catalog] of catalogs) {
    if (locale === 'en') continue
    for (const [key, message] of catalog) {
      const normalized = normalizeMessageTypography(message)
      if (normalized !== message) drift.push({ locale, key, message: normalized })
    }
  }

  return drift
}
