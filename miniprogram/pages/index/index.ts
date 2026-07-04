import {
  avatarFallbackText,
  readCachedUserProfile,
  UserProfile,
  writeCachedUserProfile
} from "../../utils/profile";
import { LastRoomRecord, readLastRoom, writeLastRoom } from "../../utils/lastRoom";

type GameMode = "3p" | "4p";

interface InputEvent {
  detail: {
    value: string;
  };
}

interface AvatarEvent {
  detail: {
    avatarUrl?: string;
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
  mode?: GameMode;
  playerOpenid: string;
  restored?: boolean;
}

interface UserProfileFunctionResult {
  openid: string;
  profile: UserProfile | null;
}

Page({
  data: {
    openid: "",
    nickName: "",
    avatarFileId: "",
    avatarPreview: "",
    avatarText: "麻",
    profileLoaded: false,
    profileSaved: false,
    editingProfile: true,
    savingProfile: false,
    uploadingAvatar: false,
    mode: "4p" as GameMode,
    roomCode: "",
    lastRoom: null as LastRoomRecord | null,
    creating: false,
    joining: false
  },

  onLoad() {
    const cached = readCachedUserProfile();
    if (cached?.openid) {
      this.applyProfile(cached, true, false);
      this.setData({ profileLoaded: true });
      return;
    }
    if (cached) {
      this.applyProfile(cached, false, true);
    }

    this.loadRemoteProfile();
  },

  onShow() {
    this.refreshLastRoom();
  },

  async loadRemoteProfile() {
    try {
      const result = await this.fetchProfile();
      this.setOpenid(result.openid);
      if (result.profile) {
        const profile = { ...result.profile, openid: result.openid };
        writeCachedUserProfile(profile);
        this.applyProfile(profile, true, false);
      } else {
        this.setData({ openid: result.openid, editingProfile: true });
      }
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ profileLoaded: true });
    }
  },

  onNickNameInput(event: InputEvent) {
    const nickName = event.detail.value;
    this.setData({
      nickName,
      avatarText: avatarFallbackText(nickName)
    });
  },

  async onChooseAvatar(event: AvatarEvent) {
    const avatarUrl = event.detail.avatarUrl;
    if (!avatarUrl) {
      return;
    }

    this.setData({ avatarPreview: avatarUrl, uploadingAvatar: true });
    try {
      const openid = await this.ensureOpenid();
      const fileID = await this.uploadAvatar(openid, avatarUrl);
      this.setData({
        avatarFileId: fileID,
        avatarPreview: ""
      });
    } catch (error) {
      this.setData({ avatarPreview: "" });
      this.showError(error);
    } finally {
      this.setData({ uploadingAvatar: false });
    }
  },

  onEditProfile() {
    this.setData({ editingProfile: true });
  },

  onHistoryTap() {
    wx.navigateTo({
      url: "/pages/history/history"
    });
  },

  onYakuReferenceTap() {
    wx.navigateTo({
      url: "/pages/yaku-reference/yaku-reference"
    });
  },

  onCancelProfileEdit() {
    if (this.data.profileSaved) {
      this.setData({ editingProfile: false });
    }
  },

  async onSaveProfile() {
    try {
      await this.saveProfile();
      wx.showToast({ title: "资料已保存", icon: "success" });
    } catch (error) {
      this.showError(error);
    }
  },

  onRoomCodeInput(event: InputEvent) {
    this.setData({ roomCode: event.detail.value.replace(/\D/g, "").slice(0, 6) });
  },

  onModeChange(event: ModeChangeEvent) {
    this.setData({ mode: event.detail.value });
  },

  onContinueRoom() {
    const room = this.data.lastRoom;
    if (!room) {
      return;
    }

    wx.navigateTo({
      url: `/pages/room/room?roomId=${room.roomId}`
    });
  },

  async onCreateRoom() {
    const profile = await this.ensureSavedProfile();
    if (!profile) {
      return;
    }

    this.setData({ creating: true });
    try {
      const response = (await wx.cloud.callFunction({
        name: "createRoom",
        data: this.withProfilePayload({
          mode: this.data.mode
        })
      })) as { result?: RoomFunctionResult };

      this.enterRoom(response.result, profile);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ creating: false });
    }
  },

  async onJoinRoom() {
    const profile = await this.ensureSavedProfile();
    if (!profile) {
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
        data: this.withProfilePayload({
          roomCode
        })
      })) as { result?: RoomFunctionResult };

      this.enterRoom(response.result, profile);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ joining: false });
    }
  },

  async ensureSavedProfile(): Promise<UserProfile | null> {
    if (this.data.uploadingAvatar) {
      wx.showToast({ title: "头像上传中，请稍候", icon: "none" });
      return null;
    }

    if (this.data.profileSaved && !this.data.editingProfile) {
      return this.currentProfile();
    }

    try {
      return await this.saveProfile();
    } catch (error) {
      this.showError(error);
      return null;
    }
  },

  async saveProfile(): Promise<UserProfile> {
    if (this.data.uploadingAvatar) {
      throw new Error("头像上传中，请稍候");
    }

    const nickName = this.getValidatedNickName();
    if (!nickName) {
      throw new Error("请先填写昵称");
    }

    this.setData({ savingProfile: true });
    try {
      const payload = this.withProfilePayload({
        action: "save" as const,
        nickName
      });
      const response = (await wx.cloud.callFunction({
        name: "userProfile",
        data: payload
      })) as { result?: UserProfileFunctionResult };

      if (!response.result?.profile) {
        throw new Error("资料保存失败");
      }

      const profile = {
        ...response.result.profile,
        openid: response.result.openid
      };
      writeCachedUserProfile(profile);
      this.applyProfile(profile, true, false);
      return profile;
    } finally {
      this.setData({ savingProfile: false });
    }
  },

  getValidatedNickName(): string {
    const nickName = this.data.nickName.trim();
    if (!nickName) {
      wx.showToast({ title: "请先填写昵称", icon: "none" });
      return "";
    }
    if (nickName.length > 16) {
      wx.showToast({ title: "昵称最多 16 个字符", icon: "none" });
      return "";
    }
    return nickName;
  },

  withProfilePayload<T extends Record<string, unknown>>(payload: T): T & {
    nickName: string;
    avatarFileId?: string;
  } {
    return {
      ...payload,
      nickName: this.data.nickName.trim(),
      ...(this.data.avatarFileId ? { avatarFileId: this.data.avatarFileId } : {})
    };
  },

  currentProfile(): UserProfile {
    return {
      openid: this.data.openid || undefined,
      nickName: this.data.nickName.trim(),
      ...(this.data.avatarFileId ? { avatarFileId: this.data.avatarFileId } : {})
    };
  },

  async ensureOpenid(): Promise<string> {
    const app = getApp<IAppOption>();
    const openid = this.data.openid || app.globalData.openid;
    if (openid) {
      return openid;
    }

    const result = await this.fetchProfile();
    this.setOpenid(result.openid);
    if (result.profile && !this.data.profileSaved) {
      const profile = { ...result.profile, openid: result.openid };
      writeCachedUserProfile(profile);
      this.applyProfile(profile, true, false);
    }

    return result.openid;
  },

  async fetchProfile(): Promise<UserProfileFunctionResult> {
    const response = (await wx.cloud.callFunction({
      name: "userProfile",
      data: { action: "get" }
    })) as { result?: UserProfileFunctionResult };

    if (!response.result?.openid) {
      throw new Error("获取登录身份失败");
    }

    return response.result;
  },

  async deleteCurrentAvatar() {
    if (!this.data.avatarFileId) {
      return;
    }

    try {
      await wx.cloud.deleteFile({
        fileList: [this.data.avatarFileId]
      });
    } catch (_error) {
      // 旧头像清理失败不阻塞新头像上传。
    }
  },

  async uploadAvatar(openid: string, filePath: string): Promise<string> {
    try {
      return await this.uploadAvatarFile(openid, filePath);
    } catch (error) {
      if (!this.data.avatarFileId || !this.isFileExistsError(error)) {
        throw error;
      }

      await this.deleteCurrentAvatar();
      return this.uploadAvatarFile(openid, filePath);
    }
  },

  async uploadAvatarFile(openid: string, filePath: string): Promise<string> {
    const upload = await wx.cloud.uploadFile({
      cloudPath: `avatars/${openid}`,
      filePath
    });

    if (!upload.fileID) {
      throw new Error("头像上传失败");
    }

    return upload.fileID;
  },

  isFileExistsError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /already exists|duplicate|file.*exist|已存在|-501001/i.test(message);
  },

  applyProfile(profile: UserProfile, saved: boolean, editing: boolean) {
    this.setOpenid(profile.openid ?? "");
    this.setData({
      openid: profile.openid ?? this.data.openid,
      nickName: profile.nickName,
      avatarFileId: profile.avatarFileId ?? "",
      avatarPreview: "",
      avatarText: avatarFallbackText(profile.nickName),
      profileSaved: saved,
      editingProfile: editing
    });
  },

  setOpenid(openid: string) {
    if (!openid) {
      return;
    }

    const app = getApp<IAppOption>();
    app.globalData.openid = openid;
    this.setData({ openid });
  },

  enterRoom(result: RoomFunctionResult | undefined, profile: UserProfile) {
    if (!result?.roomId) {
      wx.showToast({ title: "房间操作失败", icon: "none" });
      return;
    }

    const app = getApp<IAppOption>();
    app.globalData.openid = result.playerOpenid;
    app.globalData.nickName = profile.nickName;
    app.globalData.avatarFileId = profile.avatarFileId ?? "";

    writeLastRoom({
      roomId: result.roomId,
      roomCode: result.roomCode || result.roomId,
      mode: result.mode ?? this.data.mode
    });
    this.refreshLastRoom();
    this.vibrateLight();

    wx.navigateTo({
      url: `/pages/room/room?roomId=${result.roomId}`
    });
  },

  refreshLastRoom() {
    this.setData({ lastRoom: readLastRoom() });
  },

  vibrateLight() {
    try {
      wx.vibrateShort({ type: "light" });
    } catch (_error) {
      // 真机支持时才会生效。
    }
  },

  showError(error: unknown) {
    const message = error instanceof Error ? error.message : "操作失败";
    wx.showToast({ title: message, icon: "none" });
  }
});

export {};
