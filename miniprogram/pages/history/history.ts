type GameMode = "3p" | "4p";
type RoomStatus = "waiting" | "playing" | "finished";
type Seat = "east" | "south" | "west" | "north";

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string | undefined>;
  };
}

interface RoomSummaryPlayer {
  nickName: string;
  avatarFileId?: string;
  seat: Seat;
  score: number;
  isMe?: boolean;
}

interface MyRoomSummary {
  roomId: string;
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  updatedAt: number;
  dateLabel?: string;
  players: RoomSummaryPlayer[];
  myRank: number;
  eventCount: number;
}

interface ListMyRoomsResult {
  rooms?: MyRoomSummary[];
}

interface ViewRoomSummary extends MyRoomSummary {
  dateText: string;
  modeText: string;
  rankText: string;
  rankClass: string;
  isActive: boolean;
  eventCountText: string;
  players: Array<RoomSummaryPlayer & { seatText: string }>;
}

const SEAT_TEXT: Record<Seat, string> = {
  east: "东",
  south: "南",
  west: "西",
  north: "北"
};

Page({
  data: {
    rooms: [] as ViewRoomSummary[],
    loading: false,
    loaded: false
  },

  onLoad() {
    this.fetchRooms();
  },

  onShow() {
    if (this.data.loaded) {
      this.fetchRooms();
    }
  },

  async onPullDownRefresh() {
    try {
      await this.fetchRooms();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async fetchRooms() {
    this.setData({ loading: true });
    try {
      const response = (await wx.cloud.callFunction({
        name: "listMyRooms"
      })) as { result?: ListMyRoomsResult | MyRoomSummary[] };
      const result = response.result;
      const rooms = Array.isArray(result) ? result : result?.rooms ?? [];
      this.setData({
        rooms: rooms.map((room) => this.toViewRoom(room)),
        loaded: true
      });
    } catch (error) {
      this.setData({ loaded: true });
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  toViewRoom(room: MyRoomSummary): ViewRoomSummary {
    return {
      ...room,
      dateText: room.dateLabel ?? this.formatDateLabel(room.updatedAt),
      modeText: room.mode === "3p" ? "三麻" : "四麻",
      rankText: `${room.myRank}位`,
      rankClass: this.rankClass(room.myRank),
      isActive: room.status !== "finished",
      eventCountText: `${room.eventCount} 笔`,
      players: room.players.map((player) => ({
        ...player,
        seatText: SEAT_TEXT[player.seat]
      }))
    };
  },

  onRoomTap(event: TapEvent) {
    const roomId = event.currentTarget.dataset.roomId;
    const status = event.currentTarget.dataset.status;
    if (!roomId) {
      return;
    }

    wx.navigateTo({
      url:
        status === "finished"
          ? `/pages/history-detail/history-detail?roomId=${roomId}`
          : `/pages/room/room?roomId=${roomId}`
    });
  },

  onHomeTap() {
    wx.reLaunch({
      url: "/pages/index/index"
    });
  },

  rankClass(rank: number): string {
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    if (rank === 3) return "rank-3";
    return "rank-other";
  },

  formatDateLabel(timestamp: number): string {
    const date = new Date(timestamp);
    const today = this.startOfDay(new Date()).getTime();
    const target = this.startOfDay(date).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (target === today) {
      return "今天";
    }
    if (target === today - oneDay) {
      return "昨天";
    }
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  },

  showError(error: unknown) {
    const message = error instanceof Error ? error.message : "读取对局记录失败";
    wx.showToast({ title: message, icon: "none" });
  }
});

export {};
