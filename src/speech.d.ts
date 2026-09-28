interface LuminaSpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  readonly [index: number]: { readonly transcript: string }
}

interface LuminaSpeechRecognitionEvent extends Event {
  readonly results: {
    readonly length: number
    readonly [index: number]: LuminaSpeechRecognitionResult
  }
}

interface LuminaSpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface LuminaSpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: LuminaSpeechRecognitionEvent) => void) | null
  onerror: ((event: LuminaSpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface LuminaSpeechRecognitionConstructor {
  new (): LuminaSpeechRecognition
}

interface Window {
  SpeechRecognition?: LuminaSpeechRecognitionConstructor
  webkitSpeechRecognition?: LuminaSpeechRecognitionConstructor
}
