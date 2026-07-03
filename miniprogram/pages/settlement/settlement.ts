import { avatarFallbackText } from "../../utils/profile";

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

      const rankings = [...response.data.players]
        .sort((left, right) => right.score - left.score)
        .map((player, index) => ({
          openid: player.openid,
          rank: index + 1,
          nickName: player.nickName,
          avatarFileId: player.avatarFileId,
          avatarText: avatarFallbackText(player.nickName),
          seatText: SEAT_TEXT[player.seat],
          rawScore: player.score,
          finalScore: player.score
        }));

      this.setData({
        roomCode: response.data.roomCode,
        statusText: STATUS_TEXT[response.data.status],
        rankings
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取结算失败";
      wx.showToast({ title: message, icon: "none" });
    }
  }
});

export {};
