import cloud = require("wx-server-sdk");
import { RoomDocument, toMyRoomSummaries } from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const db = cloud.database();
  const command = db.command;
  const { OPENID } = cloud.getWXContext();

  const snapshot = await db
    .collection("rooms")
    .where({
      players: command.elemMatch({ openid: OPENID })
    })
    .orderBy("updatedAt", "desc")
    .limit(30)
    .get();

  return {
    rooms: toMyRoomSummaries(snapshot.data as RoomDocument[], OPENID)
  };
};
