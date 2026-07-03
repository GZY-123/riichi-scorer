import { avatarFallbackText } from "../../utils/profile";

type GameMode = "3p" | "4p";
type Seat = "east" | "south" | "west" | "north";
type RoomStatus = "waiting" | "playing" | "finished";
type RoomEventType = "win" | "draw" | "riichi" | "finish" | "undo";

interface InputEvent {
  detail: {
    value: string;
  };
}

interface SwitchEvent {
  detail: {
    value: boolean;
  };
}

interface DatasetEvent extends InputEvent {
  currentTarget: {
    dataset: {
      openid?: string;
    };
  };
}

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

interface RoomEventLog {
  id: string;
  type: RoomEventType;
  actorOpenid: string;
  actorNickName: string;
  deltas: Record<string, number>;
  riichiStickDelta: number;
  honbaDelta: number;
  advanceRound: boolean;
  note: string;
  createdAt: number;
}

interface RoomDocument {
  _id?: string;
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  players: PlayerState[];
  round: RoundState;
  events: RoomEventLog[];
}

interface ViewPlayer extends PlayerState {
  seatText: string;
  isDealer: boolean;
  avatarText: string;
}

interface DeltaInput {
  openid: string;
  nickName: string;
  seatText: string;
  value: string;
}

interface ViewEvent extends RoomEventLog {
  typeText: string;
  deltaText: string;
  createdText: string;
  actorAvatarFileId?: string;
  actorAvatarText: string;
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

let watcher: { close: () => void } | null = null;
let reconnectTimer: number | undefined;

Page({
  data: {
    roomId: "",
    roomCode: "",
    statusText: "等待中",
    roundText: "东1局 0本场",
    riichiSticks: 0,
    honba: 0,
    players: [] as ViewPlayer[],
    events: [] as ViewEvent[],
    watchState: "同步连接中",
    eventPanelVisible: false,
    eventType: "win" as Exclude<RoomEventType, "undo">,
    eventTypeText: "记录和牌",
    deltaInputs: [] as DeltaInput[],
    riichiStickDelta: "0",
    honbaDelta: "0",
    advanceRound: false,
    note: "",
    submitting: false
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
    this.startWatch();
  },

  onUnload() {
    this.stopWatch();
  },

  async fetchRoom() {
    try {
      const response = (await wx.cloud
        .database()
        .collection("rooms")
        .doc(this.data.roomId)
        .get()) as unknown as { data?: RoomDocument };

      if (response.data) {
        this.applyRoom(response.data);
      }
    } catch (error) {
      this.showError(error);
    }
  },

  startWatch() {
    this.stopWatch();
    const db = wx.cloud.database();
    watcher = db
      .collection("rooms")
      .doc(this.data.roomId)
      .watch({
        onChange: (snapshot) => {
          const room = snapshot.docs[0] as RoomDocument | undefined;
          if (room) {
            this.applyRoom(room);
            this.setData({ watchState: "实时同步中" });
          }
        },
        onError: () => {
          this.setData({ watchState: "同步中断，重连中" });
          reconnectTimer = setTimeout(() => {
            this.startWatch();
          }, 3000);
        }
      });
  },

  stopWatch() {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  },

  applyRoom(room: RoomDocument) {
    const players = room.players.map((player) => ({
      ...player,
      seatText: SEAT_TEXT[player.seat],
      isDealer: player.seat === room.round.dealerSeat,
      avatarText: avatarFallbackText(player.nickName)
    }));

    const events = [...room.events]
      .reverse()
      .map((event) => this.toViewEvent(event, room.players));

    this.setData({
      roomCode: room.roomCode,
      statusText: STATUS_TEXT[room.status],
      roundText: `${SEAT_TEXT[room.round.prevalentWind]}${room.round.hand}局 ${room.round.honba}本场`,
      riichiSticks: room.round.riichiSticks,
      honba: room.round.honba,
      players,
      events
    });
  },

  toViewEvent(event: RoomEventLog, players: PlayerState[]): ViewEvent {
    const playerByOpenid = new Map(players.map((player) => [player.openid, player]));
    const deltaText = Object.entries(event.deltas)
      .filter(([, delta]) => delta !== 0)
      .map(([openid, delta]) => {
        const player = playerByOpenid.get(openid);
        return `${player?.nickName ?? "玩家"} ${delta > 0 ? "+" : ""}${delta}`;
      })
      .join(" / ");
    const actor = playerByOpenid.get(event.actorOpenid);

    return {
      ...event,
      typeText: EVENT_TEXT[event.type],
      deltaText: deltaText || "无点数变化",
      createdText: this.formatTime(event.createdAt),
      actorAvatarFileId: actor?.avatarFileId,
      actorAvatarText: avatarFallbackText(actor?.nickName ?? event.actorNickName)
    };
  },

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${hour}:${minute}`;
  },

  onWinTap() {
    this.openEventPanel("win");
  },

  onDrawTap() {
    this.openEventPanel("draw");
    this.setData({
      honbaDelta: "1",
      advanceRound: true
    });
  },

  openEventPanel(type: Exclude<RoomEventType, "undo">) {
    const deltaInputs = this.data.players.map((player) => ({
      openid: player.openid,
      nickName: player.nickName,
      seatText: player.seatText,
      value: "0"
    }));

    this.setData({
      eventPanelVisible: true,
      eventType: type,
      eventTypeText: `记录${EVENT_TEXT[type]}`,
      deltaInputs,
      riichiStickDelta: "0",
      honbaDelta: "0",
      advanceRound: false,
      note: ""
    });
  },

  onDeltaInput(event: DatasetEvent) {
    const openid = event.currentTarget.dataset.openid;
    if (!openid) {
      return;
    }

    this.setData({
      deltaInputs: this.data.deltaInputs.map((item) =>
        item.openid === openid ? { ...item, value: event.detail.value } : item
      )
    });
  },

  onRiichiDeltaInput(event: InputEvent) {
    this.setData({ riichiStickDelta: event.detail.value });
  },

  onHonbaDeltaInput(event: InputEvent) {
    this.setData({ honbaDelta: event.detail.value });
  },

  onAdvanceRoundChange(event: SwitchEvent) {
    this.setData({ advanceRound: event.detail.value });
  },

  onNoteInput(event: InputEvent) {
    this.setData({ note: event.detail.value });
  },

  onCancelEvent() {
    this.setData({ eventPanelVisible: false });
  },

  async onSubmitEvent() {
    const deltas: Record<string, number> = {};
    for (const item of this.data.deltaInputs) {
      const delta = this.parseInteger(item.value, `${item.nickName} 分差`);
      if (delta === undefined) {
        return;
      }
      deltas[item.openid] = delta;
    }

    const riichiStickDelta = this.parseInteger(this.data.riichiStickDelta, "供托变化");
    const honbaDelta = this.parseInteger(this.data.honbaDelta, "本场变化");
    if (riichiStickDelta === undefined || honbaDelta === undefined) {
      return;
    }

    const total = Object.values(deltas).reduce((sum, delta) => sum + delta, 0);
    if (total + riichiStickDelta * 1000 !== 0) {
      wx.showToast({ title: "分差与供托变化不守恒", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    try {
      await this.applyEvent({
        type: this.data.eventType,
        deltas,
        riichiStickDelta,
        honbaDelta,
        advanceRound: this.data.advanceRound,
        note: this.data.note
      });
      this.setData({ eventPanelVisible: false });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  onRiichiTap() {
    wx.showModal({
      title: "确认立直",
      content: "将从你的点数扣除 1000 点，并增加 1 根立直棒。",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await this.applyEvent({ type: "riichi" });
        } catch (error) {
          this.showError(error);
        }
      }
    });
  },

  onPhotoTap() {
    wx.navigateTo({
      url: `/pages/capture/capture?roomId=${this.data.roomId}`
    });
  },

  onUndoTap() {
    wx.showModal({
      title: "撤销上一步",
      content: "将撤销最近一次非撤销事件。",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await wx.cloud.callFunction({
            name: "applyEvent",
            data: {
              roomId: this.data.roomId,
              undo: true
            }
          });
        } catch (error) {
          this.showError(error);
        }
      }
    });
  },

  onFinishTap() {
    wx.showModal({
      title: "终局结算",
      content: "将房间标记为已结算，结算页本期按素点排序。",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await this.applyEvent({ type: "finish", deltas: {} });
          this.onSettlementTap();
        } catch (error) {
          this.showError(error);
        }
      }
    });
  },

  onSettlementTap() {
    wx.navigateTo({
      url: `/pages/settlement/settlement?roomId=${this.data.roomId}`
    });
  },

  async applyEvent(data: Record<string, unknown>) {
    await wx.cloud.callFunction({
      name: "applyEvent",
      data: {
        roomId: this.data.roomId,
        ...data
      }
    });
  },

  parseInteger(value: string, label: string): number | undefined {
    const normalized = value.trim() || "0";
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
      wx.showToast({ title: `${label}必须是整数`, icon: "none" });
      return undefined;
    }
    return parsed;
  },

  showError(error: unknown) {
    const message = error instanceof Error ? error.message : "操作失败";
    wx.showToast({ title: message, icon: "none" });
  }
});

export {};
