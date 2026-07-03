export type GameMode = "3p" | "4p";
export type RoomStatus = "waiting" | "playing" | "finished";
export type Seat = "east" | "south" | "west" | "north";
export type PrevalentWind = "east" | "south" | "west" | "north";
export type RoomEventType = "win" | "draw" | "riichi" | "finish" | "undo";

export interface PlayerState {
  openid: string;
  nickName: string;
  seat: Seat;
  score: number;
}

export interface RoundState {
  prevalentWind: PrevalentWind;
  hand: number;
  honba: number;
  riichiSticks: number;
  dealerSeat: Seat;
}

export interface RoomEvent {
  id: string;
  type: RoomEventType;
  actorOpenid: string;
  actorNickName: string;
  deltas: Record<string, number>;
  riichiStickDelta: number;
  honbaDelta: number;
  advanceRound: boolean;
  note: string;
  createdAt: number;
  roundBefore: RoundState;
  playersBefore: PlayerState[];
  statusBefore: RoomStatus;
  statusAfter: RoomStatus;
  undoneEventId?: string;
}

export interface RoomDocument {
  _id?: string;
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  players: PlayerState[];
  round: RoundState;
  events: RoomEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface EventInput {
  id?: string;
  type: Exclude<RoomEventType, "undo">;
  actorOpenid: string;
  deltas?: Record<string, number>;
  riichiStickDelta?: number;
  honbaDelta?: number;
  advanceRound?: boolean;
  note?: string;
}

export interface JoinResult {
  room: RoomDocument;
  restored: boolean;
}

export const SEATS_BY_MODE: Record<GameMode, readonly Seat[]> = {
  "3p": ["east", "south", "west"],
  "4p": ["east", "south", "west", "north"]
};

const INITIAL_SCORE_BY_MODE: Record<GameMode, number> = {
  "3p": 35000,
  "4p": 25000
};

const WIND_ORDER: readonly PrevalentWind[] = ["east", "south", "west", "north"];

export function initialScore(mode: GameMode): number {
  return INITIAL_SCORE_BY_MODE[mode];
}

export function seatOrder(mode: GameMode): readonly Seat[] {
  return SEATS_BY_MODE[mode];
}

export function maxPlayers(mode: GameMode): number {
  return SEATS_BY_MODE[mode].length;
}

export function makeRoomCode(rng: () => number = Math.random): string {
  const raw = rng();
  const bounded = Math.max(0, Math.min(0.999999999, raw));
  return Math.floor(bounded * 1_000_000)
    .toString()
    .padStart(6, "0");
}

export function generateUniqueRoomCode(
  existingCodes: ReadonlySet<string>,
  rng: () => number = Math.random,
  maxAttempts = 30
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = makeRoomCode(rng);
    if (!existingCodes.has(code)) {
      return code;
    }
  }

  throw new Error("无法生成不重复的房间码，请稍后重试");
}

export function assignSeats(players: readonly PlayerState[], mode: GameMode): PlayerState[] {
  const seats = seatOrder(mode);
  if (players.length > seats.length) {
    throw new Error(`${mode} 房间最多允许 ${seats.length} 名玩家`);
  }

  return players.map((player, index) => ({
    ...player,
    seat: seats[index]
  }));
}

export function createInitialRound(mode: GameMode): RoundState {
  return {
    prevalentWind: "east",
    hand: 1,
    honba: 0,
    riichiSticks: 0,
    dealerSeat: seatOrder(mode)[0]
  };
}

export function createInitialRoom(params: {
  roomCode: string;
  mode: GameMode;
  creatorOpenid: string;
  creatorNickName: string;
  now: number;
}): RoomDocument {
  assertMode(params.mode);
  assertRoomCode(params.roomCode);
  assertOpenid(params.creatorOpenid);

  const players = assignSeats(
    [
      {
        openid: params.creatorOpenid,
        nickName: normalizeNickName(params.creatorNickName),
        seat: "east",
        score: initialScore(params.mode)
      }
    ],
    params.mode
  );

  return {
    _id: params.roomCode,
    roomCode: params.roomCode,
    mode: params.mode,
    status: "waiting",
    players,
    round: createInitialRound(params.mode),
    events: [],
    createdAt: params.now,
    updatedAt: params.now
  };
}

export function joinPlayer(
  room: RoomDocument,
  openid: string,
  nickName: string,
  now: number
): JoinResult {
  assertOpenid(openid);
  if (room.status === "finished") {
    throw new Error("房间已结算，无法加入");
  }

  const existingIndex = room.players.findIndex((player) => player.openid === openid);
  if (existingIndex >= 0) {
    const players = room.players.map((player, index) =>
      index === existingIndex ? { ...player, nickName: normalizeNickName(nickName) } : { ...player }
    );

    return {
      restored: true,
      room: {
        ...room,
        players: assignSeats(players, room.mode),
        updatedAt: now
      }
    };
  }

  if (room.players.length >= maxPlayers(room.mode)) {
    throw new Error("房间人数已满");
  }

  const players = assignSeats(
    [
      ...room.players,
      {
        openid,
        nickName: normalizeNickName(nickName),
        seat: seatOrder(room.mode)[room.players.length],
        score: initialScore(room.mode)
      }
    ],
    room.mode
  );

  return {
    restored: false,
    room: {
      ...room,
      players,
      status: players.length === maxPlayers(room.mode) ? "playing" : "waiting",
      updatedAt: now
    }
  };
}

export function applyRoomEvent(room: RoomDocument, input: EventInput, now: number): RoomDocument {
  if (room.status === "finished" && input.type !== "finish") {
    throw new Error("房间已结算，不能继续记录事件");
  }

  const actor = findPlayer(room, input.actorOpenid);
  const riichiStickDelta = input.riichiStickDelta ?? 0;
  const honbaDelta = input.honbaDelta ?? 0;
  assertInteger(riichiStickDelta, "供托变化");
  assertInteger(honbaDelta, "本场变化");

  const deltas = normalizeDeltas(room.players, input.deltas ?? {});
  validateDeltas(room.players, deltas, riichiStickDelta);

  let nextRound: RoundState = {
    ...room.round,
    riichiSticks: room.round.riichiSticks + riichiStickDelta,
    honba: room.round.honba + honbaDelta
  };

  if (nextRound.riichiSticks < 0) {
    throw new Error("供托不能小于 0");
  }
  if (nextRound.honba < 0) {
    throw new Error("本场数不能小于 0");
  }

  if (input.advanceRound === true) {
    nextRound = advanceRound(nextRound, room.mode);
  }

  const statusAfter: RoomStatus = input.type === "finish" ? "finished" : room.status;
  const event: RoomEvent = {
    id: input.id ?? createEventId(now, room.events.length),
    type: input.type,
    actorOpenid: actor.openid,
    actorNickName: actor.nickName,
    deltas,
    riichiStickDelta,
    honbaDelta,
    advanceRound: input.advanceRound === true,
    note: input.note?.trim() ?? "",
    createdAt: now,
    roundBefore: cloneRound(room.round),
    playersBefore: clonePlayers(room.players),
    statusBefore: room.status,
    statusAfter
  };

  return {
    ...room,
    status: statusAfter,
    players: applyDeltas(room.players, deltas),
    round: nextRound,
    events: [...room.events, event],
    updatedAt: now
  };
}

export function undoLastEvent(room: RoomDocument, actorOpenid: string, now: number): RoomDocument {
  const actor = findPlayer(room, actorOpenid);
  const undoneIds = new Set(
    room.events
      .filter((event) => event.type === "undo" && event.undoneEventId)
      .map((event) => event.undoneEventId as string)
  );
  const target = [...room.events]
    .reverse()
    .find((event) => event.type !== "undo" && !undoneIds.has(event.id));

  if (!target) {
    throw new Error("没有可撤销的事件");
  }

  const deltas = diffPlayerScores(room.players, target.playersBefore);
  const riichiStickDelta = target.roundBefore.riichiSticks - room.round.riichiSticks;
  const honbaDelta = target.roundBefore.honba - room.round.honba;
  const statusAfter = target.statusBefore;
  const undoEvent: RoomEvent = {
    id: createEventId(now, room.events.length),
    type: "undo",
    actorOpenid: actor.openid,
    actorNickName: actor.nickName,
    deltas,
    riichiStickDelta,
    honbaDelta,
    advanceRound: false,
    note: `撤销 ${target.type}`,
    createdAt: now,
    roundBefore: cloneRound(room.round),
    playersBefore: clonePlayers(room.players),
    statusBefore: room.status,
    statusAfter,
    undoneEventId: target.id
  };

  return {
    ...room,
    status: statusAfter,
    players: clonePlayers(target.playersBefore),
    round: cloneRound(target.roundBefore),
    events: [...room.events, undoEvent],
    updatedAt: now
  };
}

export function validateDeltas(
  players: readonly PlayerState[],
  deltas: Record<string, number>,
  riichiStickDelta = 0
): void {
  const playerIds = new Set(players.map((player) => player.openid));
  let playerDeltaTotal = 0;

  for (const [openid, delta] of Object.entries(deltas)) {
    if (!playerIds.has(openid)) {
      throw new Error("分差包含不在房间内的玩家");
    }
    assertInteger(delta, "玩家分差");
    playerDeltaTotal += delta;
  }

  assertInteger(riichiStickDelta, "供托变化");
  if (playerDeltaTotal + riichiStickDelta * 1000 !== 0) {
    throw new Error("玩家分差总和必须与供托变化保持守恒");
  }
}

export function advanceRound(round: RoundState, mode: GameMode): RoundState {
  const seats = seatOrder(mode);
  const nextHand = round.hand + 1;
  if (nextHand <= seats.length) {
    return {
      ...round,
      hand: nextHand,
      dealerSeat: seats[nextHand - 1]
    };
  }

  const windIndex = WIND_ORDER.indexOf(round.prevalentWind);
  const nextWind = WIND_ORDER[Math.min(windIndex + 1, WIND_ORDER.length - 1)];
  return {
    ...round,
    prevalentWind: nextWind,
    hand: 1,
    dealerSeat: seats[0]
  };
}

function normalizeNickName(nickName: string): string {
  const normalized = nickName.trim();
  if (!normalized) {
    throw new Error("昵称不能为空");
  }
  if (normalized.length > 16) {
    throw new Error("昵称最多 16 个字符");
  }
  return normalized;
}

function normalizeDeltas(
  players: readonly PlayerState[],
  deltas: Record<string, number>
): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const player of players) {
    normalized[player.openid] = deltas[player.openid] ?? 0;
  }

  for (const openid of Object.keys(deltas)) {
    if (!(openid in normalized)) {
      normalized[openid] = deltas[openid];
    }
  }

  return normalized;
}

function applyDeltas(players: readonly PlayerState[], deltas: Record<string, number>): PlayerState[] {
  return players.map((player) => ({
    ...player,
    score: player.score + (deltas[player.openid] ?? 0)
  }));
}

function diffPlayerScores(
  currentPlayers: readonly PlayerState[],
  previousPlayers: readonly PlayerState[]
): Record<string, number> {
  const previousByOpenid = new Map(previousPlayers.map((player) => [player.openid, player]));
  const deltas: Record<string, number> = {};

  for (const currentPlayer of currentPlayers) {
    const previous = previousByOpenid.get(currentPlayer.openid);
    if (previous) {
      deltas[currentPlayer.openid] = previous.score - currentPlayer.score;
    }
  }

  return deltas;
}

function findPlayer(room: RoomDocument, openid: string): PlayerState {
  assertOpenid(openid);
  const player = room.players.find((item) => item.openid === openid);
  if (!player) {
    throw new Error("发起者不在房间内");
  }
  return player;
}

function clonePlayers(players: readonly PlayerState[]): PlayerState[] {
  return players.map((player) => ({ ...player }));
}

function cloneRound(round: RoundState): RoundState {
  return { ...round };
}

function createEventId(now: number, index: number): string {
  return `evt_${now.toString(36)}_${index.toString(36)}`;
}

function assertMode(mode: GameMode): void {
  if (mode !== "3p" && mode !== "4p") {
    throw new Error("mode 必须是 3p 或 4p");
  }
}

function assertRoomCode(roomCode: string): void {
  if (!/^\d{6}$/.test(roomCode)) {
    throw new Error("房间码必须是 6 位数字");
  }
}

function assertOpenid(openid: string): void {
  if (!openid.trim()) {
    throw new Error("openid 不能为空");
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label}必须是整数`);
  }
}
