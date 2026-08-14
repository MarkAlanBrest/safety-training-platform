"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound, Link2, Loader2 } from "lucide-react";

type Props = {
  onConnected: () => void;
};

export function CanvasConnectForm({ onConnected }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/canvas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not connect to Canvas.");
      }
      onConnected();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not connect to Canvas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="canvas-connect-card">
      <div className="canvas-connect-icon">
        <AlertTriangle size={34} />
      </div>
      <h1>Connect your Canvas account</h1>
      <p>
        Link your school&apos;s Canvas site with a personal access token. We only use it to read your
        missing assignments and grades — nothing is stored in our database.
      </p>

      <form onSubmit={handleSubmit} className="canvas-connect-form">
        <label>
          <span className="canvas-label">
            <Link2 size={16} /> Canvas URL
          </span>
          <input
            type="text"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="yourschool.instructure.com"
            required
            autoComplete="url"
          />
        </label>

        <label>
          <span className="canvas-label">
            <KeyRound size={16} /> Access token
          </span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste your Canvas API token"
            required
            autoComplete="off"
          />
        </label>

        {error ? <p className="canvas-error">{error}</p> : null}

        <button type="submit" className="canvas-primary-btn" disabled={loading}>
          {loading ? <Loader2 className="canvas-spin" size={18} /> : null}
          {loading ? "Connecting..." : "Connect and scan for alerts"}
        </button>
      </form>

      <details className="canvas-help">
        <summary>How do I get a Canvas access token?</summary>
        <ol>
          <li>Log in to Canvas in your browser.</li>
          <li>Open Account → Settings.</li>
          <li>Scroll to Approved Integrations and click New Access Token.</li>
          <li>Name it (for example, &quot;Assignment Alerts&quot;) and generate the token.</li>
          <li>Copy the token immediately — Canvas only shows it once.</li>
        </ol>
      </details>
    </div>
  );
}
