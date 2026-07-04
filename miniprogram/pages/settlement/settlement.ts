import { avatarFallbackText } from "../../utils/profile";
import { clearLastRoom } from "../../utils/lastRoom";

type GameMode = "3p" | "4p";
type Seat = "east" | "south" | "west" | "north";
type RoomStatus = "waiting" | "playing" | "finished";

interface PlayerState {
  openid: string;
  nickName: string;
  avatarFileId?: string;
  seat: Seat;
  score: number;
}

interface RoomDocument {
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  players: PlayerState[];
}

interface Ranking {
  openid: string;
  rank: number;
  nickName: string;
  avatarFileId?: string;
  avatarText: string;
  seatText: string;
  rawScore: number;
  finalScore: number;
  finalScoreText: string;
  scoreClass: "score-positive" | "score-negative" | "score-neutral";
  rankClass: "rank-1" | "rank-2" | "rank-3" | "";
}

const SEAT_TEXT: Record<Seat, string> = {
  east: "东",
  south: "南",
  west: "西",
  north: "北"
};

const STATUS_TEXT: Record<RoomStatus, string> = {
  waiting: "等待中",
  playing: "对局中",
  finished: "已结算"
};

Page({
  data: {
    roomId: "",
    roomCode: "",
    statusText: "等待中",
    rankings: [] as Ranking[]
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

      const baseScore = response.data.mode === "3p" ? 35000 : 25000;
      const rankings = [...response.data.players]
        .sort((left, right) => right.score - left.score)
        .map((player, index) => {
          const finalScore = player.score - baseScore;
          return {
            openid: player.openid,
            rank: index + 1,
            nickName: player.nickName,
            avatarFileId: player.avatarFileId,
            avatarText: avatarFallbackText(player.nickName),
            seatText: SEAT_TEXT[player.seat],
            rawScore: player.score,
            finalScore,
            finalScoreText: `${finalScore > 0 ? "+" : ""}${finalScore}`,
            scoreClass: this.scoreClass(finalScore),
            rankClass: this.rankClass(index + 1)
          };
        });

      this.setData({
        roomCode: response.data.roomCode,
        statusText: STATUS_TEXT[response.data.status],
        rankings
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取结算失败";
      wx.showToast({ title: message, icon: "none" });
    }
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
  },

  scoreClass(score: number): "score-positive" | "score-negative" | "score-neutral" {
    if (score > 0) return "score-positive";
    if (score < 0) return "score-negative";
    return "score-neutral";
  },

  rankClass(rank: number): "rank-1" | "rank-2" | "rank-3" | "" {
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    if (rank === 3) return "rank-3";
    return "";
  }
});

export {};
