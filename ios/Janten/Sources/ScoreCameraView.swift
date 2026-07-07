import AVFoundation
import PhotosUI
import SwiftUI
import UIKit

struct ScoreCameraView: View {
    @Environment(\.openURL) private var openURL

    @State private var mode: GameMode = AppPreferences.defaultGameMode
    @State private var photoItem: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    @State private var detections: [TileDetectionService.Detection] = []
    @State private var isDetecting = false
    @State private var detectionMessage: String?
    @State private var handTiles: [EditableScoreTile] = []
    @State private var winningIndex: Int?
    @State private var editingIndex: Int?
    @State private var cursorIndex = 0
    @State private var showsCamera = false
    @State private var winType: ScoreWinType = .tsumo
    @State private var isDealer = true
    @State private var prevalentWind: SeatWind = .east
    @State private var seatWind: SeatWind = .east
    @State private var riichi = false
    @State private var doubleRiichi = false
    @State private var ippatsu = false
    @State private var doraIndicators: [DoraIndicatorTile] = []
    @State private var editingDora = false
    @State private var showsCameraPermissionAlert = false
    @State private var honba = 0
    @State private var nukiDora = 0
    @State private var scoreError: String?
    @State private var result: ScoreCalculationResult?
    @State private var didLoadPrefill = false

    private var cameraHardwareAvailable: Bool {
        AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) != nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    operationCard

                    if let selectedImage {
                        previewCard(image: selectedImage)
                    }

                    correctionCard
                    contextCard
                    scoreAction

                    if let scoreError {
                        Text(scoreError)
                            .font(.system(.subheadline, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.accentRed)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("算点")
            .fullScreenCover(isPresented: $showsCamera) {
                CameraCaptureView { captureResult in
                    processCameraCapture(captureResult)
                }
            }
            .fullScreenCover(item: $result) { result in
                ScoreResultCard(result: result) {
                    self.result = nil
                }
            }
            .alert("相机权限未开启", isPresented: $showsCameraPermissionAlert) {
                Button("取消", role: .cancel) {}
                Button("去设置开启") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                }
            } message: {
                Text("请在系统设置里允许算点Janten访问相机。")
            }
            .onAppear {
                CameraCaptureOrientation.installLockIfNeeded()
                loadPrefillIfNeeded()
            }
            .onChange(of: photoItem) { _, newItem in
                if newItem != nil {
                    Haptics.tap()
                }
                loadPhotoItem(newItem)
            }
            .onChange(of: isDealer) { _, newValue in
                Haptics.tap()
                if newValue {
                    seatWind = .east
                }
            }
            .onChange(of: mode) { _, newValue in
                Haptics.tap()
                if newValue == .fourPlayer {
                    nukiDora = 0
                }
            }
            .onChange(of: winType) { _, _ in
                Haptics.tap()
            }
            .onChange(of: prevalentWind) { _, _ in
                Haptics.tap()
            }
            .onChange(of: seatWind) { _, _ in
                if !isDealer {
                    Haptics.tap()
                }
            }
            .onChange(of: riichi) { _, _ in
                Haptics.tap()
            }
            .onChange(of: doubleRiichi) { _, _ in
                Haptics.tap()
            }
            .onChange(of: ippatsu) { _, _ in
                Haptics.tap()
            }
        }
    }

    private var operationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Button {
                    handleCameraButtonTap()
                } label: {
                    actionLabel(title: "拍照", systemImage: "camera", disabled: !cameraHardwareAvailable)
                }
                .buttonStyle(.plain)
                .disabled(!cameraHardwareAvailable)

                PhotosPicker(selection: $photoItem, matching: .images) {
                    actionLabel(title: "从相册选择", systemImage: "photo.on.rectangle", disabled: false)
                }
                .buttonStyle(.plain)
            }

            Picker("模式", selection: $mode) {
                ForEach(GameMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
        }
        .jantenCard()
    }

    private func actionLabel(title: String, systemImage: String, disabled: Bool) -> some View {
        Label(title, systemImage: systemImage)
            .font(.system(.headline, design: .rounded).weight(.bold))
            .foregroundStyle(disabled ? Color.textSecondary : Color.ivory)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(disabled ? Color.backgroundSecondary : Color.felt, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(disabled ? Color.hairline : Color.feltBright.opacity(0.7), lineWidth: 0.8)
            )
    }

    private func previewCard(image: UIImage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            DetectionPreview(image: image, detections: detections)
                .frame(height: 280)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.hairline, lineWidth: 0.8)
                )

            HStack(spacing: 8) {
                if isDetecting {
                    ProgressView()
                        .tint(Color.felt)
                    Text("识别中")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                } else {
                    Text("识别到 \(detections.count) 张")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(detections.isEmpty ? Color.textSecondary : Color.feltBright)
                }

                Spacer()
            }

            if let detectionMessage {
                Text(detectionMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.accentRed)
            }
        }
        .jantenCard()
    }

    private var correctionCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("牌面修正")
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Text("\(handTiles.count)/14")
                    .font(.system(.subheadline, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(handTiles.count == 14 ? Color.feltBright : Color.textSecondary)
            }

            HStack(spacing: 10) {
                Button("理牌") {
                    Haptics.press()
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.84)) { sortHand() }
                }
                    .disabled(handTiles.isEmpty)
                Button("清空") {
                    Haptics.press()
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.84)) { clearHand() }
                }
                    .disabled(handTiles.isEmpty)
                if let editingIndex, handTiles.indices.contains(editingIndex) {
                    Button("设为和牌张") {
                        setWinningIndex(editingIndex)
                    }
                }
            }
            .font(.system(.subheadline, design: .rounded).weight(.semibold))
            .buttonStyle(.bordered)
            .tint(Color.felt)

            handGrid

            TileKeyboardView(
                onTap: handleTileKeyboardTap,
                onDelete: handleKeyboardDelete,
                showsDelete: editingIndex != nil
            )
            .padding(.top, 4)
        }
        .jantenCard()
    }

    private var handGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 9) {
            ForEach(Array(handTiles.enumerated()), id: \.element.id) { index, _ in
                handTileButton(index)

                if shouldShowInlineDelete(after: index) {
                    inlineDeleteKey
                }
            }

            let placeholders = max(0, 14 - handTiles.count)
            ForEach(0..<placeholders, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.backgroundSecondary.opacity(0.45))
                    .aspectRatio(3.0 / 4.0, contentMode: .fit)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(Color.hairline, lineWidth: 0.8)
                    )
            }
        }
        .padding(.vertical, 2)
    }

    private func handTileButton(_ index: Int) -> some View {
        Button {
            Haptics.tap()
            editingIndex = index
            cursorIndex = index + 1
        } label: {
            TileImageView(code: handTiles[index].code, size: 38)
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(index == winningIndex ? Color.accentRed : Color.clear, lineWidth: 2.5)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(index == editingIndex ? Color.feltBright : Color.clear, lineWidth: 2)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var inlineDeleteKey: some View {
        Button {
            Haptics.tap()
            deleteBeforeCursor()
        } label: {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.backgroundSecondary)
                .aspectRatio(3.0 / 4.0, contentMode: .fit)
                .overlay(
                    Image(systemName: "delete.left")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.accentRed)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(Color.hairline, lineWidth: 0.8)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("退格")
    }

    private var contextCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("场况")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            Picker("和牌方式", selection: $winType) {
                ForEach(ScoreWinType.allCases) { type in
                    Text(type.title).tag(type)
                }
            }
            .pickerStyle(.segmented)

            Toggle("庄家", isOn: $isDealer)
                .tint(Color.felt)

            windPicker(title: "场风", selection: $prevalentWind)
            windPicker(title: "自风", selection: $seatWind)
                .disabled(isDealer)
                .opacity(isDealer ? 0.58 : 1)

            VStack(spacing: 10) {
                Toggle("立直", isOn: $riichi)
                    .tint(Color.felt)
                Toggle("两立直", isOn: $doubleRiichi)
                    .tint(Color.felt)
                Toggle("一发", isOn: $ippatsu)
                    .tint(Color.felt)
                    .disabled(!riichi && !doubleRiichi)
                    .opacity((riichi || doubleRiichi) ? 1 : 0.58)
            }

            doraPicker

            Stepper(value: $honba, in: 0...20) {
                Text("本场数 \(honba)")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
            }
            .tint(Color.felt)

            if mode == .threePlayer {
                Stepper(value: $nukiDora, in: 0...4) {
                    Text("拔北数 \(nukiDora)")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.textPrimary)
                }
                .tint(Color.felt)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .jantenCard()
    }

    private func windPicker(title: String, selection: Binding<SeatWind>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.textSecondary)

            Picker(title, selection: selection) {
                ForEach(SeatWind.allCases) { wind in
                    Text(wind.title).tag(wind)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var doraPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("宝牌指示牌")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Button {
                    Haptics.tap()
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                        editingDora.toggle()
                    }
                } label: {
                    Image(systemName: editingDora ? "chevron.up" : "plus")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.accentBrand)
                        .frame(width: 34, height: 30)
                        .background(Color.backgroundSecondary, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
            }

            if doraIndicators.isEmpty {
                Text("未选择")
                    .font(.footnote)
                    .foregroundStyle(Color.textSecondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(doraIndicators) { tile in
                            Button {
                                removeDora(tile)
                            } label: {
                                TileImageView(code: tile.code, size: 34)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            if editingDora {
                TileKeyboardView(
                    onTap: addDora,
                    onDelete: {},
                    showsDelete: false
                )
                .transition(.opacity)
            }
        }
    }

    private var scoreAction: some View {
        Button(action: calculateScore) {
            Text("算点")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.ivory)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(Color.felt, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.feltBright.opacity(0.75), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func handleCameraButtonTap() {
        guard cameraHardwareAvailable else {
            detectionMessage = "当前设备不可用相机"
            Haptics.warning()
            return
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            Haptics.tap()
            showsCamera = true
        case .notDetermined:
            Haptics.tap()
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showsCamera = true
                    } else {
                        showsCameraPermissionAlert = true
                        Haptics.warning()
                    }
                }
            }
        case .denied, .restricted:
            showsCameraPermissionAlert = true
            Haptics.warning()
        @unknown default:
            detectionMessage = "相机状态异常，请稍后重试"
            Haptics.warning()
        }
    }

    private func loadPhotoItem(_ item: PhotosPickerItem?) {
        guard let item else {
            return
        }

        Task {
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    await MainActor.run {
                        detectionMessage = "图片无法读取，请换一张照片"
                        Haptics.warning()
                    }
                    return
                }
                await MainActor.run {
                    processPickedImage(image)
                }
            } catch {
                await MainActor.run {
                    detectionMessage = friendlyMessage(for: error)
                    Haptics.warning()
                }
            }
        }
    }

    @MainActor
    private func processPickedImage(_ image: UIImage) {
        selectedImage = image
        detections = []
        detectionMessage = nil
        scoreError = nil
        isDetecting = true

        Task {
            do {
                let output = try await Task.detached(priority: .userInitiated) {
                    try TileDetectionService().detectTiles(in: image)
                }.value

                await MainActor.run {
                    isDetecting = false
                    detections = output
                    detectionMessage = nil
                    applyDetectedTiles(output)
                }
            } catch {
                await MainActor.run {
                    isDetecting = false
                    detections = []
                    detectionMessage = friendlyMessage(for: error)
                    Haptics.warning()
                    applyDetectedTiles([])
                }
            }
        }
    }

    @MainActor
    private func processCameraCapture(_ captureResult: CameraCaptureResult) {
        selectedImage = captureResult.handImage
        detections = []
        detectionMessage = nil
        scoreError = nil
        isDetecting = true

        Task {
            let output = await Task.detached(priority: .userInitiated) {
                let service = TileDetectionService()
                let handResult: Result<[TileDetectionService.Detection], Error>
                let doraResult: Result<[TileDetectionService.Detection], Error>

                do {
                    handResult = .success(try service.detectTiles(in: captureResult.handImage))
                } catch {
                    handResult = .failure(error)
                }

                do {
                    doraResult = .success(try service.detectTiles(in: captureResult.doraImage))
                } catch {
                    doraResult = .failure(error)
                }

                return CameraDetectionOutput(handResult: handResult, doraResult: doraResult)
            }.value

            await MainActor.run {
                handleCameraDetectionOutput(output)
            }
        }
    }

    private func handleCameraDetectionOutput(_ output: CameraDetectionOutput) {
        isDetecting = false
        var messages: [String] = []
        var shouldWarn = false

        switch output.handResult {
        case .success(let handDetections):
            detections = handDetections
            applyDetectedTiles(handDetections)
        case .failure(let error):
            detections = []
            applyDetectedTiles([])
            messages.append(friendlyMessage(for: error))
            shouldWarn = true
        }

        switch output.doraResult {
        case .success(let doraDetections):
            let codes = Array(doraDetections.map(\.code).prefix(5))
            if codes.isEmpty {
                messages.append("未识别到宝牌指示牌")
                shouldWarn = true
            } else {
                withAnimation(.spring(response: 0.24, dampingFraction: 0.86)) {
                    doraIndicators = codes.map { DoraIndicatorTile(code: $0) }
                }
            }
        case .failure(let error):
            messages.append("宝牌指示牌识别失败：\(friendlyMessage(for: error))")
            shouldWarn = true
        }

        detectionMessage = messages.isEmpty ? nil : messages.joined(separator: "\n")
        if shouldWarn {
            Haptics.warning()
        }
    }

    private func applyDetectedTiles(_ detections: [TileDetectionService.Detection]) {
        let codes = detections.map(\.code)
        applyTileCodes(codes)
    }

    private func applyTileCodes(_ codes: [String]) {
        let clipped = Array(codes.prefix(14))
        let winningCode = clipped.last
        let sortedCodes = TenpaiCalculator.sortTileCodes(clipped)
        handTiles = sortedCodes.map { EditableScoreTile(code: $0) }
        if let winningCode {
            winningIndex = sortedCodes.lastIndex(of: winningCode) ?? handTiles.indices.last
        } else {
            winningIndex = nil
        }
        cursorIndex = handTiles.count
        editingIndex = nil
    }

    private func loadPrefillIfNeeded() {
        guard !didLoadPrefill else {
            return
        }
        didLoadPrefill = true

        let raw = UserDefaults.standard.string(forKey: "scorePrefill") ?? ""
        let codes = raw
            .split(whereSeparator: { $0 == " " || $0 == "\n" || $0 == "\t" })
            .map(String.init)
        guard !codes.isEmpty else {
            return
        }
        selectedImage = nil
        detections = []
        detectionMessage = nil
        applyTileCodes(codes)
    }

    private func shouldShowInlineDelete(after index: Int) -> Bool {
        guard !handTiles.isEmpty else {
            return false
        }
        let clampedCursor = min(max(cursorIndex, 1), handTiles.count)
        return index == clampedCursor - 1
    }

    private func handleTileKeyboardTap(_ code: String) {
        scoreError = nil
        withAnimation(.spring(response: 0.26, dampingFraction: 0.86)) {
            if let editingIndex, handTiles.indices.contains(editingIndex) {
                handTiles[editingIndex].code = code
                cursorIndex = editingIndex + 1
                self.editingIndex = nil
            } else {
                insertTile(code)
            }
        }
    }

    private func handleKeyboardDelete() {
        withAnimation(.spring(response: 0.26, dampingFraction: 0.86)) {
            if let editingIndex, handTiles.indices.contains(editingIndex) {
                removeTile(at: editingIndex)
            } else {
                deleteBeforeCursor()
            }
        }
    }

    private func insertTile(_ code: String) {
        guard handTiles.count < 14 else {
            return
        }
        let index = min(max(cursorIndex, 0), handTiles.count)
        handTiles.insert(EditableScoreTile(code: code), at: index)
        winningIndex = index
        cursorIndex = index + 1
        editingIndex = nil
    }

    private func deleteBeforeCursor() {
        guard !handTiles.isEmpty else {
            return
        }
        let deleteIndex: Int
        if let editingIndex, handTiles.indices.contains(editingIndex) {
            deleteIndex = editingIndex
        } else {
            deleteIndex = min(max(cursorIndex - 1, 0), handTiles.count - 1)
        }
        removeTile(at: deleteIndex)
    }

    private func removeTile(at index: Int) {
        guard handTiles.indices.contains(index) else {
            return
        }
        handTiles.remove(at: index)
        if handTiles.isEmpty {
            winningIndex = nil
            cursorIndex = 0
            editingIndex = nil
            return
        }
        if let currentWinning = winningIndex {
            if currentWinning == index {
                winningIndex = min(index, handTiles.count - 1)
            } else if currentWinning > index {
                winningIndex = currentWinning - 1
            }
        }
        // 删除后退格键回到队尾（光标默认位），而不是停在删除位
        cursorIndex = handTiles.count
        editingIndex = nil
    }

    private func setWinningIndex(_ index: Int) {
        guard handTiles.indices.contains(index) else {
            return
        }
        Haptics.tap()
        winningIndex = index
        editingIndex = index
        cursorIndex = index + 1
    }

    private func sortHand() {
        Haptics.tap()
        let winningID = winningIndex.flatMap { index in
            handTiles.indices.contains(index) ? handTiles[index].id : nil
        }
        withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
            handTiles.sort { left, right in
                TileSortKey(code: left.code) < TileSortKey(code: right.code)
            }
            if let winningID {
                winningIndex = handTiles.firstIndex { $0.id == winningID }
            }
            cursorIndex = handTiles.count
            editingIndex = nil
        }
    }

    private func clearHand() {
        Haptics.press()
        withAnimation(.spring(response: 0.26, dampingFraction: 0.86)) {
            handTiles = []
            winningIndex = nil
            editingIndex = nil
            cursorIndex = 0
            scoreError = nil
        }
    }

    private func addDora(_ code: String) {
        guard doraIndicators.count < 8 else {
            return
        }
        withAnimation(.spring(response: 0.24, dampingFraction: 0.86)) {
            doraIndicators.append(DoraIndicatorTile(code: code))
        }
    }

    private func removeDora(_ tile: DoraIndicatorTile) {
        Haptics.tap()
        withAnimation(.spring(response: 0.24, dampingFraction: 0.86)) {
            doraIndicators.removeAll { $0.id == tile.id }
        }
    }

    private func calculateScore() {
        Haptics.press()
        scoreError = nil
        let tiles = handTiles.map(\.code)
        guard tiles.count == 14 else {
            scoreError = "请先输入 14 张牌"
            Haptics.warning()
            return
        }
        let resolvedWinningIndex = winningIndex ?? tiles.indices.last
        guard let resolvedWinningIndex, tiles.indices.contains(resolvedWinningIndex) else {
            scoreError = "请先指定和牌张"
            Haptics.warning()
            return
        }

        do {
            try validateTiles(tiles + doraIndicators.map(\.code))
            let input = ScoreHandInput(
                tiles: tiles,
                winningTile: tiles[resolvedWinningIndex],
                winningTileIndex: resolvedWinningIndex,
                mode: mode,
                winType: winType,
                isDealer: isDealer,
                seatWind: isDealer ? .east : seatWind,
                prevalentWind: prevalentWind,
                riichi: riichi,
                doubleRiichi: doubleRiichi,
                ippatsu: ippatsu,
                doraIndicators: doraIndicators.map(\.code),
                honba: honba,
                nukiDora: mode == .threePlayer ? nukiDora : 0
            )
            result = try EngineBridge.shared.scoreHand(input)
        } catch {
            scoreError = friendlyMessage(for: error)
            Haptics.warning()
        }
    }

    private func validateTiles(_ tiles: [String]) throws {
        var counts: [String: Int] = [:]
        for tile in tiles {
            let normalized = try TenpaiCalculator.normalizeTileForCount(tile, mode: mode)
            counts[normalized, default: 0] += 1
            if counts[normalized, default: 0] > 4 {
                throw ScoreCameraError.tooManyCopies(normalized)
            }
        }
    }

    private func friendlyMessage(for error: Error) -> String {
        if let scoreError = error as? ScoreCalculationError {
            return scoreError.localizedDescription
        }
        let message = error.localizedDescription
        if message.contains("Invalid hand") {
            return "牌型没有组成和牌形，请检查 14 张牌与和牌张"
        }
        if message.contains("Invalid tile") || message.contains("牌面包含无效牌") {
            return "牌面里有无效牌，请检查输入"
        }
        if message.contains("三麻不使用") {
            return message
        }
        if message.isEmpty {
            return "算点失败，请检查牌面与场况"
        }
        return message
    }
}

private struct DetectionPreview: View {
    let image: UIImage
    let detections: [TileDetectionService.Detection]

    var body: some View {
        GeometryReader { geometry in
            let fittedRect = aspectFitRect(imageSize: image.size, containerSize: geometry.size)

            ZStack(alignment: .topLeading) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .background(Color.black.opacity(0.08))

                ForEach(detections) { detection in
                    let rect = overlayRect(for: detection.boundingBox, fittedRect: fittedRect)
                    detectionBox(detection, rect: rect)
                }
            }
        }
    }

    private func detectionBox(_ detection: TileDetectionService.Detection, rect: CGRect) -> some View {
        let color = detection.confidence < 0.6 ? Color.amber : Color.feltBright

        return ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .stroke(color, lineWidth: 2)
                .frame(width: max(12, rect.width), height: max(12, rect.height))
                .position(x: rect.midX, y: rect.midY)

            Text(detection.code)
                .font(.system(.caption2, design: .rounded).weight(.bold))
                .monospacedDigit()
                .foregroundStyle(Color.ivory)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(color, in: Capsule())
                .position(x: rect.minX + 16, y: rect.minY + 10)
        }
    }

    private func overlayRect(for boundingBox: CGRect, fittedRect: CGRect) -> CGRect {
        CGRect(
            x: fittedRect.minX + boundingBox.minX * fittedRect.width,
            y: fittedRect.minY + boundingBox.minY * fittedRect.height,
            width: boundingBox.width * fittedRect.width,
            height: boundingBox.height * fittedRect.height
        )
    }

    private func aspectFitRect(imageSize: CGSize, containerSize: CGSize) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0, containerSize.width > 0, containerSize.height > 0 else {
            return CGRect(origin: .zero, size: containerSize)
        }
        let imageAspect = imageSize.width / imageSize.height
        let containerAspect = containerSize.width / containerSize.height

        if imageAspect > containerAspect {
            let width = containerSize.width
            let height = width / imageAspect
            return CGRect(x: 0, y: (containerSize.height - height) / 2, width: width, height: height)
        }

        let height = containerSize.height
        let width = height * imageAspect
        return CGRect(x: (containerSize.width - width) / 2, y: 0, width: width, height: height)
    }
}

private struct CameraDetectionOutput {
    let handResult: Result<[TileDetectionService.Detection], Error>
    let doraResult: Result<[TileDetectionService.Detection], Error>
}

private struct EditableScoreTile: Identifiable, Equatable {
    let id = UUID()
    var code: String
}

private struct DoraIndicatorTile: Identifiable, Equatable {
    let id = UUID()
    var code: String
}

private struct TileSortKey: Comparable {
    let suitOrder: Int
    let rank: Double
    let raw: String

    init(code: String) {
        raw = code
        let characters = Array(code)
        if characters.count == 2, let rawRank = characters[0].wholeNumberValue {
            let suit = String(characters[1])
            suitOrder = ["m": 0, "p": 1, "s": 2, "z": 3][suit] ?? 99
            rank = rawRank == 0 ? 5.5 : Double(rawRank)
        } else {
            suitOrder = 99
            rank = 99
        }
    }

    static func < (left: TileSortKey, right: TileSortKey) -> Bool {
        if left.suitOrder != right.suitOrder {
            return left.suitOrder < right.suitOrder
        }
        if left.rank != right.rank {
            return left.rank < right.rank
        }
        return left.raw < right.raw
    }
}

private enum ScoreCameraError: LocalizedError {
    case tooManyCopies(String)

    var errorDescription: String? {
        switch self {
        case .tooManyCopies(let tile):
            return "\(tile) 已超过 4 枚"
        }
    }
}
