import { JoinRoomForm } from "@/components/JoinRoomForm";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="surface surface--secondary hero-card">
          <span className="eyebrow">Join Room</span>
          <h1 className="title">Step into room {code.toUpperCase()}</h1>
          <p className="subtitle">
            Choose a name, enter the room, and get ready to coach whatever fighter lands on your side of the bracket.
          </p>
        </div>
        <div className="surface surface--primary cta-card">
          <JoinRoomForm code={code.toUpperCase()} />
        </div>
      </section>
    </main>
  );
}
