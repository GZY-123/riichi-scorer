import cloud = require("wx-server-sdk");
import { joinPlayer, resolveUserProfile, RoomDocument, UserProfileInput } from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface JoinRoomRequest {
  roomCode?: string;
  nickName?: string;
  avatarFileId?: string;
}

exports.main = async (event: JoinRoomRequest) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const roomCode = event.roomCode ?? "";
  if (!/^\d{6}$/.test(roomCode)) {
    throw new Error("房间码必须是 6 位数字");
  }
  const profile = resolveUserProfile(await getStoredProfile(db, OPENID), {
    nickName: event.nickName,
    avatarFileId: event.avatarFileId
  });

  return db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.collection("rooms").doc(roomCode).get();
    const room = snapshot.data as RoomDocument | undefined;
    if (!room) {
      throw new Error("房间不存在");
    }

    const result = joinPlayer(room, OPENID, profile.nickName, Date.now(), profile.avatarFileId);
    await transaction.collection("rooms").doc(roomCode).update({
      data: {
        players: result.room.players,
        status: result.room.status,
        updatedAt: result.room.updatedAt
      }
    });

    return {
      roomId: roomCode,
      roomCode,
      playerOpenid: OPENID,
      status: result.room.status,
      restored: result.restored
    };
  });
};

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
