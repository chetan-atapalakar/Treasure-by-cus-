import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import { errorMessage } from "../lib/net";
import { askAssistant } from "../services/platform";
import type { ChatMessage } from "../types/platform";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./extra.css";

const SUGGESTED = [
  "Where did most of my money go this month?",
  "Compare my spending with last month.",
  "What payments are coming up in the next 30 days?",
  "How am I doing on my savings goals?",
];

export default function Assistant() {
  const { demo } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  const last = useRef<{ text: string; base: ChatMessage[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, error]);

  async function send(question: string, base: ChatMessage[]) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...base, { role: "user", content: q }];
    setMessages(history);
    setText("");
    setError(null);
    setBusy(true);
    last.current = { text: q, base };
    const token = ++run.current;
    try {
      const reply = await askAssistant(history);
      if (token !== run.current) return;
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      if (token !== run.current) return;
      setError(errorMessage(e, "The assistant could not answer right now."));
    } finally {
      if (token === run.current) setBusy(false);
    }
  }

  function stop() {
    run.current++;
    setBusy(false);
    setError("Stopped waiting for the answer. The request may still have counted toward today's allowance.");
  }

  function clear() {
    run.current++;
    setMessages([]);
    setError(null);
    setBusy(false);
    last.current = null;
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">AI assistant</h1>
          <p>The assistant answers from your own recorded data, so it needs a signed-in account.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="dash" aria-labelledby="ai-title" style={{ maxWidth: 760 }}>
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Assistant</p>
          <h1 className="dash__title" id="ai-title">Ask about your money</h1>
        </div>
        {messages.length > 0 && (
          <button type="button" className="link-btn" onClick={clear}><Trash2 size={14} aria-hidden="true" /> Clear conversation</button>
        )}
      </header>

      <div className="notice" role="note">
        <p style={{ margin: 0 }}>
          The assistant reads only the records needed for each question and works from what you have recorded, not from your bank. It is not a licensed
          financial, tax or legal adviser. This conversation is not saved after you leave or clear it.
        </p>
      </div>

      <section className="card chat" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 && (
          <>
            <p className="acct__note" style={{ margin: 0 }}>Try one of these:</p>
            <div className="chips-row">
              {SUGGESTED.map((s) => (
                <button key={s} type="button" className="chip-btn" onClick={() => send(s, [])}>{s}</button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "bubble--user" : "bubble--ai"}`}>
            <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
            {m.content}
          </div>
        ))}
        {busy && (
          <>
            <QuoteLoader size="sm" message="Thinking through your question..." />
            <button type="button" className="link-btn" onClick={stop} style={{ alignSelf: "center" }}>Stop waiting</button>
          </>
        )}
        {error && (
          <div className="dash__error" role="alert">
            <p>{error}</p>
            {last.current && (
              <button type="button" className="btn btn--sm" onClick={() => last.current && send(last.current.text, last.current.base)}>
                <RotateCcw size={16} aria-hidden="true" style={{ marginRight: 6 }} /> Retry
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form className="chat__form" onSubmit={(e: FormEvent) => { e.preventDefault(); send(text, messages); }}>
        <label className="sr-only" htmlFor="ai-input">Your question</label>
        <input id="ai-input" className="input" type="text" maxLength={1000} placeholder="Ask a question about your recorded finances" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
        <button type="submit" className="btn" disabled={busy || text.trim() === ""}>Send</button>
      </form>
    </main>
  );
}