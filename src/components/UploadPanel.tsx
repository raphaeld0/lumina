import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { AlertCircle, FileUp, LoaderCircle, ShieldCheck, Upload } from 'lucide-react'
import type { UploadError, UploadStatus } from '../types'

type UploadPanelProps = {
  status: UploadStatus
  error: UploadError | null
  progress: { current: number; total: number }
  onFile: (file: File) => void
}

export function UploadPanel({ status, error, progress, onFile }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file && status !== 'restoring' && status !== 'reading' && status !== 'indexing') onFile(file)
    event.target.value = ''
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file && status !== 'restoring' && status !== 'reading' && status !== 'indexing') onFile(file)
  }

  const isProcessing = status === 'restoring' || status === 'reading' || status === 'indexing'

  return (
    <section className="upload-section">
      <div className="eyebrow"><span /> SEU ESPAÇO DE ESTUDOS</div>
      <h1>Entenda qualquer conteúdo.<br /><em>No seu ritmo.</em></h1>
      <p className="hero-copy">
        Envie seu material e transforme páginas em conhecimento que realmente fica.
      </p>

      <div
        className={`dropzone ${isDragging ? 'is-dragging' : ''} ${isProcessing ? 'is-loading' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={dropFile}
      >
        {isProcessing ? (
          <>
            <div className="upload-icon loading-icon"><LoaderCircle size={27} /></div>
            <h2>{status === 'restoring' ? 'Restaurando suas conversas…' : status === 'indexing' ? 'Criando o índice de busca…' : 'Lendo seu documento…'}</h2>
            <p>
              {status === 'restoring'
                ? 'Carregando o histórico salvo neste navegador'
                : status === 'indexing'
                ? `Gerando embedding do trecho ${progress.current} de ${progress.total}`
                : progress.total > 0
                  ? `Extraindo o texto da página ${progress.current} de ${progress.total}`
                  : 'Preparando o arquivo para leitura'}
            </p>
            <div className="progress-track" aria-label="Progresso da leitura">
              <span style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 8}%` }} />
            </div>
          </>
        ) : (
          <>
            <div className="upload-icon"><FileUp size={28} /></div>
            <h2>Comece enviando seu material</h2>
            <p>Arraste um arquivo PDF para cá ou escolha no seu dispositivo.</p>
            <button className="primary-button" onClick={() => inputRef.current?.click()}>
              <Upload size={17} />
              Escolher PDF
            </button>
            <span className="file-hint">Apenas PDF · Máximo 20 MB</span>
          </>
        )}
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          onChange={chooseFile}
          disabled={isProcessing}
        />
      </div>

      {error && (
        <div className="error-card" role="alert">
          <AlertCircle size={21} />
          <div>
            <strong>{error.title}</strong>
            <p>{error.message}</p>
          </div>
        </div>
      )}

      <div className="privacy-note">
        <ShieldCheck size={16} />
        <span>Seu PDF não é enviado. Texto, índice e conversas ficam salvos somente neste navegador.</span>
      </div>
    </section>
  )
}
