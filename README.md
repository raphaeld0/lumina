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
- Geração local de embeddings vetoriais de 384 dimensões.
- Persistência dos textos e embeddings no IndexedDB do navegador.
- Busca dos cinco trechos mais relevantes usando similaridade de cosseno.
- Interface para fazer perguntas e visualizar página, texto e relevância de cada resultado.

O arquivo PDF original não é armazenado. Ao iniciar uma nova conversa, o índice do documento anterior é removido.

## Executar

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## Estrutura

- `src/lib/pdf.ts`: validação e extração do PDF.
- `src/lib/chunking.ts`: divisão do conteúdo com referência de página.
- `src/lib/embeddings.ts`: geração dos vetores e similaridade de cosseno.
- `src/lib/vectorStore.ts`: armazenamento dos trechos no IndexedDB.
- `src/lib/search.ts`: classificação dos trechos mais relevantes.
- `src/components/UploadPanel.tsx`: envio, progresso e estados de erro.
- `src/components/DocumentView.tsx`: conteúdo extraído, organizado por página.
- `src/components/SemanticSearch.tsx`: perguntas e resultados da busca vetorial.
- `src/App.tsx`: estado da conversa atual.

## Próximas evoluções

Um backend e um banco de dados passam a ser úteis quando forem adicionados login, histórico persistente de conversas, armazenamento de arquivos ou integração com um modelo de IA. OCR também pode ser incorporado para documentos digitalizados.
