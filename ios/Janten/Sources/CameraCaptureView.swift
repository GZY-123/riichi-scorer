import AVFoundation
import ObjectiveC
import SwiftUI
import UIKit

struct CameraCaptureResult {
    let handImage: UIImage
    let doraImage: UIImage
}

struct CameraCaptureView: UIViewControllerRepresentable {
    let onCapture: (CameraCaptureResult) -> Void

    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context _: Context) -> CameraCapturePresenterViewController {
        CameraCapturePresenterViewController(
            onCapture: { result in
                onCapture(result)
                dismiss()
            },
            onCancel: {
                dismiss()
            }
        )
    }

    func updateUIViewController(_ uiViewController: CameraCapturePresenterViewController, context _: Context) {
        uiViewController.update(
            onCapture: { result in
                onCapture(result)
                dismiss()
            },
            onCancel: {
                dismiss()
            }
        )
    }

    static func dismantleUIViewController(_ uiViewController: CameraCapturePresenterViewController, coordinator _: ()) {
        uiViewController.restorePortraitOrientation()
    }
}

final class CameraCapturePresenterViewController: UIViewController {
    private var onCapture: (CameraCaptureResult) -> Void
    private var onCancel: () -> Void
    private var hasPresentedCamera = false
    private var isFinishing = false

    init(
        onCapture: @escaping (CameraCaptureResult) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.onCapture = onCapture
        self.onCancel = onCancel
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    @MainActor
    required dynamic init?(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var prefersStatusBarHidden: Bool {
        true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        restorePortraitOrientation()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        presentCameraIfNeeded()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        restorePortraitOrientation()
    }

    func update(
        onCapture: @escaping (CameraCaptureResult) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.onCapture = onCapture
        self.onCancel = onCancel
    }

    func restorePortraitOrientation() {
        CameraCaptureOrientation.request(.portrait, from: self)
    }

    private func presentCameraIfNeeded() {
        guard !hasPresentedCamera, !isFinishing else {
            return
        }

        hasPresentedCamera = true
        let content = CameraCaptureContent(
            onCapture: { [weak self] result in
                self?.finish(with: result)
            },
            onCancel: { [weak self] in
                self?.cancel()
            }
        )
        let controller = LandscapeCameraHostingController(rootView: content)
        controller.modalPresentationStyle = .fullScreen
        controller.modalTransitionStyle = .crossDissolve
        present(controller, animated: false) {
            controller.requestLandscapeOrientation()
        }
    }

    private func finish(with result: CameraCaptureResult) {
        guard !isFinishing else {
            return
        }

        isFinishing = true
        restorePortraitOrientation()
        guard let presentedViewController else {
            onCapture(result)
            return
        }
        presentedViewController.dismiss(animated: false) { [weak self] in
            guard let self else {
                return
            }
            self.onCapture(result)
        }
    }

    private func cancel() {
        guard !isFinishing else {
            return
        }

        isFinishing = true
        restorePortraitOrientation()
        guard let presentedViewController else {
            onCancel()
            return
        }
        presentedViewController.dismiss(animated: false) { [weak self] in
            guard let self else {
                return
            }
            self.onCancel()
        }
    }
}

private final class LandscapeCameraHostingController: UIHostingController<CameraCaptureContent> {
    override init(rootView: CameraCaptureContent) {
        super.init(rootView: rootView)
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .landscapeRight
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .landscapeRight
    }

    override var shouldAutorotate: Bool {
        true
    }

    override var prefersStatusBarHidden: Bool {
        true
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        requestLandscapeOrientation()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        requestLandscapeOrientation()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        CameraCaptureOrientation.request(.portrait, from: self)
    }

    func requestLandscapeOrientation() {
        CameraCaptureOrientation.request(.landscapeRight, from: self)
    }

    @MainActor
    required dynamic init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
    }
}

enum CameraCaptureOrientation {
    private static var supportedOrientations: UIInterfaceOrientationMask = .portrait
    private static var didInstallLock = false

    static func installLockIfNeeded() {
        guard !didInstallLock, let delegate = UIApplication.shared.delegate else {
            return
        }

        didInstallLock = true
        let selector = NSSelectorFromString("application:supportedInterfaceOrientationsForWindow:")
        guard let method = class_getInstanceMethod(CameraOrientationDelegateProxy.self, selector) else {
            return
        }

        class_replaceMethod(
            type(of: delegate),
            selector,
            method_getImplementation(method),
            method_getTypeEncoding(method)
        )
    }

    static func request(_ orientations: UIInterfaceOrientationMask, from viewController: UIViewController) {
        installLockIfNeeded()
        supportedOrientations = orientations
        viewController.setNeedsUpdateOfSupportedInterfaceOrientations()
        viewController.navigationController?.setNeedsUpdateOfSupportedInterfaceOrientations()

        guard let windowScene = viewController.view.window?.windowScene else {
            return
        }

        windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: orientations)) { error in
            #if DEBUG
            print("Camera orientation update failed: \(error.localizedDescription)")
            #endif
        }
    }
}

private final class CameraOrientationDelegateProxy: NSObject {
    @objc(application:supportedInterfaceOrientationsForWindow:)
    func application(_: UIApplication, supportedInterfaceOrientationsFor _: UIWindow?) -> UIInterfaceOrientationMask {
        CameraCaptureOrientation.currentSupportedOrientations
    }
}

extension CameraCaptureOrientation {
    static var currentSupportedOrientations: UIInterfaceOrientationMask {
        supportedOrientations
    }
}

private struct CameraCaptureContent: View {
    let onCapture: (CameraCaptureResult) -> Void
    let onCancel: () -> Void

    @StateObject private var camera = CameraCaptureController()

    var body: some View {
        GeometryReader { proxy in
            let frames = guideFrames(in: proxy.size)

            ZStack {
                CameraPreview(session: camera.session) { layer in
                    camera.attachPreviewLayer(layer)
                }

                CameraGuideMask(handFrame: frames.hand, doraFrame: frames.dora)
                    .fill(Color.black.opacity(0.52), style: FillStyle(eoFill: true))

                CameraGuideFrame(frame: frames.hand, label: "手牌", labelPosition: .topLeading)
                CameraGuideFrame(frame: frames.dora, label: "宝牌指示牌", labelPosition: .topTrailing)

                cameraControls(in: proxy, frames: frames)

                if let errorMessage = camera.errorMessage {
                    cameraMessage(errorMessage, topInset: proxy.safeAreaInsets.top)
                }
            }
            .background(Color.black)
        }
        .ignoresSafeArea()
        .onAppear {
            camera.startSession()
        }
        .onDisappear {
            camera.stopSession()
        }
    }

    private func cameraControls(in proxy: GeometryProxy, frames: CameraGuideFrames) -> some View {
        let shutterCenterX = proxy.size.width - max(proxy.safeAreaInsets.trailing, 14) - 54
        let shutterCenterY = proxy.size.height / 2
        let closeCenterX = max(proxy.safeAreaInsets.leading, 14) + 26
        let closeCenterY = max(proxy.safeAreaInsets.top, 12) + 26

        return ZStack {
            Button {
                Haptics.tap()
                camera.stopSession()
                onCancel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white)
                    .frame(width: 52, height: 52)
                    .background(Color.black.opacity(0.42), in: Circle())
                    .overlay(Circle().stroke(Color.white.opacity(0.28), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("关闭相机")
            .position(x: closeCenterX, y: closeCenterY)

            Button {
                Haptics.press()
                camera.capture(handFrame: frames.hand, doraFrame: frames.dora) { result in
                    switch result {
                    case .success(let captureResult):
                        onCapture(captureResult)
                    case .failure(let error):
                        Haptics.warning()
                        camera.showError(error.localizedDescription)
                    }
                }
            } label: {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(camera.isCapturing ? 0.72 : 0.96))
                        .frame(width: 74, height: 74)
                    Circle()
                        .stroke(Color.white.opacity(0.86), lineWidth: 5)
                        .frame(width: 88, height: 88)
                    if camera.isCapturing {
                        ProgressView()
                            .tint(Color.black.opacity(0.7))
                    }
                }
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(camera.isCapturing)
            .accessibilityLabel("拍摄")
            .position(x: shutterCenterX, y: shutterCenterY)
        }
    }

    private func cameraMessage(_ message: String, topInset: CGFloat) -> some View {
        VStack {
            Text(message)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.ivory)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.black.opacity(0.66), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.18), lineWidth: 1)
                )
                .padding(.top, topInset + 18)
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private func guideFrames(in size: CGSize) -> CameraGuideFrames {
        let leadingMargin = max(size.width * 0.035, 24)
        let rightControlReserve = max(size.width * 0.13, 112)
        let handWidth = min(size.width * 0.78, size.width - leadingMargin - rightControlReserve)
        let handHeight = size.height * 0.42
        let handXUpperBound = max(leadingMargin, size.width - rightControlReserve - handWidth)
        let handX = Self.clamped(
            size.width * 0.45 - handWidth / 2,
            lowerBound: leadingMargin,
            upperBound: handXUpperBound
        )
        let handCenterY = size.height * 0.62
        let handFrame = CGRect(
            x: handX,
            y: handCenterY - handHeight / 2,
            width: handWidth,
            height: handHeight
        )

        let doraWidth = size.width * 0.26
        let doraHeight = size.height * 0.22
        let doraRightMargin = max(size.width * 0.08, 88)
        let doraX = min(size.width * 0.64, size.width - doraRightMargin - doraWidth)
        let doraFrame = CGRect(
            x: max(leadingMargin, doraX),
            y: max(size.height * 0.12, 38),
            width: doraWidth,
            height: doraHeight
        )

        return CameraGuideFrames(hand: handFrame, dora: doraFrame)
    }

    private static func clamped(_ value: CGFloat, lowerBound: CGFloat, upperBound: CGFloat) -> CGFloat {
        min(max(value, lowerBound), upperBound)
    }
}

private struct CameraGuideFrames {
    let hand: CGRect
    let dora: CGRect
}

private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    let onLayerReady: (AVCaptureVideoPreviewLayer) -> Void

    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        onLayerReady(view.previewLayer)
        return view
    }

    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {
        uiView.previewLayer.session = session
        uiView.previewLayer.videoGravity = .resizeAspectFill
        uiView.updateVideoOrientation()
        onLayerReady(uiView.previewLayer)
    }
}

private final class CameraPreviewUIView: UIView {
    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }

    var previewLayer: AVCaptureVideoPreviewLayer {
        layer as! AVCaptureVideoPreviewLayer
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateVideoOrientation()
    }

    func updateVideoOrientation() {
        previewLayer.connection?.applyLandscapeRightRotation()
    }
}

private struct CameraGuideMask: Shape {
    let handFrame: CGRect
    let doraFrame: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRect(rect)
        path.addRoundedRect(in: handFrame, cornerSize: CGSize(width: 18, height: 18), style: .continuous)
        path.addRoundedRect(in: doraFrame, cornerSize: CGSize(width: 14, height: 14), style: .continuous)
        return path
    }
}

private struct CameraGuideFrame: View {
    enum LabelPosition {
        case topLeading
        case topTrailing
    }

    let frame: CGRect
    let label: String
    let labelPosition: LabelPosition

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: labelPosition == .topLeading ? 18 : 14, style: .continuous)
                .stroke(Color.white.opacity(0.88), lineWidth: 1.4)
                .frame(width: frame.width, height: frame.height)
                .position(x: frame.midX, y: frame.midY)

            CameraFrameCorners(rect: frame)
                .stroke(Color.white, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))

            guideLabel
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var guideLabel: some View {
        switch labelPosition {
        case .topLeading:
            Text(label)
                .font(.system(.caption, design: .rounded).weight(.bold))
                .foregroundStyle(Color.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.black.opacity(0.44), in: Capsule())
                .position(x: frame.minX + 34, y: frame.minY - 12)
        case .topTrailing:
            Text(label)
                .font(.system(.caption, design: .rounded).weight(.bold))
                .foregroundStyle(Color.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.black.opacity(0.44), in: Capsule())
                .position(x: frame.maxX - 48, y: frame.minY - 12)
        }
    }
}

private struct CameraFrameCorners: Shape {
    let rect: CGRect

    func path(in _: CGRect) -> Path {
        let length = min(rect.width, rect.height) * 0.22
        var path = Path()

        path.move(to: CGPoint(x: rect.minX, y: rect.minY + length))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX + length, y: rect.minY))

        path.move(to: CGPoint(x: rect.maxX - length, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + length))

        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - length))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX - length, y: rect.maxY))

        path.move(to: CGPoint(x: rect.minX + length, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - length))

        return path
    }
}

private final class CameraCaptureController: NSObject, ObservableObject {
    let session = AVCaptureSession()

    @Published var errorMessage: String?
    @Published var isCapturing = false

    private let sessionQueue = DispatchQueue(label: "Janten.CameraCapture.Session")
    private let photoOutput = AVCapturePhotoOutput()
    private var isConfigured = false
    private weak var previewLayer: AVCaptureVideoPreviewLayer?
    private var activePhotoDelegate: PhotoCaptureDelegate?

    deinit {
        let session = session
        let sessionQueue = sessionQueue
        sessionQueue.async {
            if session.isRunning {
                session.stopRunning()
            }
        }
    }

    func attachPreviewLayer(_ layer: AVCaptureVideoPreviewLayer) {
        previewLayer = layer
    }

    func startSession() {
        sessionQueue.async { [weak self] in
            guard let self else {
                return
            }
            guard self.configureSessionIfNeeded() else {
                return
            }
            if !self.session.isRunning {
                self.session.startRunning()
            }
        }
    }

    func stopSession() {
        sessionQueue.async { [weak self] in
            guard let self else {
                return
            }
            if self.session.isRunning {
                self.session.stopRunning()
            }
        }
    }

    func capture(
        handFrame: CGRect,
        doraFrame: CGRect,
        completion: @escaping (Result<CameraCaptureResult, Error>) -> Void
    ) {
        guard !isCapturing else {
            return
        }
        guard let previewLayer else {
            completion(.failure(CameraCaptureError.previewUnavailable))
            return
        }

        let handRect = Self.clampedMetadataRect(previewLayer.metadataOutputRectConverted(fromLayerRect: handFrame))
        let doraRect = Self.clampedMetadataRect(previewLayer.metadataOutputRectConverted(fromLayerRect: doraFrame))

        errorMessage = nil
        isCapturing = true

        sessionQueue.async { [weak self] in
            guard let self else {
                return
            }
            guard self.isConfigured, self.session.isRunning else {
                DispatchQueue.main.async {
                    self.isCapturing = false
                    completion(.failure(CameraCaptureError.sessionNotReady))
                }
                return
            }

            self.photoOutput.connection(with: .video)?.applyLandscapeRightRotation()

            let settings = AVCapturePhotoSettings()
            settings.photoQualityPrioritization = .quality

            let delegate = PhotoCaptureDelegate(
                handMetadataRect: handRect,
                doraMetadataRect: doraRect
            ) { [weak self] result in
                DispatchQueue.main.async {
                    self?.isCapturing = false
                    self?.activePhotoDelegate = nil
                    completion(result)
                }
            }

            self.activePhotoDelegate = delegate
            self.photoOutput.capturePhoto(with: settings, delegate: delegate)
        }
    }

    func showError(_ message: String) {
        errorMessage = message
    }

    private func configureSessionIfNeeded() -> Bool {
        if isConfigured {
            return true
        }

        session.beginConfiguration()
        defer {
            session.commitConfiguration()
        }

        session.sessionPreset = .photo

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            publishError("当前设备不可用相机")
            return false
        }

        do {
            let input = try AVCaptureDeviceInput(device: device)
            guard session.canAddInput(input) else {
                publishError("相机输入不可用")
                return false
            }
            session.addInput(input)
        } catch {
            publishError(error.localizedDescription)
            return false
        }

        guard session.canAddOutput(photoOutput) else {
            publishError("相机输出不可用")
            return false
        }

        session.addOutput(photoOutput)
        photoOutput.maxPhotoQualityPrioritization = .quality
        isConfigured = true
        publishError(nil)
        return true
    }

    private func publishError(_ message: String?) {
        DispatchQueue.main.async { [weak self] in
            self?.errorMessage = message
        }
    }

    private static func clampedMetadataRect(_ rect: CGRect) -> CGRect {
        let standardized = rect.standardized
        let bounds = CGRect(x: 0, y: 0, width: 1, height: 1)
        return standardized.intersection(bounds)
    }
}

private final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let handMetadataRect: CGRect
    private let doraMetadataRect: CGRect
    private let completion: (Result<CameraCaptureResult, Error>) -> Void

    init(
        handMetadataRect: CGRect,
        doraMetadataRect: CGRect,
        completion: @escaping (Result<CameraCaptureResult, Error>) -> Void
    ) {
        self.handMetadataRect = handMetadataRect
        self.doraMetadataRect = doraMetadataRect
        self.completion = completion
    }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        if let error {
            completion(.failure(error))
            return
        }

        guard let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data)?.normalizedForCameraCrop else {
            completion(.failure(CameraCaptureError.imageUnavailable))
            return
        }

        guard let handImage = image.cropped(toNormalizedImageRect: handMetadataRect),
              let doraImage = image.cropped(toNormalizedImageRect: doraMetadataRect) else {
            completion(.failure(CameraCaptureError.cropFailed))
            return
        }

        completion(.success(CameraCaptureResult(handImage: handImage, doraImage: doraImage)))
    }
}

private enum CameraCaptureError: LocalizedError {
    case previewUnavailable
    case sessionNotReady
    case imageUnavailable
    case cropFailed

    var errorDescription: String? {
        switch self {
        case .previewUnavailable:
            return "相机预览尚未准备好"
        case .sessionNotReady:
            return "相机尚未启动，请稍后重试"
        case .imageUnavailable:
            return "照片无法读取，请重拍"
        case .cropFailed:
            return "照片裁切失败，请重拍"
        }
    }
}

private extension AVCaptureConnection {
    func applyLandscapeRightRotation() {
        let landscapeRightAngle: CGFloat = 0
        guard isVideoRotationAngleSupported(landscapeRightAngle) else {
            return
        }
        videoRotationAngle = landscapeRightAngle
    }
}

private extension UIImage {
    var normalizedForCameraCrop: UIImage {
        guard imageOrientation != .up else {
            return self
        }

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = scale
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }

    func cropped(toNormalizedImageRect rect: CGRect) -> UIImage? {
        guard let cgImage else {
            return nil
        }

        let bounds = CGRect(x: 0, y: 0, width: 1, height: 1)
        let normalizedRect = rect.standardized.intersection(bounds)
        guard normalizedRect.width > 0, normalizedRect.height > 0 else {
            return nil
        }

        let imageSize = CGSize(width: cgImage.width, height: cgImage.height)
        let cropRect = CGRect(
            x: normalizedRect.minX * imageSize.width,
            y: normalizedRect.minY * imageSize.height,
            width: normalizedRect.width * imageSize.width,
            height: normalizedRect.height * imageSize.height
        )
        .integral
        .intersection(CGRect(origin: .zero, size: imageSize))

        guard let cropped = cgImage.cropping(to: cropRect) else {
            return nil
        }

        return UIImage(cgImage: cropped, scale: scale, orientation: .up).ensuringLandscapeUpOrientation()
    }

    private func ensuringLandscapeUpOrientation() -> UIImage {
        guard size.height > size.width else {
            return self
        }

        let rotatedSize = CGSize(width: size.height, height: size.width)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = scale
        let renderer = UIGraphicsImageRenderer(size: rotatedSize, format: format)
        return renderer.image { context in
            context.cgContext.translateBy(x: rotatedSize.width, y: 0)
            context.cgContext.rotate(by: .pi / 2)
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
