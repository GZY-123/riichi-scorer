import cloud = require("wx-server-sdk");
import {
  createInitialRoom,
  GameMode,
  makeRoomCode,
  resolveUserProfile,
  RoomDocument,
  UserProfileInput
} from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_CODE_ATTEMPTS = 30;

interface CreateRoomRequest {
  mode?: GameMode;
  rules?: unknown;
  nickName?: string;
  avatarFileId?: string;
}

exports.main = async (event: CreateRoomRequest) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const mode = event.mode === "3p" ? "3p" : "4p";
  const profile = resolveUserProfile(await getStoredProfile(db, OPENID), {
    nickName: event.nickName,
    avatarFileId: event.avatarFileId
  });

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
      creatorNickName: profile.nickName,
      creatorAvatarFileId: profile.avatarFileId,
      rules: event.rules,
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
    mode: room.mode,
    playerOpenid,
    status: room.status
  };
}

function isDuplicateRoomError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|already exists|_id|E11000|-502001/i.test(message);
}

async function getStoredProfile(db: any, openid: string): Promise<UserProfileInput | undefined> {
  try {
    const snapshot = await db.collection("users").doc(openid).get();
    return snapshot.data as UserProfileInput | undefined;
  } catch (error) {
    if (isMissingProfileRead(error)) {
      return undefined;
    }
    throw error;
  }
}

function isMissingProfileRead(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /collection.*not.*exist|document.*not.*exist|not found|不存在|-502005|-502002/i.test(message);
}
