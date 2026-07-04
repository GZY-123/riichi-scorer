import { avatarFallbackText } from "../../utils/profile";

type GameMode = "3p" | "4p";
type Seat = "east" | "south" | "west" | "north";
type RoomStatus = "waiting" | "playing" | "finished";
type RoomEventType = "win" | "draw" | "riichi" | "finish" | "undo";

interface PlayerState {
  openid: string;
  nickName: string;
  avatarFileId?: string;
  seat: Seat;
  score: number;
}

interface RoundState {
  prevalentWind: Seat;
  hand: number;
  honba: number;
  riichiSticks: number;
  dealerSeat: Seat;
}

interface RoomEventDetail {
  tiles?: string[];
  melds?: Array<{ type: string; tiles: string[] }>;
  winningTile?: string;
  yaku?: Array<{ name: string; han?: number; yakuman?: number }>;
  han?: number;
  fu?: number;
  yakuman?: number;
  scoreText?: string;
}

interface RoomEventLog {
  id: string;
  type: RoomEventType;
  actorOpenid: string;
  actorNickName: string;
  deltas: Record<string, number>;
  note: string;
  createdAt: number;
  roundBefore: RoundState;
  playersBefore: PlayerState[];
  detail?: RoomEventDetail;
}

interface RoomDocument {
  _id?: string;
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  players: PlayerState[];
  events: RoomEventLog[];
  updatedAt: number;
}

interface ViewPlayer extends PlayerState {
  seatText: string;
  avatarText: string;
}

interface TileView {
  key: string;
  code: string;
  isWinning: boolean;
}

interface MeldView {
  id: string;
  typeText: string;
  tiles: TileView[];
}

interface YakuView {
  id: string;
  name: string;
  valueText: string;
}

interface HandRecordView {
  tiles: TileView[];
  melds: MeldView[];
  yakuRows: YakuView[];
  scoreText: string;
}

interface ViewEvent extends RoomEventLog {
  roundText: string;
  typeText: string;
  createdText: string;
  deltaText: string;
  noteText: string;
  detailView?: HandRecordView;
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

const EVENT_TEXT: Record<RoomEventType, string> = {
  win: "和牌",
  draw: "流局",
  riichi: "立直",
  finish: "终局",
  undo: "撤销"
};

const MELD_TEXT: Record<string, string> = {
  chi: "吃",
  pon: "碰",
  "kan-open": "明杠",
  "kan-closed": "暗杠",
  "kan-added": "加杠",
  north: "拔北"
};

Page({
  data: {
    roomId: "",
    roomCode: "",
    modeText: "",
    statusText: "",
    dateText: "",
    players: [] as ViewPlayer[],
    events: [] as ViewEvent[],
    loaded: false
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

      this.applyRoom(response.data);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loaded: true });
    }
  },

  applyRoom(room: RoomDocument) {
    const players = room.players.map((player) => ({
      ...player,
      seatText: SEAT_TEXT[player.seat],
      avatarText: avatarFallbackText(player.nickName)
    }));
    this.setData({
      roomCode: room.roomCode,
      modeText: room.mode === "3p" ? "三麻" : "四麻",
      statusText: STATUS_TEXT[room.status],
      dateText: this.formatDateTime(room.updatedAt),
      players,
      events: room.events.map((event) => this.toViewEvent(event, room.players))
    });
  },

  toViewEvent(event: RoomEventLog, roomPlayers: PlayerState[]): ViewEvent {
    const playersAtEvent = event.playersBefore?.length ? event.playersBefore : roomPlayers;
    const playerByOpenid = new Map(playersAtEvent.map((player) => [player.openid, player]));
    const deltaText = Object.entries(event.deltas ?? {})
      .filter(([, delta]) => delta !== 0)
      .map(([openid, delta]) => {
        const player = playerByOpenid.get(openid);
        return `${player?.nickName ?? "玩家"} ${delta > 0 ? "+" : ""}${delta}`;
      })
      .join(" / ");

    return {
      ...event,
      roundText: this.formatRound(event.roundBefore),
      typeText: EVENT_TEXT[event.type],
      createdText: this.formatTime(event.createdAt),
      deltaText: deltaText || "无点数变化",
      noteText: event.note?.trim() ?? "",
      detailView: event.type === "win" ? this.toHandRecordView(event.detail) : undefined
    };
  },

  toHandRecordView(detail: RoomEventDetail | undefined): HandRecordView | undefined {
    if (!detail) {
      return undefined;
    }

    const tiles = detail.tiles ?? [];
    const winningIndex = this.findWinningTileIndex(tiles, detail.winningTile);
    const tileViews = tiles.map((tile, index) => ({
      key: `${index}_${tile}`,
      code: tile,
      isWinning: index === winningIndex
    }));
    const melds = (detail.melds ?? []).map((meld, meldIndex) => ({
      id: `${meldIndex}_${meld.type}`,
      typeText: MELD_TEXT[meld.type] ?? meld.type,
      tiles: meld.tiles.map((tile, tileIndex) => ({
        key: `${meldIndex}_${tileIndex}_${tile}`,
        code: tile,
        isWinning: false
      }))
    }));
    const yakuRows = (detail.yaku ?? []).map((item, index) => ({
      id: `${index}_${item.name}`,
      name: item.name,
      valueText: item.yakuman ? `${item.yakuman}倍役满` : item.han ? `${item.han}番` : "-"
    }));
    const scoreText = this.formatScoreText(detail);

    if (tileViews.length === 0 && melds.length === 0 && yakuRows.length === 0 && !scoreText) {
      return undefined;
    }

    return {
      tiles: tileViews,
      melds,
      yakuRows,
      scoreText
    };
  },

  findWinningTileIndex(tiles: string[], winningTile: string | undefined): number {
    if (!winningTile) {
      return -1;
    }
    for (let index = tiles.length - 1; index >= 0; index -= 1) {
      if (tiles[index] === winningTile) {
        return index;
      }
    }
    return -1;
  },

  formatScoreText(detail: RoomEventDetail): string {
    if (detail.scoreText) {
      return detail.scoreText;
    }
    if (detail.yakuman && detail.yakuman > 0) {
      return `${detail.yakuman}倍役满`;
    }
    if (detail.han !== undefined && detail.fu !== undefined) {
      return `${detail.han}番 ${detail.fu}符`;
    }
    if (detail.han !== undefined) {
      return `${detail.han}番`;
    }
    return "";
  },

  formatRound(round: RoundState): string {
    return `${SEAT_TEXT[round.prevalentWind]}${round.hand}局${round.honba > 0 ? ` ${round.honba}本场` : ""}`;
  },

  formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${this.formatTime(timestamp)}`;
  },

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${hour}:${minute}`;
  },

  showError(error: unknown) {
    const message = error instanceof Error ? error.message : "读取牌谱失败";
    wx.showToast({ title: message, icon: "none" });
  }
});

export {};
