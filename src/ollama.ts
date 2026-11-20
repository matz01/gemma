// Client minimale per l'API nativa di Ollama (nessuna dipendenza).
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

export const OLLAMA_URL: string =
  import.meta.env?.VITE_OLLAMA_URL ?? "http://localhost:11434";

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
  /** Ragionamento del modello, presente solo se "think" è attivo. */
  thinking?: string;
}

/** Una riga dello stream NDJSON restituito da POST /api/chat. */
export interface ChatChunk {
  message?: { role: Role; content: string; thinking?: string };
  done: boolean;
  /** Presenti solo nell'ultimo chunk (done: true). */
  eval_count?: number;
  eval_duration?: number; // nanosecondi
  error?: string;
}

/** Modelli installati in locale (equivale a `ollama list`). */
export async function listModels(signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal });
  if (!res.ok) throw new Error(`Ollama ha risposto ${res.status}`);
  const data: { models: { name: string }[] } = await res.json();
  return data.models.map((m) => m.name).sort();
}

interface StreamChatOptions {
  model: string;
  messages: ChatMessage[];
  think?: boolean;
  signal?: AbortSignal;
}

/**
 * Invia la conversazione e restituisce i pezzi di risposta man mano che arrivano.
 * Ollama risponde con NDJSON: un oggetto JSON per riga.
 */
export async function* streamChat({
  model,
  messages,
  think,
  signal,
}: StreamChatOptions): AsyncGenerator<ChatChunk> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    // Niente header Content-Type: così è una "simple request" e il browser
    // non fa il preflight CORS. Ollama legge comunque il body come JSON.
    body: JSON.stringify({
      model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream: true,
      ...(think ? { think: true } : {}),
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(extractError(text) ?? `Ollama ha risposto ${res.status}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // Una riga può arrivare spezzata su due chunk di rete: teniamo da parte
    // l'ultimo pezzo finché non arriva il suo "\n".
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const chunk = parseLine(line);
      if (chunk) yield chunk;
    }
  }

  const last = parseLine(buffer);
  if (last) yield last;
}

function parseLine(line: string): ChatChunk | null {
  if (!line.trim()) return null;
  const chunk = JSON.parse(line) as ChatChunk;
  if (chunk.error) throw new Error(chunk.error);
  return chunk;
}

function extractError(text: string): string | null {
  try {
    return (JSON.parse(text) as { error?: string }).error ?? null;
  } catch {
    return text || null;
  }
}
