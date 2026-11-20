import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { listModels, OLLAMA_URL } from "./ollama";
import { useChat } from "./useChat";
import "./App.css";

const PREFERRED_MODEL = "gemma4:e2b-it-qat";
const DEFAULT_SYSTEM_PROMPT = "Sei un assistente utile. Rispondi in italiano, in modo chiaro e conciso.";

type Connection = "checking" | "online" | "offline";

export default function App() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [connection, setConnection] = useState<Connection>("checking");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [think, setThink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");

  const { messages, isStreaming, error, stats, send, stop, reset } = useChat({
    model,
    systemPrompt,
    think,
  });

  // --- Connessione e lista modelli ---------------------------------------
  const loadModels = useCallback(async () => {
    setConnection("checking");
    try {
      const names = await listModels();
      setModels(names);
      setModel((current) =>
        current && names.includes(current)
          ? current
          : names.includes(PREFERRED_MODEL)
            ? PREFERRED_MODEL
            : (names[0] ?? ""),
      );
      setConnection("online");
    } catch {
      setConnection("offline");
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  // --- Auto-scroll mentre arriva la risposta -----------------------------
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // --- Invio --------------------------------------------------------------
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (isStreaming || !input.trim()) return;
    void send(input);
    setInput("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Invio = manda, Shift+Invio = a capo
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className={`dot dot--${connection}`} title={connection} />
          <h1>Ollama Chat</h1>
        </div>

        <div className="controls">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={connection !== "online" || isStreaming}
            aria-label="Modello"
          >
            {models.length === 0 && <option value="">Nessun modello</option>}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
            Impostazioni
          </button>
          <button className="ghost" onClick={reset} disabled={messages.length === 0}>
            Nuova chat
          </button>
        </div>
      </header>

      {showSettings && (
        <section className="settings">
          <label>
            System prompt
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={think} onChange={(e) => setThink(e.target.checked)} />
            Mostra il ragionamento (think) — più lento, solo modelli che lo supportano
          </label>
        </section>
      )}

      {connection === "offline" && (
        <div className="banner banner--error">
          Ollama non risponde su <code>{OLLAMA_URL}</code>. Avvia l'app Ollama (o <code>ollama serve</code>) e{" "}
          <button className="link" onClick={loadModels}>
            riprova
          </button>
          .
        </div>
      )}

      <main className="messages">
        {messages.length === 0 && connection === "online" && (
          <div className="empty">
            <p>
              Stai parlando con <strong>{model || "—"}</strong>, in locale sul tuo Mac.
            </p>
            <p className="muted">Invio per mandare, Shift+Invio per andare a capo.</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const isPending = isStreaming && isLast && m.role === "assistant" && !m.content;
          return (
            <article key={i} className={`bubble bubble--${m.role}`}>
              {m.thinking && (
                <details className="thinking">
                  <summary>Ragionamento</summary>
                  <p>{m.thinking}</p>
                </details>
              )}
              {isPending ? <span className="typing" aria-label="Sta scrivendo" /> : <p>{m.content}</p>}
            </article>
          );
        })}

        {error && <div className="banner banner--error">{error}</div>}
        <div ref={endRef} />
      </main>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={connection === "online" ? "Scrivi un messaggio…" : "In attesa di Ollama…"}
          disabled={connection !== "online"}
          rows={1}
          autoFocus
        />
        {isStreaming ? (
          <button type="button" className="stop" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() || connection !== "online" || !model}>
            Invia
          </button>
        )}
      </form>

      <footer className="status">
        {stats
          ? `${stats.tokens} token · ${stats.tokensPerSecond.toFixed(1)} token/s`
          : isStreaming
            ? "Generazione in corso…"
            : " "}
      </footer>
    </div>
  );
}
