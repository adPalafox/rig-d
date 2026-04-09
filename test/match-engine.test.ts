import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayer,
  createRoom,
  getMatchSnapshot,
  joinRoomByCode,
  setReady,
  submitCoaching,
} from "@/lib/store";

function coaching(overrides: Partial<{
  gamePlan: string;
  tone: string;
  whenAttacked: string;
  avoidThisMistake: string;
  secretNote: string;
}> = {}) {
  return {
    gamePlan: "One thesis, one concrete example, keep it short.",
    tone: "Calm and precise.",
    whenAttacked: "Point out the missing evidence and return to the example.",
    avoidThisMistake: "Do not ramble or overclaim.",
    secretNote: "Win the close with a single memorable line.",
    ...overrides,
  };
}

test("full match flows from room creation to reveal", async () => {
  const alpha = createPlayer("Alpha");
  const bravo = createPlayer("Bravo");
  const roomSnapshot = createRoom(alpha.id, "http://localhost:3000");
  const joined = joinRoomByCode(roomSnapshot.room.code, bravo.id, "http://localhost:3000");

  assert.equal(joined.players.length, 2);

  setReady(joined.match.id, alpha.id, "http://localhost:3000");
  const afterReadyTwo = setReady(joined.match.id, bravo.id, "http://localhost:3000");
  assert.equal(afterReadyTwo.match.state, "coaching_open");

  submitCoaching(afterReadyTwo.match.id, alpha.id, coaching(), "http://localhost:3000");
  submitCoaching(
    afterReadyTwo.match.id,
    bravo.id,
    coaching({ gamePlan: "Go broad, use swagger, improvise everything." }),
    "http://localhost:3000",
  );

  let finalSnapshot = getMatchSnapshot(afterReadyTwo.match.id, alpha.id, "http://localhost:3000");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (["reveal_ready", "completed"].includes(finalSnapshot.match.state)) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    finalSnapshot = getMatchSnapshot(afterReadyTwo.match.id, alpha.id, "http://localhost:3000");
  }

  assert.ok(["reveal_ready", "completed"].includes(finalSnapshot.match.state));
  assert.ok(finalSnapshot.judgeResult);
  assert.equal(finalSnapshot.turnLog.length, 6);
});

test("structured coaching meaningfully shifts actual performance", async () => {
  const alpha = createPlayer("Coach Prime");
  const bravo = createPlayer("Coach Loose");
  const roomSnapshot = createRoom(alpha.id, "http://localhost:3000");
  const joined = joinRoomByCode(roomSnapshot.room.code, bravo.id, "http://localhost:3000");
  setReady(joined.match.id, alpha.id, "http://localhost:3000");
  const ready = setReady(joined.match.id, bravo.id, "http://localhost:3000");

  submitCoaching(ready.match.id, alpha.id, coaching(), "http://localhost:3000");
  submitCoaching(
    ready.match.id,
    bravo.id,
    coaching({
      gamePlan: "Just vibe.",
      tone: "Loud.",
      whenAttacked: "Talk faster.",
      avoidThisMistake: "None.",
    }),
    "http://localhost:3000",
  );

  let finalSnapshot = getMatchSnapshot(ready.match.id, alpha.id, "http://localhost:3000");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (["reveal_ready", "completed"].includes(finalSnapshot.match.state)) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    finalSnapshot = getMatchSnapshot(ready.match.id, alpha.id, "http://localhost:3000");
  }

  const scores = finalSnapshot.players.map((player) => player.actualScore ?? 0);
  assert.equal(scores.length, 2);
  assert.notEqual(scores[0], scores[1]);
  assert.ok(finalSnapshot.players.some((player) => typeof player.rigScore === "number"));
});
