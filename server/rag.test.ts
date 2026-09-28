import assert from 'node:assert/strict'
import test from 'node:test'
import { mapModelAnswer, type RagRequest } from './rag.js'

const request: RagRequest = {
  question: 'O que é fotossíntese?',
  documentName: 'biologia.pdf',
  history: [],
  chunks: [
    { id: 'chunk-1', pageNumber: 7, text: 'Fotossíntese converte energia luminosa em energia química.', score: 0.8 },
    { id: 'chunk-2', pageNumber: 9, text: 'As raízes absorvem água e sais minerais.', score: 0.4 },
  ],
}

test('retorna resposta e somente as páginas citadas quando há informação', () => {
  const result = mapModelAnswer(request, {
    answer: 'É a conversão de energia luminosa em energia química.',
    sufficient: true,
    citationIds: ['S1', 'S99'],
  })

  assert.equal(result.sufficient, true)
  assert.equal(result.sources.length, 1)
  assert.equal(result.sources[0].pageNumber, 7)
})

test('informa insuficiência e não apresenta fontes quando o PDF não responde', () => {
  const result = mapModelAnswer(request, {
    answer: 'Brasília.',
    sufficient: false,
    citationIds: ['S1'],
  })

  assert.equal(result.sufficient, false)
  assert.equal(result.sources.length, 0)
  assert.match(result.answer, /informação suficiente/i)
})

test('rejeita resposta que cita uma fonte inexistente', () => {
  const result = mapModelAnswer(request, {
    answer: 'Resposta sem uma fonte verificável.',
    sufficient: true,
    citationIds: ['S99'],
  })

  assert.equal(result.sufficient, false)
  assert.equal(result.sources.length, 0)
  assert.match(result.answer, /informação suficiente/i)
})
