let fallbackSequence = 0

export const createStableId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  fallbackSequence += 1
  return `local-${Date.now()}-${fallbackSequence}`
}
