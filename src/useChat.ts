import { useCallback, useRef, useState } from "react";
import { OLLAMA_URL, streamChat, type ChatMessage } from "./ollama";

export interface ChatStats {
  tokens: number;
  tokensPerSecond: number;
}

interface UseChatOptions {
  model: string;
  systemPrompt: string;
  think: boolean;
}

export function useChat({ model, systemPrompt, think }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !model || abortRef.current) return;

      // Il modello non ha memoria: a ogni richiesta rimandiamo tutta la storia.
      const history: ChatMessage[] = [...messages, { role: "user", content }];
      const payload: ChatMessage[] = systemPrompt.trim()
        ? [{ role: "system", content: systemPrompt.trim() }, ...history]
        : history;

      // Aggiungiamo subito un messaggio assistant vuoto da riempire in streaming.
      setMessages([...history, { role: "assistant", content: "" }]);
      setError(null);
      setStats(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const chunk of streamChat({
          model,
          messages: payload,
          think,
          signal: controller.signal,
        })) {
          if (chunk.message) {
            const { content: delta = "", thinking } = chunk.message;
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                content: last.content + delta,
                thinking: thinking ? (last.thinking ?? "") + thinking : last.thinking,
              };
              return next;
            });
          }
          if (chunk.done && chunk.eval_count && chunk.eval_duration) {
            setStats({
              tokens: chunk.eval_count,
              tokensPerSecond: chunk.eval_count / (chunk.eval_duration / 1e9),
            });
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return; // fermato dall'utente: non è un errore
        setError(toMessage(err));
        // Se non è arrivato nulla, togliamo la bolla vuota dell'assistente.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
        });
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [messages, model, systemPrompt, think],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStats(null);
  }, []);

  return { messages, isStreaming, error, stats, send, stop, reset };
}

function toMessage(err: unknown): string {
  // fetch lancia TypeError quando il server non risponde (Ollama spento, CORS…).
  if (err instanceof TypeError) {
    return `Non riesco a raggiungere Ollama su ${OLLAMA_URL}. È avviato?`;
  }
  return err instanceof Error ? err.message : String(err);
}
