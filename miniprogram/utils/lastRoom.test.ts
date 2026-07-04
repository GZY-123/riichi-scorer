import { describe, expect, it } from "vitest";
import {
  LAST_ROOM_STORAGE_KEY,
  LAST_ROOM_TTL_MS,
  LastRoomStorage,
  clearLastRoom,
  createLastRoomRecord,
  isLastRoomExpired,
  readLastRoom,
  writeLastRoom
} from "./lastRoom";

function fakeStorage(initial?: Record<string, unknown>): LastRoomStorage & { values: Record<string, unknown> } {
  const values = { ...(initial ?? {}) };
  return {
    values,
    getStorageSync(key: string) {
      return values[key];
    },
    setStorageSync(key: string, value: unknown) {
      values[key] = value;
    },
    removeStorageSync(key: string) {
      delete values[key];
    }
  };
}

describe("lastRoom storage", () => {
  it("writes and reads the normalized latest room", () => {
    const storage = fakeStorage();

    const written = writeLastRoom(
      {
        roomId: " 123456 ",
        roomCode: " 123456 ",
        mode: "4p"
      },
      storage,
      1000
    );

    expect(written).toEqual({
      roomId: "123456",
      roomCode: "123456",
      mode: "4p",
      timestamp: 1000
    });
    expect(readLastRoom(storage, 2000)).toEqual(written);
  });

  it("treats records younger than 24 hours as active", () => {
    const record = createLastRoomRecord(
      {
        roomId: "654321",
        roomCode: "654321",
        mode: "3p"
      },
      10_000
    );

    expect(isLastRoomExpired(record, 10_000 + LAST_ROOM_TTL_MS - 1)).toBe(false);
  });

  it("expires and removes records at 24 hours", () => {
    const record = createLastRoomRecord(
      {
        roomId: "654321",
        roomCode: "654321",
        mode: "3p"
      },
      10_000
    );
    const storage = fakeStorage({ [LAST_ROOM_STORAGE_KEY]: record });

    expect(readLastRoom(storage, 10_000 + LAST_ROOM_TTL_MS)).toBeNull();
    expect(storage.values[LAST_ROOM_STORAGE_KEY]).toBeUndefined();
  });

  it("ignores invalid cached data without clearing unrelated storage", () => {
    const storage = fakeStorage({ [LAST_ROOM_STORAGE_KEY]: { roomId: "", roomCode: "1", mode: "4p" } });

    expect(readLastRoom(storage, 10_000)).toBeNull();
    expect(storage.values[LAST_ROOM_STORAGE_KEY]).toEqual({ roomId: "", roomCode: "1", mode: "4p" });
  });

  it("clears the cached room", () => {
    const storage = fakeStorage({
      [LAST_ROOM_STORAGE_KEY]: createLastRoomRecord({ roomId: "1", roomCode: "1", mode: "4p" })
    });

    clearLastRoom(storage);

    expect(storage.values[LAST_ROOM_STORAGE_KEY]).toBeUndefined();
  });
});
