"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRoomForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name }),
      });
      const json = (await response.json()) as { room?: { id: string }; error?: string };
      if (!response.ok || !json.room) {
        throw new Error(json.error ?? "Failed to create room.");
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
        <label htmlFor="create-name">Your fighter name</label>
        <input
          id="create-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Rig Master"
          maxLength={24}
          required
        />
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="form-actions">
        <button className="button button--full" type="submit" disabled={loading}>
          {loading ? "Building room..." : "Create a private room"}
        </button>
      </div>
    </form>
  );
}
