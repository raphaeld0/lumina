import type { StudyMaterial } from '../types'

export type PracticeHistoryEntry = {
  id: string
  createdAt: number
  set: StudyMaterial
}

export const PRACTICE_HISTORY_EVENT = 'lumina-practice-history-updated'

function storageKey(conversationId: string) {
  return `lumina-practice-history:${conversationId}`
}

export function getPracticeHistory(conversationId: string): PracticeHistoryEntry[] {
  try {
    const stored = localStorage.getItem(storageKey(conversationId))
    return stored ? (JSON.parse(stored) as PracticeHistoryEntry[]) : []
  } catch {
    return []
  }
}

export function savePracticeHistory(conversationId: string, set: StudyMaterial) {
  const history = [
    { id: crypto.randomUUID(), createdAt: Date.now(), set },
    ...getPracticeHistory(conversationId),
  ].slice(0, 12)
  localStorage.setItem(storageKey(conversationId), JSON.stringify(history))
  window.dispatchEvent(new CustomEvent(PRACTICE_HISTORY_EVENT, { detail: { conversationId } }))
  return history[0]
}
