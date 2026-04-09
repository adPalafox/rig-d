"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function HomeJoinForm() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const joinCode = code.trim().toUpperCase();
      const response = await fetch(`/api/rooms/code/${joinCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name }),
      });
      const json = (await response.json()) as { room?: { id: string }; error?: string };
      if (!response.ok || !json.room) {
        throw new Error(json.error ?? "Failed to join room.");
      }
      router.push(`/rooms/${json.room.id}`);
      router.refresh();
    } catch (submissionError) {
      setError((submissionError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field-grid">
        <div className="form-field">
          <label htmlFor="home-code">Invite code</label>
          <input
            id="home-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="A1B2C"
            maxLength={5}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="home-name">Your name</label>
          <input
            id="home-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bandana Wizard"
            maxLength={24}
            required
          />
        </div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="form-actions">
        <button className="ghost-button button--full" type="submit" disabled={loading}>
          {loading ? "Joining room..." : "Join with invite code"}
        </button>
      </div>
    </form>
  );
}
