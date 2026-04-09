"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  code: string;
};

export function JoinRoomForm({ code }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/code/${code}/join`, {
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
      <div className="form-field">
        <label htmlFor="join-name">Choose your name</label>
        <input
          id="join-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Bandana Wizard"
          maxLength={24}
          required
        />
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="form-actions">
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Joining..." : `Join room ${code}`}
        </button>
      </div>
    </form>
  );
}
