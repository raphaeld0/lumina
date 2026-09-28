const EMBEDDING_DIMENSIONS = 384

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'aquela', 'aquele', 'aqueles', 'as', 'com', 'como', 'da', 'das',
  'de', 'dela', 'dele', 'do', 'dos', 'e', 'é', 'ela', 'ele', 'em', 'entre', 'era',
  'essa', 'esse', 'esta', 'este', 'eu', 'foi', 'há', 'isso', 'isto', 'já', 'mais',
  'mas', 'me', 'mesmo', 'meu', 'minha', 'muito', 'na', 'não', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'pela', 'pelo', 'por', 'porque', 'qual', 'que', 'quem',
  'se', 'sem', 'ser', 'seu', 'sua', 'sao', 'tambem', 'tem', 'um', 'uma', 'voce',
  'nao',
])

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hashFeature(feature: string) {
  let hash = 2166136261
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function addFeature(vector: number[], feature: string, weight: number) {
  const hash = hashFeature(feature)
  const position = hash % EMBEDDING_DIMENSIONS
  const sign = (hash & 0x80000000) === 0 ? 1 : -1
  vector[position] += weight * sign
}

function stemPortugueseWord(word: string) {
  if (word.length < 6) return word
  return word.replace(/(amentos|imentos|amento|imento|acoes|adores|adoras|mente|idades|idade|ismos|istas|acao|icos|icas|ico|ica|oso|osa|oes|ais|ar|er|ir|s)$/u, '')
}

export function createEmbedding(text: string) {
  const normalized = normalizeText(text)
  const rawTokens = normalized.split(' ').filter(Boolean)
  const tokens = rawTokens
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(stemPortugueseWord)
  const vector = Array<number>(EMBEDDING_DIMENSIONS).fill(0)

  tokens.forEach((token, index) => {
    addFeature(vector, `word:${token}`, 1)

    if (index < tokens.length - 1) {
      addFeature(vector, `pair:${token}_${tokens[index + 1]}`, 0.7)
    }

    if (token.length >= 5) {
      for (let position = 0; position <= token.length - 3; position += 1) {
        addFeature(vector, `tri:${token.slice(position, position + 3)}`, 0.16)
      }
    }
  })

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude)
}

export function cosineSimilarity(first: number[], second: number[]) {
  const length = Math.min(first.length, second.length)
  let similarity = 0
  for (let index = 0; index < length; index += 1) {
    similarity += first[index] * second[index]
  }
  return similarity
}
