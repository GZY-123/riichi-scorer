import cloud = require("wx-server-sdk");
import { joinPlayer, RoomDocument } from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

interface JoinRoomRequest {
  roomCode?: string;
  nickName?: string;
}

exports.main = async (event: JoinRoomRequest) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const roomCode = event.roomCode ?? "";
  if (!/^\d{6}$/.test(roomCode)) {
    throw new Error("房间码必须是 6 位数字");
  }

  return db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.collection("rooms").doc(roomCode).get();
    const room = snapshot.data as RoomDocument | undefined;
    if (!room) {
      throw new Error("房间不存在");
    }

    const result = joinPlayer(room, OPENID, event.nickName ?? "", Date.now());
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
