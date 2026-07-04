export type LastRoomMode = "3p" | "4p";

export interface LastRoomRecord {
  roomId: string;
  roomCode: string;
  mode: LastRoomMode;
  timestamp: number;
}

export interface LastRoomStorage {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}

export const LAST_ROOM_STORAGE_KEY = "lastRoom";
export const LAST_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function createLastRoomRecord(
  input: Omit<LastRoomRecord, "timestamp">,
  timestamp = Date.now()
): LastRoomRecord {
  return {
    roomId: input.roomId.trim(),
    roomCode: input.roomCode.trim(),
    mode: input.mode,
    timestamp
  };
}

export function isLastRoomExpired(
  record: LastRoomRecord,
  now = Date.now(),
  ttlMs = LAST_ROOM_TTL_MS
): boolean {
  return now - record.timestamp >= ttlMs;
}

export function readLastRoom(storage: LastRoomStorage = getWxStorage(), now = Date.now()): LastRoomRecord | null {
  const stored = storage.getStorageSync(LAST_ROOM_STORAGE_KEY);
  if (!isLastRoomRecord(stored)) {
    return null;
  }

  const record = normalizeLastRoom(stored);
  if (isLastRoomExpired(record, now)) {
    clearLastRoom(storage);
    return null;
  }

  return record;
}

export function writeLastRoom(
  input: Omit<LastRoomRecord, "timestamp">,
  storage: LastRoomStorage = getWxStorage(),
  timestamp = Date.now()
): LastRoomRecord {
  const record = createLastRoomRecord(input, timestamp);
  storage.setStorageSync(LAST_ROOM_STORAGE_KEY, record);
  return record;
}

export function clearLastRoom(storage: LastRoomStorage = getWxStorage()): void {
  storage.removeStorageSync(LAST_ROOM_STORAGE_KEY);
}

function getWxStorage(): LastRoomStorage {
  return wx;
}

function normalizeLastRoom(record: LastRoomRecord): LastRoomRecord {
  return {
    roomId: record.roomId.trim(),
    roomCode: record.roomCode.trim(),
    mode: record.mode,
    timestamp: record.timestamp
  };
}

function isLastRoomRecord(value: unknown): value is LastRoomRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<LastRoomRecord>;
  return (
    typeof candidate.roomId === "string" &&
    Boolean(candidate.roomId.trim()) &&
    typeof candidate.roomCode === "string" &&
    Boolean(candidate.roomCode.trim()) &&
    (candidate.mode === "3p" || candidate.mode === "4p") &&
    typeof candidate.timestamp === "number" &&
    Number.isFinite(candidate.timestamp)
  );
}
