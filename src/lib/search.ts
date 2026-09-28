import type { DocumentChunk, SearchResult } from '../types'
import { cosineSimilarity, createEmbedding } from './embeddings'
import { getChunksByDocument } from './vectorStore'

const IGNORED_QUERY_WORDS = new Set([
  'a', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'ela', 'ele',
  'em', 'essa', 'esse', 'esta', 'este', 'isso', 'isto', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'por', 'pra', 'qual', 'que', 'quem', 'um', 'uma', 'oq',
])

const DOCUMENT_CONNECTORS = new Set([
  'a', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'para', 'por',
])

const KNOWN_ACRONYMS: Record<string, string[]> = {
  ia: ['inteligência artificial'],
  ai: ['artificial intelligence', 'inteligência artificial'],
}

function normalizeWords(text: string) {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function findAcronymCandidates(question: string) {
  return [...new Set(normalizeWords(question).filter((word) => (
    word.length >= 2
    && word.length <= 5
    && !IGNORED_QUERY_WORDS.has(word)
  )))]
}

function findAcronymExpansions(
  question: string,
  chunks: Array<Pick<DocumentChunk, 'text'>>,
) {
  const acronyms = findAcronymCandidates(question)
  const expansions = new Map<string, string>()

  for (const acronym of acronyms) {
    const phraseCounts = new Map<string, number>()
    for (const knownExpansion of KNOWN_ACRONYMS[acronym] ?? []) {
      phraseCounts.set(knownExpansion, (phraseCounts.get(knownExpansion) ?? 0) + 10)
    }

    for (const chunk of chunks) {
      const words = normalizeWords(chunk.text).filter((word) => !DOCUMENT_CONNECTORS.has(word))
      for (let index = 0; index <= words.length - acronym.length; index += 1) {
        const phraseWords = words.slice(index, index + acronym.length)
        const initials = phraseWords.map((word) => word[0]).join('')
        if (initials !== acronym || phraseWords.some((word) => word.length < 3)) continue

        const phrase = phraseWords.join(' ')
        phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
      }
    }

    const bestExpansion = [...phraseCounts.entries()]
      .sort((first, second) => second[1] - first[1])[0]?.[0]
    if (bestExpansion) expansions.set(acronym, bestExpansion)
  }

  return expansions
}

export function expandAcronymsForSearch(
  question: string,
  chunks: Array<Pick<DocumentChunk, 'text'>>,
) {
  const expansions = [...findAcronymExpansions(question, chunks).values()]

  return expansions.length > 0 ? `${question} ${expansions.join(' ')}` : question
}

export function resolveAcronymsInQuestion(
  question: string,
  chunks: Array<Pick<DocumentChunk, 'text'>>,
) {
  let resolvedQuestion = question
  for (const [acronym, expansion] of findAcronymExpansions(question, chunks)) {
    resolvedQuestion = resolvedQuestion.replace(new RegExp(`\\b${acronym}\\b`, 'giu'), expansion)
  }
  return resolvedQuestion
}

export function isRewrittenQueryRelated(originalQuestion: string, rewrittenQuery: string) {
  const originalTerms = new Set(
    normalizeWords(resolveAcronymsInQuestion(originalQuestion, []))
      .filter((word) => word.length >= 4 && !IGNORED_QUERY_WORDS.has(word)),
  )
  const rewrittenTerms = new Set(
    normalizeWords(rewrittenQuery)
      .filter((word) => word.length >= 4 && !IGNORED_QUERY_WORDS.has(word)),
  )

  if (originalTerms.size === 0 || rewrittenTerms.size === 0) return false
  return [...originalTerms].some((term) => rewrittenTerms.has(term))
}

export async function searchRelevantChunks(
  documentId: string,
  question: string,
  limit = 5,
): Promise<SearchResult[]> {
  const chunks = await getChunksByDocument(documentId)
  const expandedQuestion = expandAcronymsForSearch(question, chunks)
  const queryEmbedding = createEmbedding(expandedQuestion)

  return chunks
    .map((chunk): SearchResult => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
}
