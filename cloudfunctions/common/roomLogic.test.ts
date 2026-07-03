import { describe, expect, it } from "vitest";
import {
  applyRoomEvent,
  assignSeats,
  createInitialRoom,
  generateUniqueRoomCode,
  makeRoomCode,
  PlayerState,
  undoLastEvent,
  validateDeltas
} from "./roomLogic";

function players(count: number): PlayerState[] {
  return Array.from({ length: count }, (_, index) => ({
    openid: `openid_${index + 1}`,
    nickName: `玩家${index + 1}`,
    seat: "east",
    score: 25000
  }));
}

describe("room code generation", () => {
  it("formats 6 digit numeric codes", () => {
    expect(makeRoomCode(() => 0)).toBe("000000");
    expect(makeRoomCode(() => 0.123456)).toBe("123456");
    expect(makeRoomCode(() => 0.9999999)).toBe("999999");
  });

  it("retries when a generated code already exists", () => {
    const values = [0.123456, 0.654321];
    const code = generateUniqueRoomCode(new Set(["123456"]), () => values.shift() ?? 0);
    expect(code).toBe("654321");
  });
});

describe("seat assignment", () => {
  it("assigns 3 player seats without north", () => {
    expect(assignSeats(players(3), "3p").map((player) => player.seat)).toEqual([
      "east",
      "south",
      "west"
    ]);
  });

  it("assigns 4 player seats in east south west north order", () => {
    expect(assignSeats(players(4), "4p").map((player) => player.seat)).toEqual([
      "east",
      "south",
      "west",
      "north"
    ]);
  });
});

describe("event delta validation", () => {
  it("accepts deltas that conserve points with riichi sticks", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      now: 1
    });

    expect(() =>
      validateDeltas(room.players, { openid_1: -1000 }, 1)
    ).not.toThrow();
  });

  it("rejects deltas that do not conserve points", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      now: 1
    });

    expect(() => validateDeltas(room.players, { openid_1: 500 }, 0)).toThrow(
      "玩家分差总和必须与供托变化保持守恒"
    );
  });
});

describe("event application and undo", () => {
  it("applies a riichi event and restores it with undo", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      now: 1
    });

    const afterRiichi = applyRoomEvent(
      room,
      {
        type: "riichi",
        actorOpenid: "openid_1",
        deltas: { openid_1: -1000 },
        riichiStickDelta: 1
      },
      2
    );

    expect(afterRiichi.players[0].score).toBe(24000);
    expect(afterRiichi.round.riichiSticks).toBe(1);

    const afterUndo = undoLastEvent(afterRiichi, "openid_1", 3);
    expect(afterUndo.players[0].score).toBe(25000);
    expect(afterUndo.round.riichiSticks).toBe(0);
    expect(afterUndo.events.at(-1)?.type).toBe("undo");
    expect(afterUndo.events.at(-1)?.undoneEventId).toBe(afterRiichi.events[0].id);
  });
});
