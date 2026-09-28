import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmbedding, cosineSimilarity } from '../src/lib/embeddings.js'
import { expandAcronymsForSearch, isRewrittenQueryRelated, resolveAcronymsInQuestion } from '../src/lib/search.js'

test('expande IA para inteligência artificial antes da busca', () => {
  const chunks = [
    { text: 'A inteligência artificial permite que sistemas executem tarefas complexas.' },
    { text: 'A internet conecta computadores em diferentes redes.' },
  ]
  const expandedQuestion = expandAcronymsForSearch('O que é IA?', chunks)

  assert.match(expandedQuestion, /inteligência artificial/i)
  assert.equal(resolveAcronymsInQuestion('O que é IA?', chunks), 'O que é inteligência artificial?')
  assert.equal(resolveAcronymsInQuestion('oq é ia?', chunks), 'oq é inteligência artificial?')

  const questionEmbedding = createEmbedding(expandedQuestion)
  const relevantScore = cosineSimilarity(questionEmbedding, createEmbedding(chunks[0].text))
  const unrelatedScore = cosineSimilarity(questionEmbedding, createEmbedding(chunks[1].text))
  assert(relevantScore > unrelatedScore)
})

test('descobre no documento uma sigla que não está na lista conhecida', () => {
  const chunks = [{ text: 'O Processamento de Linguagem Natural analisa textos escritos.' }]
  const expandedQuestion = expandAcronymsForSearch('O que é PLN?', chunks)

  assert.match(expandedQuestion, /processamento linguagem natural/i)
  assert.equal(
    resolveAcronymsInQuestion('O que é PLN?', chunks),
    'O que é processamento linguagem natural?',
  )
})

test('descarta reescrita do modelo que troca o assunto da pergunta', () => {
  assert.equal(isRewrittenQueryRelated('me fala de IA', 'inteligência artificial explicação'), true)
  assert.equal(isRewrittenQueryRelated('me fala de IA', 'fotossíntese explicação'), false)
})
