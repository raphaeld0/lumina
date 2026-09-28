import assert from 'node:assert/strict'
import test from 'node:test'
import { getConversationTitle } from '../src/lib/conversationStore.js'

test('usa a primeira pergunta como título persistente da conversa', () => {
  assert.equal(getConversationTitle([
    { id: 'welcome', role: 'assistant', content: 'Olá' },
    { id: 'question', role: 'user', content: 'O que é inteligência artificial?' },
  ], 'artigo.pdf'), 'O que é inteligência artificial?')
})

test('usa o nome do documento antes da primeira pergunta', () => {
  assert.equal(
    getConversationTitle([{ id: 'welcome', role: 'assistant', content: 'Olá' }], 'artigo.pdf'),
    'Estudo de artigo.pdf',
  )
})
