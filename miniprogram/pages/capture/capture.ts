import { detectTilesOnDevice } from "../../utils/localDetector";

type GameMode = "3p" | "4p";
type Seat = "east" | "south" | "west" | "north";
type WinType = "ron" | "tsumo";
type MeldType = "chi" | "pon" | "kan-open" | "kan-closed" | "kan-added" | "north";

interface InputEvent {
  detail: {
    value: string;
  };
  currentTarget: {
    dataset: Record<string, string | number | undefined>;
  };
}

interface PickerEvent {
  detail: {
    value: string;
  };
  currentTarget: {
    dataset: Record<string, string | number | undefined>;
  };
}

interface SwitchEvent {
  detail: {
    value: boolean;
  };
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string | number | undefined>;
  };
}

interface TileKeyboardEvent {
  detail: {
    tile?: string;
    value?: string;
  };
}

interface PlayerState {
  openid: string;
  nickName: string;
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

interface RoomDocument {
  roomCode: string;
  mode: GameMode;
  players: PlayerState[];
  round: RoundState;
}

interface ViewPlayer extends PlayerState {
  seatText: string;
  label: string;
}

interface TileCell {
  id: string;
  value: string;
  isWinning: boolean;
  // 渲染 key 含牌值：值变化时强制重建组件实例，规避真机列表 diff 复用错位
  renderKey?: string;
}

interface MeldInput {
  type: MeldType;
  tiles: string[];
  calledTile?: string;
}

interface MeldView extends MeldInput {
  id: string;
  typeText: string;
  tilesText: string;
  tileItems: Array<{ key: string; code: string }>;
}

interface RecognizeResult {
  tiles: string[];
  melds: MeldInput[];
  confidence: number;
  rawText: string;
  errorCode?: string;
  message?: string;
}

interface ScoreResult {
  ron?: number;
  tsumo?: {
    dealer?: number;
    nonDealer?: number;
    all?: number;
    total: number;
  };
  total: number;
}

interface ScoreHandResult {
  yaku: Array<{ name: string; han?: number; yakuman?: number; isDora?: boolean }>;
  han: number;
  fu: number;
  yakuman: number;
  score: ScoreResult;
  deltas: Record<string, number>;
  applyEvent: {
    type: "win";
    deltas: Record<string, number>;
    riichiStickDelta: number;
    honbaDelta: number;
    advanceRound: boolean;
    note: string;
  };
}

interface DeltaRow {
  openid: string;
  label: string;
  valueText: string;
  positive: boolean;
}

interface ScorePreview {
  yakuText: string;
  valueText: string;
  paymentText: string;
  deltaRows: DeltaRow[];
  applyEvent: ScoreHandResult["applyEvent"];
}

const SEAT_TEXT: Record<Seat, string> = {
  east: "东",
  south: "南",
  west: "西",
  north: "北"
};

const MELD_TYPE_OPTIONS: Array<{ value: MeldType; text: string }> = [
  { value: "chi", text: "吃" },
  { value: "pon", text: "碰" },
  { value: "kan-open", text: "明杠" },
  { value: "kan-closed", text: "暗杠" },
  { value: "kan-added", text: "加杠" },
  { value: "north", text: "拔北" }
];

let tileIdSeed = 0;
let meldIdSeed = 0;

Page({
  data: {
    roomId: "",
    roomCode: "",
    mode: "4p" as GameMode,
    roundText: "",
    honba: 0,
    riichiSticks: 0,
    prevalentWindText: "东",
    players: [] as ViewPlayer[],
    playerNames: [] as string[],
    winnerIndex: 0,
    loserIndex: 1,
    winType: "ron" as WinType,
    imageTempPath: "",
    recognizeState: "待选择图片",
    recognizeError: "",
    confidenceText: "",
    rawText: "",
    tiles: [] as TileCell[],
    melds: [] as MeldView[],
    tileEditorVisible: false,
    tileEditIndex: -1,
    tileEditorValue: "",
    tileEditorWinning: false,
    meldEditorVisible: false,
    meldEditIndex: -1,
    meldTypeIndex: 0,
    meldTypeTexts: MELD_TYPE_OPTIONS.map((option) => option.text),
    meldEditorTiles: [] as string[],
    riichi: false,
    ippatsu: false,
    doraIndicators: [] as string[],
    doraItems: [] as Array<{ key: string; code: string }>,
    nukiDora: "0",
    scoring: false,
    applying: false,
    scorePreview: null as ScorePreview | null
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
      this.showError(error, "读取房间失败");
    }
  },

  applyRoom(room: RoomDocument) {
    const players = room.players.map((player) => ({
      ...player,
      seatText: SEAT_TEXT[player.seat],
      label: `${SEAT_TEXT[player.seat]} ${player.nickName}`
    }));
    const winnerIndex = Math.min(this.data.winnerIndex, Math.max(players.length - 1, 0));
    const loserIndex = this.resolveLoserIndex(players, winnerIndex, this.data.loserIndex);

    this.setData({
      roomCode: room.roomCode,
      mode: room.mode,
      roundText: `${SEAT_TEXT[room.round.prevalentWind]}${room.round.hand}局`,
      honba: room.round.honba,
      riichiSticks: room.round.riichiSticks,
      prevalentWindText: SEAT_TEXT[room.round.prevalentWind],
      players,
      playerNames: players.map((player) => player.label),
      winnerIndex,
      loserIndex
    });
  },

  async onChooseImage() {
    try {
      const tempFilePath = await this.compressForRecognition(await this.chooseImage());
      this.setData({
        imageTempPath: tempFilePath,
        recognizeState: "本地识别中",
        recognizeError: "",
        confidenceText: "",
        rawText: "",
        scorePreview: null
      });

      try {
        const localResult = await detectTilesOnDevice(tempFilePath, (progress) => {
          this.setData({ recognizeState: progress.message });
        });
        this.applyRecognizedResult(localResult);
        return;
      } catch (localError) {
        await this.recognizeWithCloudFallback(tempFilePath, this.errorMessage(localError));
      }
    } catch (error) {
      this.setData({ recognizeState: "识别失败，可手动录入" });
      this.showError(error, "识别失败");
    }
  },

  async recognizeWithCloudFallback(tempFilePath: string, localErrorMessage: string) {
    this.setData({
      recognizeState: "云端识别中（本地不可用）",
      recognizeError: `本地识别不可用：${localErrorMessage}`
    });
    const fileID = await this.uploadImage(tempFilePath);
    const response = (await wx.cloud.callFunction({
      name: "recognizeTiles",
      data: {
        fileID,
        mode: this.data.mode
      }
    })) as unknown as { result?: RecognizeResult };
    const result = response.result;
    if (!result) {
      throw new Error("识别服务无返回");
    }
    if (result.errorCode) {
      this.setData({
        recognizeState: "识别失败，可手动录入",
        recognizeError: result.message ?? result.errorCode,
        rawText: result.rawText ?? ""
      });
      return;
    }

    this.applyRecognizedResult(result);
  },

  onManualOnlyTap() {
    this.setData({
      recognizeState: "手动录入中",
      recognizeError: "",
      scorePreview: null
    });
  },

  applyRecognizedResult(result: RecognizeResult) {
    const tiles = result.tiles.map((tile, index) => ({
      id: this.nextTileId(),
      value: tile,
      isWinning: index === result.tiles.length - 1
    }));
    const melds = this.toMeldViews(result.melds ?? []);
    this.setData({
      tiles: this.decorateTiles(tiles),
      melds,
      recognizeState: "识别完成",
      recognizeError: "",
      confidenceText: `${Math.round((result.confidence ?? 0) * 100)}%`,
      rawText: result.rawText ?? "",
      scorePreview: null
    });
  },

  onHandKeyboardTap(event: TileKeyboardEvent) {
    const value = this.tileFromKeyboardEvent(event);
    if (!value || !this.ensureValidTile(value, "牌")) {
      return;
    }
    const tiles = this.data.tiles.map((tile) => ({ ...tile, isWinning: false }));
    tiles.push({ id: this.nextTileId(), value, isWinning: true });
    this.syncTiles(tiles);
  },

  onHandKeyboardDelete() {
    const tiles = this.withWinningTile(this.data.tiles.slice(0, -1));
    this.syncTiles(tiles);
  },

  onTileTap(event: TapEvent) {
    const index = this.toIndex(event.currentTarget.dataset.index);
    const tile = this.data.tiles[index];
    if (!tile) {
      return;
    }
    this.setData({
      tileEditorVisible: true,
      tileEditIndex: index,
      tileEditorValue: tile.value,
      tileEditorWinning: tile.isWinning
    });
  },

  onTileEditorKeyboardTap(event: TileKeyboardEvent) {
    const value = this.tileFromKeyboardEvent(event);
    if (!value || !this.ensureValidTile(value, "牌")) {
      return;
    }
    this.setData({ tileEditorValue: value });
  },

  onTileEditorKeyboardDelete() {
    this.setData({ tileEditorValue: "" });
  },

  onTileWinningChange(event: SwitchEvent) {
    this.setData({ tileEditorWinning: event.detail.value });
  },

  onSaveTileEditor() {
    const index = this.data.tileEditIndex;
    const value = this.data.tileEditorValue.trim();
    if (!isTileNotation(value, this.data.mode)) {
      wx.showToast({ title: "牌记法无效", icon: "none" });
      return;
    }
    const tiles = this.data.tiles.map((tile, tileIndex) => ({
      ...tile,
      value: tileIndex === index ? value : tile.value,
      isWinning: this.data.tileEditorWinning ? tileIndex === index : tile.isWinning && tileIndex !== index
    }));
    this.syncTiles(tiles);
    this.setData({ tileEditorVisible: false });
  },

  onDeleteTile() {
    const index = this.data.tileEditIndex;
    const tiles = this.withWinningTile(this.data.tiles.filter((_, tileIndex) => tileIndex !== index));
    this.syncTiles(tiles);
    this.setData({ tileEditorVisible: false });
  },

  onMakePonMeld() {
    const value = this.data.tileEditorValue.trim();
    if (!isTileNotation(value, this.data.mode)) {
      wx.showToast({ title: "牌记法无效", icon: "none" });
      return;
    }
    const normalized = normalizeTile(value);
    const matching = this.data.tiles.filter((tile) => normalizeTile(tile.value) === normalized);
    if (matching.length < 3) {
      wx.showToast({ title: "需要至少 3 张相同牌", icon: "none" });
      return;
    }

    let removed = 0;
    const tiles = this.data.tiles.filter((tile) => {
      if (normalizeTile(tile.value) === normalized && removed < 3) {
        removed += 1;
        return false;
      }
      return true;
    });
    const nextTiles = this.withWinningTile(tiles);
    this.syncTiles(nextTiles);
    this.setData({
      melds: [
        ...this.data.melds,
        this.toMeldView({
          type: "pon",
          tiles: [value, value, value]
        })
      ],
      tileEditorVisible: false,
      scorePreview: null
    });
  },

  onCancelTileEditor() {
    this.setData({ tileEditorVisible: false });
  },

  onAddMeld() {
    this.setData({
      meldEditorVisible: true,
      meldEditIndex: -1,
      meldTypeIndex: 0,
      meldEditorTiles: []
    });
  },

  onEditMeld(event: TapEvent) {
    const index = this.toIndex(event.currentTarget.dataset.index);
    const meld = this.data.melds[index];
    if (!meld) {
      return;
    }
    const meldTypeIndex = Math.max(0, MELD_TYPE_OPTIONS.findIndex((option) => option.value === meld.type));
    this.setData({
      meldEditorVisible: true,
      meldEditIndex: index,
      meldTypeIndex,
      meldEditorTiles: [...meld.tiles]
    });
  },

  onMeldTypeChange(event: PickerEvent) {
    this.setData({ meldTypeIndex: this.toIndex(event.detail.value) });
  },

  onMeldKeyboardTap(event: TileKeyboardEvent) {
    const value = this.tileFromKeyboardEvent(event);
    if (!value || !this.ensureValidTile(value, "副露牌")) {
      return;
    }
    this.setData({ meldEditorTiles: [...this.data.meldEditorTiles, value] });
  },

  onMeldKeyboardDelete() {
    this.setData({ meldEditorTiles: this.data.meldEditorTiles.slice(0, -1) });
  },

  onMeldEditorTileTap(event: TapEvent) {
    const index = this.toIndex(event.currentTarget.dataset.index);
    this.setData({
      meldEditorTiles: this.data.meldEditorTiles.filter((_, tileIndex) => tileIndex !== index)
    });
  },

  onSaveMeld() {
    const type = MELD_TYPE_OPTIONS[this.data.meldTypeIndex]?.value ?? "chi";
    const tiles = [...this.data.meldEditorTiles];
    if (!this.isMeldTileCountValid(type, tiles.length)) {
      wx.showToast({ title: "副露张数不正确", icon: "none" });
      return;
    }
    const next = this.toMeldView({ type, tiles });
    const melds =
      this.data.meldEditIndex >= 0
        ? this.data.melds.map((meld, index) => (index === this.data.meldEditIndex ? next : meld))
        : [...this.data.melds, next];
    this.setData({
      melds,
      meldEditorVisible: false,
      scorePreview: null
    });
  },

  onDeleteMeld() {
    const index = this.data.meldEditIndex;
    if (index < 0) {
      this.setData({ meldEditorVisible: false });
      return;
    }
    this.setData({
      melds: this.data.melds.filter((_, meldIndex) => meldIndex !== index),
      meldEditorVisible: false,
      scorePreview: null
    });
  },

  onCancelMeldEditor() {
    this.setData({ meldEditorVisible: false });
  },

  onWinnerChange(event: PickerEvent) {
    const winnerIndex = this.toIndex(event.detail.value);
    const loserIndex = this.resolveLoserIndex(this.data.players, winnerIndex, this.data.loserIndex);
    this.setData({ winnerIndex, loserIndex, scorePreview: null });
  },

  onLoserChange(event: PickerEvent) {
    this.setData({ loserIndex: this.toIndex(event.detail.value), scorePreview: null });
  },

  onWinTypeTap(event: TapEvent) {
    const winType = event.currentTarget.dataset.type === "tsumo" ? "tsumo" : "ron";
    this.setData({ winType, scorePreview: null });
  },

  onRiichiChange(event: SwitchEvent) {
    this.setData({ riichi: event.detail.value, scorePreview: null });
  },

  onIppatsuChange(event: SwitchEvent) {
    this.setData({ ippatsu: event.detail.value, scorePreview: null });
  },

  onDoraKeyboardTap(event: TileKeyboardEvent) {
    const value = this.tileFromKeyboardEvent(event);
    if (!value || !this.ensureValidTile(value, "宝牌指示牌")) {
      return;
    }
    this.syncDora([...this.data.doraIndicators, value]);
  },

  onDoraKeyboardDelete() {
    this.syncDora(this.data.doraIndicators.slice(0, -1));
  },

  onDoraTileTap(event: TapEvent) {
    const index = this.toIndex(event.currentTarget.dataset.index);
    this.syncDora(this.data.doraIndicators.filter((_, tileIndex) => tileIndex !== index));
  },

  onNukiDoraInput(event: InputEvent) {
    this.setData({ nukiDora: event.detail.value, scorePreview: null });
  },

  async onScoreTap() {
    const winner = this.data.players[this.data.winnerIndex];
    if (!winner) {
      wx.showToast({ title: "请选择和牌者", icon: "none" });
      return;
    }
    const loser = this.data.players[this.data.loserIndex];
    if (this.data.winType === "ron" && (!loser || loser.openid === winner.openid)) {
      wx.showToast({ title: "请选择放铳者", icon: "none" });
      return;
    }
    const tiles = this.data.tiles.map((tile) => tile.value);
    if (tiles.length === 0) {
      wx.showToast({ title: "请录入手牌", icon: "none" });
      return;
    }
    const invalidTile = tiles.find((tile) => !isTileNotation(tile, this.data.mode));
    if (invalidTile) {
      wx.showToast({ title: `${invalidTile} 不是有效牌`, icon: "none" });
      return;
    }
    const winningTile = this.data.tiles.find((tile) => tile.isWinning)?.value ?? tiles[tiles.length - 1];
    const doraIndicators = [...this.data.doraIndicators];
    const nukiDora = this.parseNonNegativeInteger(this.data.nukiDora, "拔北数");
    if (nukiDora === undefined) {
      return;
    }

    this.setData({ scoring: true });
    try {
      const response = (await wx.cloud.callFunction({
        name: "scoreHand",
        data: {
          roomId: this.data.roomId,
          mode: this.data.mode,
          winnerOpenid: winner.openid,
          loserOpenid: this.data.winType === "ron" ? loser?.openid : undefined,
          winType: this.data.winType,
          tiles,
          melds: this.data.melds.map((meld) => ({ type: meld.type, tiles: meld.tiles })),
          winningTile,
          riichi: this.data.riichi,
          ippatsu: this.data.ippatsu,
          doraIndicators,
          nukiDora,
          honba: this.data.honba,
          riichiSticks: this.data.riichiSticks
        }
      })) as unknown as { result?: ScoreHandResult };
      if (!response.result) {
        throw new Error("算点服务无返回");
      }
      this.setData({ scorePreview: this.toScorePreview(response.result) });
    } catch (error) {
      this.showError(error, "算点失败");
    } finally {
      this.setData({ scoring: false });
    }
  },

  async onConfirmApply() {
    const preview = this.data.scorePreview;
    if (!preview) {
      return;
    }
    this.setData({ applying: true });
    try {
      await wx.cloud.callFunction({
        name: "applyEvent",
        data: {
          roomId: this.data.roomId,
          ...preview.applyEvent
        }
      });
      wx.navigateBack();
    } catch (error) {
      this.showError(error, "落账失败");
    } finally {
      this.setData({ applying: false });
    }
  },

  chooseImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: 1,
        sourceType: ["camera", "album"],
        sizeType: ["compressed"],
        success: (result) => {
          const path = result.tempFilePaths[0];
          if (path) {
            resolve(path);
          } else {
            reject(new Error("未选择图片"));
          }
        },
        fail: reject
      });
    });
  },

  // 视觉 API 对 base64 图片有大小上限，识别麻将牌 1600px 宽度足够
  async compressForRecognition(filePath: string): Promise<string> {
    try {
      const info = await new Promise<{ width: number }>((resolve, reject) => {
        wx.getImageInfo({ src: filePath, success: resolve, fail: reject });
      });
      const result = await new Promise<{ tempFilePath?: string }>((resolve, reject) => {
        wx.compressImage({
          src: filePath,
          quality: 70,
          compressedWidth: Math.min(info.width, 1600),
          success: resolve,
          fail: reject
        });
      });
      return result.tempFilePath || filePath;
    } catch {
      return filePath;
    }
  },

  async uploadImage(filePath: string): Promise<string> {
    const ext = filePath.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg";
    const response = (await wx.cloud.uploadFile({
      cloudPath: `recognition/${this.data.roomId}/${Date.now()}_${Math.floor(Math.random() * 100000)}${ext}`,
      filePath
    })) as unknown as { fileID?: string };
    if (!response.fileID) {
      throw new Error("图片上传失败");
    }
    return response.fileID;
  },

  syncTiles(tiles: TileCell[]) {
    this.setData({
      tiles: this.decorateTiles(tiles),
      scorePreview: null
    });
  },

  withWinningTile(tiles: TileCell[]): TileCell[] {
    if (tiles.length === 0 || tiles.some((tile) => tile.isWinning)) {
      return tiles;
    }
    return tiles.map((tile, index) => ({
      ...tile,
      isWinning: index === tiles.length - 1
    }));
  },

  tileFromKeyboardEvent(event: TileKeyboardEvent): string {
    return (event.detail.tile ?? event.detail.value ?? "").trim();
  },

  ensureValidTile(value: string, label: string): boolean {
    if (isTileNotation(value, this.data.mode)) {
      return true;
    }
    wx.showToast({ title: `${value} 不是有效${label}`, icon: "none" });
    return false;
  },

  toMeldViews(melds: MeldInput[]): MeldView[] {
    return melds.map((meld) => this.toMeldView(meld));
  },

  toMeldView(meld: MeldInput): MeldView {
    const id = this.nextMeldId();
    return {
      ...meld,
      id,
      typeText: MELD_TYPE_OPTIONS.find((option) => option.value === meld.type)?.text ?? meld.type,
      tilesText: meld.tiles.join(" "),
      tileItems: meld.tiles.map((tile, index) => ({ key: `${id}_${index}_${tile}`, code: tile }))
    };
  },

  syncDora(doraIndicators: string[]) {
    this.setData({
      doraIndicators,
      doraItems: doraIndicators.map((tile, index) => ({ key: `${index}_${tile}`, code: tile })),
      scorePreview: null
    });
  },

  decorateTiles(tiles: TileCell[]): TileCell[] {
    return tiles.map((tile) => ({
      ...tile,
      renderKey: `${tile.id}_${tile.value}_${tile.isWinning ? 1 : 0}`
    }));
  },

  toScorePreview(result: ScoreHandResult): ScorePreview {
    const yakuText =
      result.yaku
        .map((item) => {
          if (item.yakuman) return `${item.name} ${item.yakuman}倍役满`;
          if (item.han) return `${item.name} ${item.han}番`;
          return item.name;
        })
        .join(" / ") || "无";
    const valueText = result.yakuman > 0 ? `${result.yakuman}倍役满` : `${result.han}番 ${result.fu}符`;
    const paymentText =
      result.score.ron !== undefined
        ? `荣和 ${result.score.ron} 点`
        : result.score.tsumo?.all !== undefined
          ? `自摸 每家 ${result.score.tsumo.all} 点`
          : `自摸 庄家 ${result.score.tsumo?.dealer ?? 0} 点 / 闲家 ${result.score.tsumo?.nonDealer ?? 0} 点`;
    return {
      yakuText,
      valueText,
      paymentText,
      deltaRows: this.data.players.map((player) => {
        const delta = result.deltas[player.openid] ?? 0;
        return {
          openid: player.openid,
          label: player.label,
          valueText: `${delta > 0 ? "+" : ""}${delta}`,
          positive: delta > 0
        };
      }),
      applyEvent: result.applyEvent
    };
  },

  resolveLoserIndex(players: ViewPlayer[], winnerIndex: number, currentLoserIndex: number): number {
    if (players.length === 0) {
      return 0;
    }
    if (currentLoserIndex >= 0 && currentLoserIndex < players.length && currentLoserIndex !== winnerIndex) {
      return currentLoserIndex;
    }
    const next = players.findIndex((_, index) => index !== winnerIndex);
    return next >= 0 ? next : 0;
  },

  isMeldTileCountValid(type: MeldType, count: number): boolean {
    if (type === "north") return count === 1;
    if (type === "chi" || type === "pon") return count === 3;
    return count === 4;
  },

  parseNonNegativeInteger(value: string, label: string): number | undefined {
    const parsed = Number(value.trim() || "0");
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      wx.showToast({ title: `${label}必须是非负整数`, icon: "none" });
      return undefined;
    }
    return parsed;
  },

  toIndex(value: string | number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  },

  nextTileId(): string {
    tileIdSeed += 1;
    return `tile_${tileIdSeed}`;
  },

  nextMeldId(): string {
    meldIdSeed += 1;
    return `meld_${meldIdSeed}`;
  },

  showError(error: unknown, fallback: string) {
    const message = this.errorMessage(error) || fallback;
    wx.showToast({ title: message, icon: "none" });
  },

  errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "object" && error !== null && "errMsg" in error) {
      const errMsg = (error as { errMsg?: unknown }).errMsg;
      if (typeof errMsg === "string" && errMsg.trim()) {
        return errMsg;
      }
    }
    return String(error);
  }
});

function isTileNotation(tile: string, mode: GameMode): boolean {
  if (!/^[0-9][mpsz]$/.test(tile)) {
    return false;
  }
  const rank = Number(tile[0]);
  const suit = tile[1];
  if (suit === "z") {
    return rank >= 1 && rank <= 7;
  }
  if (rank !== 0 && (rank < 1 || rank > 9)) {
    return false;
  }
  return !(mode === "3p" && suit === "m" && rank >= 2 && rank <= 8);
}

function normalizeTile(tile: string): string {
  return tile[0] === "0" ? `5${tile[1]}` : tile;
}

export {};
