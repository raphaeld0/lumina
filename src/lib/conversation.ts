import type { ChatMessage } from '../types'

const CONTEXTUAL_REFERENCE = /\b(isto|isso|nisso|nisto|esse|essa|esses|essas|ele|ela|eles|elas|anterior|acima|antes|melhor|detalh\w*|aprofund\w*|resum\w*|explic\w*|continue|continua|como assim|por que|e sobre|e quanto)\b/i
const MAX_CONTEXT_CHARACTERS = 2_400

export const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Já li e indexei seu material. Faça uma pergunta e responderei somente com base no documento.',
  sufficient: true,
  sources: [],
}

export type ContextualSearchQuery = {
  query: string
  resolvedQuestion: string
  usedContext: boolean
}

function compactText(text: string, limit: number) {
  return text.replace(/\s+/g, ' ').trim().slice(0, limit)
}

function isContextualFollowUp(question: string) {
  const words = question.trim().split(/\s+/)
  return CONTEXTUAL_REFERENCE.test(question) || words.length <= 4
}

function resolveFollowUpQuestion(question: string, previousQuestion?: string) {
  if (!previousQuestion) {
    return `Considerando a resposta anterior, responda à continuação: "${question}".`
  }

  const subject = compactText(previousQuestion, 500)
  if (/\b(explic\w*|melhor|detalh\w*|aprofund\w*)\b/i.test(question)) {
    return `Responda novamente à pergunta "${subject}" incluindo todas as informações relevantes presentes nas fontes.`
  }

  return `O assunto é o da pergunta anterior "${subject}". Agora responda: "${question}".`
}

export function buildContextualSearchQuery(
  question: string,
  history: ChatMessage[],
): ContextualSearchQuery {
  if (!isContextualFollowUp(question)) {
    return { query: question, resolvedQuestion: question, usedContext: false }
  }

  const conversation = history.filter((message) => message.id !== 'welcome')
  const previousUserMessage = [...conversation].reverse().find((message) => message.role === 'user')
  const previousAssistantMessage = [...conversation].reverse().find((message) => message.role === 'assistant')

  if (!previousUserMessage && !previousAssistantMessage) {
    return { query: question, resolvedQuestion: question, usedContext: false }
  }

  const sourceContext = previousAssistantMessage?.sources
    ?.map((source) => source.text)
    .join(' ')

  const context = [
    previousUserMessage?.content,
    previousAssistantMessage?.content,
    sourceContext,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => compactText(value, 1_200))
    .join(' ')
    .slice(0, MAX_CONTEXT_CHARACTERS)

  return {
    query: `${context} ${question}`.trim(),
    resolvedQuestion: resolveFollowUpQuestion(question, previousUserMessage?.content),
    usedContext: true,
  }
}
