import assert from 'node:assert/strict'
import test from 'node:test'
import { buildContextualSearchQuery } from '../src/lib/conversation.js'
import type { ChatMessage } from '../src/types.js'

const history: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'O que é fotossíntese?' },
  {
    id: 'a1',
    role: 'assistant',
    content: 'É a conversão de energia luminosa em energia química.',
    sources: [{
      id: 'S1',
      documentName: 'biologia.pdf',
      pageNumber: 7,
      text: 'A fotossíntese ocorre principalmente nos cloroplastos.',
    }],
  },
]

test('enriquece pergunta de continuação com o assunto e a fonte anteriores', () => {
  const result = buildContextualSearchQuery('Pode explicar melhor isso?', history)

  assert.equal(result.usedContext, true)
  assert.match(result.query, /fotossíntese/i)
  assert.match(result.query, /cloroplastos/i)
  assert.match(result.query, /explicar melhor isso/i)
  assert.match(result.resolvedQuestion, /responda novamente.*fotossíntese/i)
})

test('não altera uma nova pergunta autossuficiente', () => {
  const question = 'Quais são as etapas completas da divisão celular descritas no documento?'
  const result = buildContextualSearchQuery(question, history)

  assert.equal(result.usedContext, false)
  assert.equal(result.query, question)
  assert.equal(result.resolvedQuestion, question)
})

test('não inventa contexto quando ainda não há conversa anterior', () => {
  const result = buildContextualSearchQuery('E por que isso acontece?', [])

  assert.equal(result.usedContext, false)
  assert.equal(result.query, 'E por que isso acontece?')
  assert.equal(result.resolvedQuestion, 'E por que isso acontece?')
})
