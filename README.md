# Ollama Chat

Chat React + TypeScript che parla con un modello in locale tramite Ollama, con risposte in streaming. Nessuna dipendenza oltre a React.

## Avvio

Requisiti: Node 18+ e Ollama attivo con almeno un modello scaricato (`ollama list`).

```bash
npm install
npm run dev
```

Apri http://localhost:5173. Se `gemma4:e2b-it-qat` è installato, l'app lo seleziona in automatico; gli altri modelli si scelgono dal menu in alto.

## Struttura

```
src/
├── ollama.ts    # client API: listModels() e streamChat() (parsing NDJSON)
├── useChat.ts   # hook: storia della chat, streaming, stop, errori, token/s
├── App.tsx      # UI: header, impostazioni, messaggi, composer
├── App.css      # stile (chiaro/scuro automatico)
└── main.tsx
```

`ollama.ts` non dipende da React: puoi riusarlo in Node, in uno script o in React Native.

## Configurazione

Per puntare a un Ollama diverso (per esempio un altro computer in rete), crea `.env.local`:

```
VITE_OLLAMA_URL=http://192.168.1.20:11434
```

Se apri l'app da un'origine diversa da `localhost`/`127.0.0.1`, Ollama bloccherà le richieste (CORS). Autorizza l'origine e riavvia Ollama:

```bash
launchctl setenv OLLAMA_ORIGINS "http://mio-host:5173"
```

## Funzioni

- Streaming token per token, con pulsante Stop (AbortController)
- Scelta del modello tra quelli installati
- System prompt modificabile
- Ragionamento (`think`) opzionale, mostrato in un blocco espandibile
- Token/s a fine risposta, utile per confrontare i modelli
- Messaggio chiaro se Ollama è spento, con pulsante per riprovare

## Idee per i prossimi passi

- Rendering Markdown (`react-markdown` + evidenziazione del codice)
- Allegare immagini: E2B è multimodale, basta aggiungere `images: [base64]` al messaggio
- Tool calling: passare `tools` a `/api/chat` e gestire `message.tool_calls`
- Salvare le conversazioni in `localStorage` o IndexedDB
