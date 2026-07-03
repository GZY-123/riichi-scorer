type GameMode = "3p" | "4p";

interface InputEvent {
  detail: {
    value: string;
  };
}

interface ModeChangeEvent {
  detail: {
    value: GameMode;
  };
}

interface RoomFunctionResult {
  roomId: string;
  roomCode: string;
  playerOpenid: string;
  restored?: boolean;
}

Page({
  data: {
    nickName: "",
    mode: "4p" as GameMode,
    roomCode: "",
    creating: false,
    joining: false
  },

  onLoad() {
    const nickName = wx.getStorageSync("nickName");
    if (typeof nickName === "string" && nickName.trim()) {
      this.setData({ nickName });
    }
  },

  onNickNameInput(event: InputEvent) {
    this.setData({ nickName: event.detail.value });
  },

  onRoomCodeInput(event: InputEvent) {
    this.setData({ roomCode: event.detail.value.replace(/\D/g, "").slice(0, 6) });
  },

  onModeChange(event: ModeChangeEvent) {
    this.setData({ mode: event.detail.value });
  },

  async onCreateRoom() {
    const nickName = this.getNickName();
    if (!nickName) {
      return;
    }

    this.setData({ creating: true });
    try {
      const response = (await wx.cloud.callFunction({
        name: "createRoom",
        data: {
          mode: this.data.mode,
          nickName
        }
      })) as { result?: RoomFunctionResult };

      this.enterRoom(response.result, nickName);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ creating: false });
    }
  },

  async onJoinRoom() {
    const nickName = this.getNickName();
    if (!nickName) {
      return;
    }

    const roomCode = this.data.roomCode.trim();
    if (!/^\d{6}$/.test(roomCode)) {
      wx.showToast({ title: "请输入 6 位房间码", icon: "none" });
      return;
    }

    this.setData({ joining: true });
    try {
      const response = (await wx.cloud.callFunction({
        name: "joinRoom",
        data: {
          roomCode,
          nickName
        }
      })) as { result?: RoomFunctionResult };

      this.enterRoom(response.result, nickName);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ joining: false });
    }
  },

  getNickName(): string {
    const nickName = this.data.nickName.trim();
    if (!nickName) {
      wx.showToast({ title: "请先输入昵称", icon: "none" });
      return "";
    }

    wx.setStorageSync("nickName", nickName);
    return nickName;
  },

  enterRoom(result: RoomFunctionResult | undefined, nickName: string) {
    if (!result?.roomId) {
      wx.showToast({ title: "房间操作失败", icon: "none" });
      return;
    }

    const app = getApp<IAppOption>();
    app.globalData.openid = result.playerOpenid;
    app.globalData.nickName = nickName;

    wx.navigateTo({
      url: `/pages/room/room?roomId=${result.roomId}`
    });
  },

  showError(error: unknown) {
    const message = error instanceof Error ? error.message : "操作失败";
    wx.showToast({ title: message, icon: "none" });
  }
});

export {};
