# Lumina

Aplicação web em React + TypeScript para transformar documentos em material de estudo.

## Parte 1 — leitura do documento

- Upload de um PDF por conversa.
- Extração local do texto, com separação e identificação por página.
- Busca e filtro pelas páginas extraídas.
- Tratamento de arquivo inválido, protegido, maior que 20 MB ou sem texto extraível.
- Aviso específico para PDFs escaneados, que precisarão de OCR em uma etapa futura.

O processamento acontece no navegador. Nesta etapa, nenhum arquivo é enviado a um servidor e nenhum banco de dados é necessário.

## Parte 2 — indexação e busca

- Divisão do texto em trechos de aproximadamente 900 caracteres, com sobreposição para preservar o contexto.
- Cada trecho mantém o identificador do documento, nome do arquivo, página e posição.
- Geração local de embeddings semânticos de 768 dimensões com o modelo multilíngue `nomic-embed-text-v2-moe` no Ollama.
- Persistência dos textos e embeddings no IndexedDB do navegador.
- Busca dos cinco trechos mais relevantes usando similaridade de cosseno.
- Interface para fazer perguntas e visualizar página, texto e relevância de cada resultado.

O arquivo PDF original não é armazenado. O texto extraído, os embeddings e os dados necessários para reabrir cada conversa permanecem no IndexedDB deste navegador.

## Parte 3 — respostas com RAG

- Recuperação dos cinco trechos mais próximos da pergunta.
- Envio da pergunta, histórico recente e trechos recuperados para um modelo local no Ollama.
- Respostas limitadas às informações presentes nas fontes.
- Retorno estruturado com indicação de evidência suficiente e IDs das fontes.
- Exibição do documento, páginas utilizadas e texto original de cada fonte.
- Mensagem explícita quando o material não contém informação suficiente.
- Processamento local, sem chave de API e sem cobrança por tokens.

### Configurar o Ollama

Instale o [Ollama para Windows](https://docs.ollama.com/windows) e baixe o modelo local:

```powershell
ollama pull qwen3.5:0.8b
ollama pull nomic-embed-text-v2-moe
```

Depois, copie `.env.example` para um novo arquivo chamado `.env`. A configuração padrão é:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:0.8b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text-v2-moe
PORT=3001
```

Os dois modelos ocupam aproximadamente 2 GB no total. O Ollama roda em segundo plano e disponibiliza a API local em `http://localhost:11434`. Nenhuma pergunta ou trecho é enviado para um serviço externo. Depois de alterar o `.env`, reinicie `npm.cmd run dev`.

## Parte 4 — contexto da conversa

- Mantém as perguntas, respostas e fontes durante toda a conversa atual.
- Usa as últimas mensagens para interpretar referências como “isso” e “explique melhor”.
- Enriquece a busca vetorial com a pergunta, a resposta e as fontes anteriores quando identifica uma continuação do assunto.
- Expande siglas como “IA” e identifica outras abreviações a partir dos termos encontrados no documento.
- Antes de buscar, usa o Ollama para reescrever perguntas informais em uma consulta clara; a IA não responde nessa etapa.
- Preserva o histórico ao alternar entre o chat e o texto extraído ou recarregar a página.
- Lista as conversas recentes na barra lateral e permite reabrir cada uma com seu documento e suas fontes.
- Permite iniciar uma nova conversa sem apagar as anteriores.

O histórico fica salvo somente no IndexedDB do navegador atual. Não é necessário banco de dados online; limpar os dados do site também remove as conversas locais.

## Executar

```bash
npm install
npm run dev
```

O comando inicia a interface em `http://localhost:5173` e a API em `http://localhost:3001`.

Para validar a versão de produção:

```bash
npm run build
npm start
```

Para executar os testes dos casos com e sem resposta no material:

```bash
npm test
```

## Estrutura

- `src/lib/pdf.ts`: validação e extração do PDF.
- `src/lib/chunking.ts`: divisão do conteúdo com referência de página.
- `src/lib/embeddings.ts`: cliente dos embeddings locais e similaridade de cosseno.
- `src/lib/vectorStore.ts`: armazenamento dos trechos no IndexedDB.
- `src/lib/conversationStore.ts`: persistência e restauração das conversas e documentos.
- `src/lib/storage.ts`: criação e migração das tabelas locais do IndexedDB.
- `src/lib/search.ts`: classificação dos trechos mais relevantes.
- `src/lib/rag.ts`: comunicação segura entre a interface e o endpoint de RAG.
- `src/components/UploadPanel.tsx`: envio, progresso e estados de erro.
- `src/components/DocumentView.tsx`: conteúdo extraído, organizado por página.
- `src/components/DocumentChat.tsx`: conversa, respostas e fontes utilizadas.
- `src/App.tsx`: estado da conversa atual.
- `server/index.ts`: servidor HTTP, verificação do Ollama e endpoints `/api/chat` e `/api/embeddings`.
- `server/embeddings.ts`: geração dos embeddings semânticos pelo modelo multilíngue do Ollama.
- `server/rag.ts`: integração local com o Ollama, resposta estruturada e validação das citações.

## Próximas evoluções

Um banco de dados online passa a ser útil quando forem adicionados login e sincronização entre dispositivos. OCR também pode ser incorporado para documentos digitalizados.
