"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { DEFAULT_TOPIC, findTopic, topics } from "@/lib/pseudocode/topics";
import { renderMarkdown } from "@/lib/pseudocode/markdown";

type Message = {
  role: "user" | "assistant" | "divider";
  content: string;
  hidden?: boolean;
  label?: string;
  error?: boolean;
  pending?: boolean;
};
type ChatState = { topic: string; messages: Message[] };

const STORAGE_KEY = "pseudocode-coach-v1";
const GREETING =
  "Hi! Let's practice writing **pseudocode** for your FTC robot.\n\n" +
  "Pseudocode is a plan for your robot's program written in plain, step-by-step words, before you write any Java or Blocks. For example:\n\n" +
  "```\nWAIT FOR START\nSET distanceCm = READ distance sensor\nIF distanceCm <= 15 THEN\n  STOP drivetrain\nELSE\n  DRIVE forward at power 0.3\nEND IF\n```\n\n" +
  "Pick a topic at the top and I'll give you a robot challenge. You can also just tell me what you'd like your robot to do.";
const QUICK_ACTIONS: [string, string][] = [
  ["Give me a hint", "Give me a hint for this challenge, but don't give away the answer."],
  ["Show an example", "Show me a short example of this idea that is different from my challenge."],
  ["Next challenge", "Give me the next challenge, a little harder than the last one."],
];

const fresh = (): ChatState => ({ topic: DEFAULT_TOPIC, messages: [{ role: "assistant", content: GREETING }] });

function load(): ChatState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const valid =
      saved &&
      findTopic(saved.topic) &&
      Array.isArray(saved.messages) &&
      saved.messages.length > 0 &&
      saved.messages.every(
        (m: Message) => m && typeof m.content === "string" && ["user", "assistant", "divider"].includes(m.role),
      );
    if (valid) return { topic: saved.topic, messages: saved.messages.filter((m: Message) => !m.pending) };
  } catch {}
  return fresh();
}

// What the coach sees: the conversation, including hidden topic requests, minus dividers and errors.
const conversation = (messages: Message[]) =>
  messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && !m.error && !m.pending && m.content.trim())
    .map(({ role, content }) => ({ role, content }));

export default function PseudocodeCoach() {
  const [chat, setChat] = useState<ChatState>(fresh);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);
  const chatRef = useRef<ChatState>(chat);
  const scrollRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  const update = (next: ChatState) => {
    chatRef.current = next;
    setChat(next);
  };

  useEffect(() => {
    update(load());
    fetch("/api/pseudocode/status")
      .then((res) => res.json())
      .then((data) => setAi(Boolean(data.ai)))
      .catch(() => setAi(false));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 260)}px`;
  }, [draft]);

  const save = (state: ChatState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  };

  async function ask(base: ChatState) {
    const body = JSON.stringify({ topic: base.topic, messages: conversation(base.messages) });
    let reply: Message = { role: "assistant", content: "", pending: true };
    const replace = (next: Message) => {
      reply = next;
      const messages = [...chatRef.current.messages];
      messages[messages.length - 1] = next;
      update({ ...chatRef.current, messages });
    };
    stickToBottom.current = true;
    update({ ...base, messages: [...base.messages, reply] });
    setBusy(true);

    try {
      const response = await fetch("/api/pseudocode/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok || !response.body) {
        let message = "The coach could not answer. Please try again.";
        try {
          message = (await response.json()).error || message;
        } catch {}
        throw new Error(message);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        replace({ ...reply, content: reply.content + decoder.decode(value, { stream: true }) });
      }
      if (!reply.content.trim()) throw new Error("The coach did not send a reply. Please try again.");
      replace({ role: "assistant", content: reply.content });
    } catch (error) {
      if (reply.content.trim()) {
        replace({ role: "assistant", content: `${reply.content}\n\n(The connection dropped. Try sending your message again.)` });
      } else {
        const message =
          error instanceof TypeError ? "Could not reach the coach. Check your connection and try again." : (error as Error).message;
        replace({ role: "assistant", content: message, error: true });
      }
    } finally {
      setBusy(false);
      save(chatRef.current);
      inputRef.current?.focus();
    }
  }

  function sendText(text: string, label?: string) {
    if (busy || !text.trim()) return;
    const message: Message = { role: "user", content: text, ...(label ? { label } : {}) };
    ask({ ...chatRef.current, messages: [...chatRef.current.messages, message] });
  }

  function selectTopic(id: string) {
    const topic = findTopic(id);
    if (busy || !topic || id === chatRef.current.topic) return;
    ask({
      topic: id,
      messages: [
        ...chatRef.current.messages,
        { role: "divider", content: topic.label },
        {
          role: "user",
          hidden: true,
          content: `I want to practice: ${topic.label}. Introduce the idea in 2-3 short sentences with a tiny robot example, then give me my first robot practice challenge.`,
        },
      ],
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    const text = draft;
    setDraft("");
    sendText(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    } else if (event.key === "Tab" && !event.shiftKey) {
      // Indent pseudocode with Tab (two spaces). Press Esc first to Tab out of the box.
      event.preventDefault();
      const el = event.currentTarget;
      el.setRangeText("  ", el.selectionStart, el.selectionEnd, "end");
      setDraft(el.value);
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  }

  function newChat() {
    if (busy) return;
    const state = fresh();
    update(state);
    save(state);
    inputRef.current?.focus();
  }

  return (
    <div className="pc-app">
      <header className="pc-topbar">
        <div className="pc-brand">
          <span className="pc-mark" aria-hidden="true">{"{ }"}</span>
          <div className="pc-brand-text">
            <strong>FTC Pseudocode Coach</strong>
            <span className="pc-status" data-state={ai === null ? "checking" : ai ? "online" : "offline"}>
              {ai === null ? "Connecting…" : ai ? "Coach online" : "Coach offline"}
            </span>
          </div>
        </div>
        <button className="pc-ghost" type="button" onClick={newChat} disabled={busy}>
          New chat
        </button>
      </header>

      <nav className="pc-topics" aria-label="Practice topic">
        <span className="pc-topics-label">Practice</span>
        <div className="pc-topic-list">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="pc-topic"
              title={topic.blurb}
              aria-pressed={topic.id === chat.topic}
              disabled={busy}
              onClick={() => selectTopic(topic.id)}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </nav>

      <main
        className="pc-chat"
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        }}
      >
        <div className="pc-messages" role="log" aria-label="Conversation with the coach">
          {chat.messages.map((message, i) => {
            if (message.hidden) return null;
            if (message.role === "divider") {
              return (
                <div key={i} className="pc-divider">
                  <span>Now practicing · {message.content}</span>
                </div>
              );
            }
            const classes = ["pc-msg", message.role, message.error && "error", message.label && "action"].filter(Boolean).join(" ");
            return (
              <div key={i} className={classes}>
                {message.role === "assistant" && <span className="pc-avatar" aria-hidden="true">{"{ }"}</span>}
                {message.pending && !message.content ? (
                  <div className="pc-bubble">
                    <span className="pc-typing" role="status" aria-label="Coach is typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                ) : message.role === "user" ? (
                  <div className="pc-bubble">{message.label || message.content}</div>
                ) : (
                  <div className="pc-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="pc-composer">
        <div className="pc-composer-inner">
          <div className="pc-quick">
            {QUICK_ACTIONS.map(([label, text]) => (
              <button key={label} type="button" className="pc-chip" disabled={busy} onClick={() => sendText(text, label)}>
                {label}
              </button>
            ))}
          </div>
          <form className="pc-input-row" onSubmit={submit}>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Write your pseudocode or ask a question…"
              aria-label="Your message"
              spellCheck={false}
            />
            <button className="pc-send" type="submit" disabled={busy || !draft.trim()}>
              Send
            </button>
          </form>
          <p className="pc-fineprint">Enter to send · Shift+Enter for a new line · The coach can make mistakes.</p>
        </div>
      </footer>
    </div>
  );
}
