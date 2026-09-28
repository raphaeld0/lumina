import { useState, type FormEvent } from 'react'
import { ArrowRight, BookOpen, LoaderCircle, Search, Sparkles } from 'lucide-react'
import { searchRelevantChunks } from '../lib/search'
import type { PdfDocumentData, SearchResult } from '../types'

type SemanticSearchProps = {
  document: PdfDocumentData
}

const EXAMPLE_QUESTIONS = [
  'Quais são os conceitos principais?',
  'O que o documento explica sobre o tema?',
  'Onde encontro a definição mais importante?',
]

export function SemanticSearch({ document }: SemanticSearchProps) {
  const [question, setQuestion] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault()
    const normalizedQuestion = question.trim()
    if (normalizedQuestion.length < 3 || isSearching) return

    setIsSearching(true)
    setError('')
    try {
      const matches = await searchRelevantChunks(document.id, normalizedQuestion)
      setResults(matches)
      setLastQuestion(normalizedQuestion)
    } catch {
      setError('Não foi possível consultar o índice local. Tente enviar o PDF novamente.')
      setResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  function selectExample(example: string) {
    setQuestion(example)
  }

  return (
    <div className="semantic-search">
      <div className="question-intro">
        <span className="question-icon"><Sparkles size={21} /></span>
        <div>
          <h2>O que você quer encontrar?</h2>
          <p>Buscaremos os trechos mais relacionados à sua pergunta.</p>
        </div>
      </div>

      <form className="question-form" onSubmit={submitQuestion}>
        <Search size={19} />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex.: Como o autor define aprendizagem?"
          aria-label="Pergunta sobre o documento"
        />
        <button type="submit" disabled={question.trim().length < 3 || isSearching} aria-label="Buscar trechos">
          {isSearching ? <LoaderCircle className="search-spinner" size={19} /> : <ArrowRight size={19} />}
        </button>
      </form>

      {results === null && !error && (
        <div className="search-empty-state">
          <p>Experimente perguntar:</p>
          <div className="example-questions">
            {EXAMPLE_QUESTIONS.map((example) => (
              <button key={example} onClick={() => selectExample(example)}>{example}</button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="search-error" role="alert">{error}</p>}

      {results !== null && (
        <div className="search-results" aria-live="polite">
          <div className="results-heading">
            <div>
              <span>RESULTADOS PARA</span>
              <h3>“{lastQuestion}”</h3>
            </div>
            <strong>{results.length} {results.length === 1 ? 'trecho' : 'trechos'}</strong>
          </div>

          {results.length > 0 ? results.map((result, index) => (
            <article className="result-card" key={result.id}>
              <div className="result-meta">
                <span className="result-rank">{String(index + 1).padStart(2, '0')}</span>
                <span><BookOpen size={13} /> Página {result.pageNumber}</span>
                <span className="relevance">{Math.max(1, Math.round(result.score * 100))}% de relevância</span>
              </div>
              <p>{result.text}</p>
              <footer>{result.documentName} · trecho {result.chunkIndex + 1}</footer>
            </article>
          )) : (
            <div className="no-search-matches">
              <Search size={24} />
              <strong>Nenhum trecho relevante foi encontrado.</strong>
              <p>Tente usar termos mais específicos ou palavras presentes no documento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
