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
        <div className="hero-card">
          <span className="eyebrow">Join Room</span>
          <h1 className="title">Step into room {code.toUpperCase()}</h1>
          <p className="subtitle">
            Choose a name, enter the arena, and see if you can out-coach whatever agent gets dropped on your side.
          </p>
        </div>
        <div className="cta-card">
          <JoinRoomForm code={code.toUpperCase()} />
        </div>
      </section>
    </main>
  );
}
