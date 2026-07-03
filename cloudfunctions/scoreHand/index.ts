import cloud = require("wx-server-sdk");
import type { RoomDocument } from "../common/roomLogic";
import { EngineApi, ScoreHandRequest, buildScoreHandPreview } from "../common/scoreLogic";

declare const require: (id: string) => unknown;

interface ScoreHandCloudRequest extends ScoreHandRequest {
  roomId?: string;
  roomCode?: string;
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const engine = require("./engine-lib/index.js") as EngineApi;

exports.main = async (event: ScoreHandCloudRequest) => {
  const roomId = event.roomId ?? event.roomCode ?? "";
  if (!/^\d{6}$/.test(roomId)) {
    throw new Error("房间参数错误");
  }

  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const snapshot = await db.collection("rooms").doc(roomId).get();
  const room = snapshot.data as RoomDocument | undefined;
  if (!room) {
    throw new Error("房间不存在");
  }

  return buildScoreHandPreview(
    {
      ...event,
      winnerOpenid: event.winnerOpenid ?? OPENID
    },
    room,
    engine
  );
};
