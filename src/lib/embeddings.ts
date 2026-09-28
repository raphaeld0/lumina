type EmbeddingPurpose = 'document' | 'query'

type ApiError = {
  message?: string
}

type EmbeddingResponse = {
  embeddings: number[][]
  model: string
}

export async function createEmbeddings(inputs: string[], purpose: EmbeddingPurpose) {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs, purpose }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError
    throw new Error(error.message || 'Não foi possível gerar os embeddings locais.')
  }

  const result = await response.json() as EmbeddingResponse
  if (result.embeddings.length !== inputs.length) {
    throw new Error('O Ollama retornou uma quantidade inesperada de embeddings.')
  }
  return result.embeddings
}

export function cosineSimilarity(first: number[], second: number[]) {
  const length = Math.min(first.length, second.length)
  let dotProduct = 0
  let firstMagnitude = 0
  let secondMagnitude = 0

  for (let index = 0; index < length; index += 1) {
    dotProduct += first[index] * second[index]
    firstMagnitude += first[index] * first[index]
    secondMagnitude += second[index] * second[index]
  }

  const denominator = Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude)
  return denominator === 0 ? 0 : dotProduct / denominator
}
