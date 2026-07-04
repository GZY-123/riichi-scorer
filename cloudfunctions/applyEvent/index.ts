import cloud = require("wx-server-sdk");
import {
  applyRoomEvent,
  EventInput,
  RoomDocument,
  RoomEventDetail,
  RoomEventType,
  undoLastEvent
} from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface ApplyEventRequest {
  roomId?: string;
  roomCode?: string;
  undo?: boolean;
  type?: RoomEventType;
  deltas?: Record<string, number>;
  riichiStickDelta?: number;
  honbaDelta?: number;
  advanceRound?: boolean;
  note?: string;
  detail?: RoomEventDetail;
}

exports.main = async (event: ApplyEventRequest) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const roomId = event.roomId ?? event.roomCode ?? "";
  if (!/^\d{6}$/.test(roomId)) {
    throw new Error("房间参数错误");
  }

  return db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.collection("rooms").doc(roomId).get();
    const room = snapshot.data as RoomDocument | undefined;
    if (!room) {
      throw new Error("房间不存在");
    }

    const now = Date.now();
    const nextRoom = event.undo
      ? undoLastEvent(room, OPENID, now)
      : applyRoomEvent(room, normalizeEventInput(event, OPENID), now);

    const latestEvent = nextRoom.events[nextRoom.events.length - 1];
    await transaction.collection("rooms").doc(roomId).update({
      data: {
        status: nextRoom.status,
        players: nextRoom.players,
        round: nextRoom.round,
        events: nextRoom.events,
        updatedAt: nextRoom.updatedAt
      }
    });

    return {
      roomId,
      roomCode: nextRoom.roomCode,
      status: nextRoom.status,
      event: latestEvent
    };
  });
};

function normalizeEventInput(event: ApplyEventRequest, actorOpenid: string): EventInput {
  const type = event.type ?? "win";
  if (type === "undo") {
    throw new Error("撤销事件请使用 undo=true");
  }

  if (type === "riichi") {
    return {
      type,
      actorOpenid,
      deltas: event.deltas ?? { [actorOpenid]: -1000 },
      riichiStickDelta: event.riichiStickDelta ?? 1,
      honbaDelta: event.honbaDelta ?? 0,
      advanceRound: false,
      note: event.note,
      detail: event.detail
    };
  }

  return {
    type,
    actorOpenid,
    deltas: event.deltas ?? {},
    riichiStickDelta: event.riichiStickDelta ?? 0,
    honbaDelta: event.honbaDelta ?? 0,
    advanceRound: event.advanceRound === true,
    note: event.note,
    detail: event.detail
  };
}
