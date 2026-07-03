import cloud = require("wx-server-sdk");
import {
  createInitialRoom,
  GameMode,
  makeRoomCode,
  RoomDocument
} from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_CODE_ATTEMPTS = 30;

interface CreateRoomRequest {
  mode?: GameMode;
  nickName?: string;
}

exports.main = async (event: CreateRoomRequest) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const mode = event.mode === "3p" ? "3p" : "4p";
  const nickName = event.nickName ?? "";

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const roomCode = makeRoomCode();
    const existing = await db.collection("rooms").where({ roomCode }).count();
    if (existing.total > 0) {
      continue;
    }

    const now = Date.now();
    const room = createInitialRoom({
      roomCode,
      mode,
      creatorOpenid: OPENID,
      creatorNickName: nickName,
      now
    });

    try {
      await db.collection("rooms").add({
        data: room
      });

      return toCreateRoomResponse(room, OPENID);
    } catch (error) {
      if (isDuplicateRoomError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("房间码生成失败，请稍后重试");
};

function toCreateRoomResponse(room: RoomDocument, playerOpenid: string) {
  return {
    roomId: room.roomCode,
    roomCode: room.roomCode,
    playerOpenid,
    status: room.status
  };
}

function isDuplicateRoomError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|already exists|_id|E11000|-502001/i.test(message);
}
