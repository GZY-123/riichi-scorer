import { clearLastRoom } from "../../utils/lastRoom";
import {
  GameMode,
  PlayerState,
  resolveRules,
  RoomRules,
  rulesSummary,
  SettlementEngineApi,
  SettlementRow,
  settleView
} from "./settlementLogic";

declare const require: (id: string) => unknown;

type RoomStatus = "waiting" | "playing" | "finished";

interface RoomDocument {
  roomCode: string;
  mode: GameMode;
  rules?: RoomRules;
  status: RoomStatus;
  players: PlayerState[];
  round?: {
    riichiSticks?: number;
  };
}

const STATUS_TEXT: Record<RoomStatus, string> = {
  waiting: "等待中",
  playing: "对局中",
  finished: "已结算"
};

const engine = require("../../utils/engine-lib/index.js") as SettlementEngineApi;

Page({
  data: {
    roomId: "",
    roomCode: "",
    statusText: "等待中",
    rulesText: "半庄 · 马10-20",
    isEstimate: false,
    rankings: [] as SettlementRow[]
  },

  onLoad(query: Record<string, string | undefined>) {
    const roomId = query.roomId;
    if (!roomId) {
      wx.showToast({ title: "缺少房间参数", icon: "none" });
      wx.navigateBack();
      return;
    }

    this.setData({ roomId });
    this.fetchRoom();
  },

  async fetchRoom() {
    try {
      const response = (await wx.cloud
        .database()
        .collection("rooms")
        .doc(this.data.roomId)
        .get()) as unknown as { data?: RoomDocument };

      if (!response.data) {
        wx.showToast({ title: "房间不存在", icon: "none" });
        return;
      }

      const rules = resolveRules(response.data);
      // 头信息先渲染，精算失败也不影响页面骨架
      this.setData({
        roomCode: response.data.roomCode,
        statusText: STATUS_TEXT[response.data.status],
        rulesText: rulesSummary(response.data.mode, rules),
        isEstimate: response.data.status !== "finished"
      });

      const expected = response.data.mode === "3p" ? 3 : 4;
      if (response.data.players.length !== expected) {
        // 人未满（等待中）：引擎精算要求满员，回退为素点排序
        this.setData({ rankings: this.rawRankings(response.data.players) });
        return;
      }

      const rankings = settleView({
        players: response.data.players,
        mode: response.data.mode,
        rules,
        riichiSticks: response.data.round?.riichiSticks ?? 0,
        engine
      });
      this.setData({ rankings });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取结算失败";
      wx.showToast({ title: message, icon: "none" });
    }
  },

  rawRankings(players: PlayerState[]): SettlementRow[] {
    const seatOrder: Record<string, number> = { east: 0, south: 1, west: 2, north: 3 };
    const seatText: Record<string, string> = { east: "东", south: "南", west: "西", north: "北" };
    return [...players]
      .sort((a, b) => b.score - a.score || (seatOrder[a.seat] ?? 9) - (seatOrder[b.seat] ?? 9))
      .map((player, index) => ({
        openid: player.openid,
        rank: index + 1,
        nickName: player.nickName,
        ...(player.avatarFileId ? { avatarFileId: player.avatarFileId } : {}),
        avatarText: player.nickName.slice(0, 1),
        seatText: seatText[player.seat] ?? "",
        rawScore: player.score,
        adjustedScore: player.score,
        finalScore: 0,
        finalScoreText: "—",
        scoreClass: "score-neutral" as const,
        rankClass: index === 0 ? ("rank-1" as const) : index === 1 ? ("rank-2" as const) : index === 2 ? ("rank-3" as const) : ("" as const)
      }));
  },

  onReturnHomeTap() {
    clearLastRoom();
    wx.reLaunch({
      url: "/pages/index/index"
    });
  },

  onHistoryDetailTap() {
    wx.navigateTo({
      url: `/pages/history-detail/history-detail?roomId=${this.data.roomId}`
    });
  }
});

export {};
