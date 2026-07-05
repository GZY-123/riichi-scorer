import { describe, expect, it } from "vitest";
import {
  applyRoomEvent,
  assignSeats,
  createInitialRoom,
  defaultRules,
  formatRoomHistoryDateLabel,
  generateUniqueRoomCode,
  joinPlayer,
  makeRoomCode,
  normalizeRoomEventDetail,
  normalizeUserProfile,
  PlayerState,
  resolveRules,
  resolveUserProfile,
  RoomDocument,
  toMyRoomSummary,
  undoLastEvent,
  validateRules,
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

describe("room rules", () => {
  it("returns mode-specific default rules", () => {
    expect(defaultRules("4p")).toEqual({
      length: "hanchan",
      startScore: 25000,
      returnScore: 30000,
      uma: [20, 10, -10, -20],
      tobi: true,
      kiriageMangan: false,
      tsumoLoss: false
    });
    expect(defaultRules("3p")).toEqual({
      length: "hanchan",
      startScore: 35000,
      returnScore: 40000,
      uma: [15, 0, -15],
      tobi: true,
      kiriageMangan: false,
      tsumoLoss: false
    });
  });

  it("validates supported rule payloads", () => {
    expect(
      validateRules("4p", {
        length: "east",
        startScore: 30000,
        returnScore: 30000,
        uma: [10, 5, -5, -10],
        tobi: false,
        kiriageMangan: true,
        tsumoLoss: false
      })
    ).toEqual({
      length: "east",
      startScore: 30000,
      returnScore: 30000,
      uma: [10, 5, -5, -10],
      tobi: false,
      kiriageMangan: true,
      tsumoLoss: false
    });
  });

  it("rejects invalid score and uma settings", () => {
    const valid = defaultRules("4p");

    expect(() => validateRules("4p", { ...valid, startScore: 999 })).toThrow(
      "起始点必须是 1000-99999 的百点整数"
    );
    expect(() => validateRules("4p", { ...valid, startScore: 25050 })).toThrow(
      "起始点必须是 1000-99999 的百点整数"
    );
    expect(() => validateRules("4p", { ...valid, returnScore: 24000 })).toThrow("返点不能低于起始点");
    expect(() => validateRules("4p", { ...valid, uma: [20, 10, -30] })).toThrow(
      "4p 顺位马必须有 4 项"
    );
    expect(() => validateRules("3p", { ...defaultRules("3p"), uma: [15, 5, -15] })).toThrow(
      "顺位马总和必须为 0"
    );
  });

  it("resolves old room documents without stored rules to defaults", () => {
    const oldRoom: Pick<RoomDocument, "mode" | "rules"> = { mode: "4p" };
    expect(resolveRules(oldRoom)).toEqual(defaultRules("4p"));
  });

  it("uses rule start scores for room creation and later joins", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      rules: { ...defaultRules("4p"), startScore: 30000, returnScore: 30000 },
      now: 1
    });
    const joined = joinPlayer(room, "openid_2", "南家", 2);

    expect(room.rules?.startScore).toBe(30000);
    expect(room.players[0].score).toBe(30000);
    expect(joined.room.players[1].score).toBe(30000);
  });
});

describe("user profile validation", () => {
  it("normalizes nicknames and optional avatar file ids", () => {
    expect(
      normalizeUserProfile({
        nickName: "  立直玩家  ",
        avatarFileId: "  cloud://env.avatars/openid  "
      })
    ).toEqual({
      nickName: "立直玩家",
      avatarFileId: "cloud://env.avatars/openid"
    });

    expect(normalizeUserProfile({ nickName: "南家", avatarFileId: "  " })).toEqual({
      nickName: "南家"
    });
  });

  it("rejects empty and overlong nicknames", () => {
    expect(() => normalizeUserProfile({ nickName: " " })).toThrow("昵称不能为空");
    expect(() => normalizeUserProfile({ nickName: "一二三四五六七八九十一二三四五六七" })).toThrow(
      "昵称最多 16 个字符"
    );
  });

  it("prefers stored user records over frontend fallback profile data", () => {
    expect(
      resolveUserProfile(
        { nickName: "云端玩家", avatarFileId: "cloud://stored-avatar" },
        { nickName: "前端玩家", avatarFileId: "cloud://fallback-avatar" }
      )
    ).toEqual({
      nickName: "云端玩家",
      avatarFileId: "cloud://stored-avatar"
    });
  });
});

describe("player profile merging", () => {
  it("writes avatar file ids into the initial room player", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      creatorAvatarFileId: "cloud://avatar/east",
      now: 1
    });

    expect(room.players[0]).toMatchObject({
      openid: "openid_1",
      nickName: "东家",
      avatarFileId: "cloud://avatar/east",
      seat: "east",
      score: 25000
    });
  });

  it("adds avatars for new joins and refreshes them on repeated joins", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      now: 1
    });

    const joined = joinPlayer(room, "openid_2", "南家", 2, "cloud://avatar/south");
    expect(joined.restored).toBe(false);
    expect(joined.room.players[1]).toMatchObject({
      openid: "openid_2",
      nickName: "南家",
      avatarFileId: "cloud://avatar/south",
      seat: "south",
      score: 25000
    });

    const scoredRoom = {
      ...joined.room,
      players: joined.room.players.map((player) =>
        player.openid === "openid_2" ? { ...player, score: 27000 } : player
      )
    };
    const restored = joinPlayer(scoredRoom, "openid_2", "新南家", 3, "cloud://avatar/south-new");

    expect(restored.restored).toBe(true);
    expect(restored.room.players[1]).toMatchObject({
      openid: "openid_2",
      nickName: "新南家",
      avatarFileId: "cloud://avatar/south-new",
      seat: "south",
      score: 27000
    });
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

describe("room event detail validation", () => {
  it("stores valid hand record detail on win events", () => {
    const room = createInitialRoom({
      roomCode: "123456",
      mode: "4p",
      creatorOpenid: "openid_1",
      creatorNickName: "东家",
      now: 1
    });

    const next = applyRoomEvent(
      room,
      {
        type: "win",
        actorOpenid: "openid_1",
        deltas: {},
        detail: {
          tiles: ["1m", "2m", "3m"],
          melds: [{ type: "pon", tiles: ["5p", "5p", "5p"] }],
          winningTile: "3m",
          yaku: [{ name: "立直", han: 1 }],
          han: 1,
          fu: 30,
          yakuman: 0,
          scoreText: "1番30符"
        }
      },
      2
    );

    expect(next.events[0].detail).toEqual({
      tiles: ["1m", "2m", "3m"],
      melds: [{ type: "pon", tiles: ["5p", "5p", "5p"] }],
      winningTile: "3m",
      yaku: [{ name: "立直", han: 1 }],
      han: 1,
      fu: 30,
      yakuman: 0,
      scoreText: "1番30符"
    });
  });

  it("rejects oversized hand record detail", () => {
    expect(() =>
      normalizeRoomEventDetail({
        tiles: Array.from({ length: 21 }, () => "1m")
      })
    ).toThrow("手牌最多 20 项");

    expect(() =>
      normalizeRoomEventDetail({
        yaku: Array.from({ length: 21 }, (_, index) => ({ name: `役${index}` }))
      })
    ).toThrow("役种最多 20 项");

    expect(() =>
      normalizeRoomEventDetail({
        scoreText: "点".repeat(4097)
      })
    ).toThrow("牌谱数据不能超过 4096 字符");
  });

  it("prunes unsupported detail fields", () => {
    expect(
      normalizeRoomEventDetail({
        tiles: ["1m"],
        winningTile: "1m",
        rawImageFileId: "cloud://private",
        yaku: [{ name: "门前清自摸和", han: 1, debug: true }]
      })
    ).toEqual({
      tiles: ["1m"],
      winningTile: "1m",
      yaku: [{ name: "门前清自摸和", han: 1 }]
    });
  });
});

describe("my room summaries", () => {
  it("calculates my rank by score, breaking ties by starting seat", () => {
    const room: RoomDocument = {
      _id: "room_doc_id",
      roomCode: "123456",
      mode: "4p",
      status: "finished",
      round: {
        prevalentWind: "east",
        hand: 1,
        honba: 0,
        riichiSticks: 0,
        dealerSeat: "east"
      },
      players: [
        { openid: "east", nickName: "东家", seat: "east", score: 30000 },
        { openid: "south", nickName: "南家", seat: "south", score: 30000 },
        { openid: "west", nickName: "西家", seat: "west", score: 34000 },
        { openid: "north", nickName: "北家", seat: "north", score: 26000 }
      ],
      events: [
        {
          id: "evt_1",
          type: "finish",
          actorOpenid: "east",
          actorNickName: "东家",
          deltas: {},
          riichiStickDelta: 0,
          honbaDelta: 0,
          advanceRound: false,
          note: "",
          createdAt: 1,
          roundBefore: {
            prevalentWind: "east",
            hand: 1,
            honba: 0,
            riichiSticks: 0,
            dealerSeat: "east"
          },
          playersBefore: [],
          statusBefore: "playing",
          statusAfter: "finished"
        }
      ],
      createdAt: 1,
      updatedAt: new Date(2026, 6, 3, 20).getTime()
    };

    const summary = toMyRoomSummary(room, "south", new Date(2026, 6, 4, 9).getTime());

    expect(summary).toMatchObject({
      roomId: "room_doc_id",
      roomCode: "123456",
      myRank: 3,
      eventCount: 1,
      dateLabel: "昨天"
    });
    expect(summary.players).toEqual([
      { nickName: "东家", seat: "east", score: 30000, isMe: false },
      { nickName: "南家", seat: "south", score: 30000, isMe: true },
      { nickName: "西家", seat: "west", score: 34000, isMe: false },
      { nickName: "北家", seat: "north", score: 26000, isMe: false }
    ]);
  });

  it("formats history date labels", () => {
    const now = new Date(2026, 6, 4, 9).getTime();

    expect(formatRoomHistoryDateLabel(new Date(2026, 6, 4, 0).getTime(), now)).toBe("今天");
    expect(formatRoomHistoryDateLabel(new Date(2026, 6, 3, 23).getTime(), now)).toBe("昨天");
    expect(formatRoomHistoryDateLabel(new Date(2026, 6, 2, 23).getTime(), now)).toBe("7月2日");
  });
});
