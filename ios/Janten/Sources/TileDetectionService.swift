import CoreML
import Foundation
import ImageIO
import UIKit
import Vision

final class TileDetectionService {
    struct Detection: Identifiable, Equatable {
        let id = UUID()
        let code: String
        let confidence: Double
        /// Normalized, top-left-origin image coordinates.
        let boundingBox: CGRect
    }

    private struct DetectionRow {
        var centerY: CGFloat
        var count: Int
        var items: [Detection]
    }

    private struct Letterbox {
        let originalWidth: Double
        let originalHeight: Double
        let scale: Double
        let padX: Double
        let padY: Double
    }

    private struct Candidate {
        let detection: Detection
        let classIndex: Int
        let x1: Double
        let y1: Double
        let x2: Double
        let y2: Double
    }

    private struct MultiArrayReader {
        let pointer: UnsafePointer<Float>
        let rowStride: Int
        let anchorStride: Int

        func value(row: Int, anchor: Int) -> Double {
            Double(pointer[row * rowStride + anchor * anchorStride])
        }
    }

    private let confidenceThreshold: Double = 0.45
    private let nmsThreshold: Double = 0.45
    private static let modelInputSize = 960.0
    private static let boxRowCount = 4
    private static let maskCoefficientCount = 32
    private static let anchorCount = 18_900
    private static let primaryOutputFeatureName = "var_1327"
    private static var cachedVisionModel: VNCoreMLModel?

    func detectTiles(in image: UIImage) throws -> [Detection] {
        guard let cgImage = image.cgImage else {
            throw TileDetectionError.invalidImage
        }

        let visionModel = try Self.loadVisionModel()
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        let imageSize = Self.orientedImageSize(for: cgImage, orientation: orientation)
        let letterbox = try Self.makeLetterbox(for: imageSize)

        var capturedDetections: [Detection] = []
        var capturedError: Error?
        let request = VNCoreMLRequest(model: visionModel) { [confidenceThreshold, nmsThreshold] request, error in
            if let error {
                capturedError = error
                return
            }

            guard let observations = request.results as? [VNCoreMLFeatureValueObservation],
                  let output = observations.first(where: { $0.featureName == Self.primaryOutputFeatureName })?
                    .featureValue.multiArrayValue else {
                capturedError = TileDetectionError.missingOutput(Self.primaryOutputFeatureName)
                return
            }

            do {
                capturedDetections = try Self.decodeDetections(
                    from: output,
                    letterbox: letterbox,
                    confidenceThreshold: confidenceThreshold,
                    nmsThreshold: nmsThreshold
                )
            } catch {
                capturedError = error
            }
        }
        request.imageCropAndScaleOption = .scaleFit

        let handler = VNImageRequestHandler(
            cgImage: cgImage,
            orientation: orientation,
            options: [:]
        )
        try handler.perform([request])
        if let capturedError {
            throw capturedError
        }
        return Self.trimOverLimitDetections(Self.clusterRows(capturedDetections))
    }

    private static func loadVisionModel() throws -> VNCoreMLModel {
        if let cachedVisionModel {
            return cachedVisionModel
        }

        guard let sourceURL = Bundle.main.url(forResource: "TileDetector", withExtension: "mlpackage") else {
            throw TileDetectionError.modelUnavailable
        }

        let compiledURL = try MLModel.compileModel(at: sourceURL)
        let configuration = MLModelConfiguration()
        // v31seg 在 GPU(MPSGraph) 上触发 MLIR 编译断言崩溃，强制 CPU+神经引擎绕开
        configuration.computeUnits = .cpuAndNeuralEngine
        let model = try MLModel(contentsOf: compiledURL, configuration: configuration)
        let visionModel = try VNCoreMLModel(for: model)
        cachedVisionModel = visionModel
        return visionModel
    }

    private static func clusterRows(_ detections: [Detection]) -> [Detection] {
        guard !detections.isEmpty else {
            return []
        }

        let averageHeight = detections.reduce(CGFloat.zero) { partial, detection in
            partial + max(0, detection.boundingBox.height)
        } / CGFloat(detections.count)
        let threshold = averageHeight * 0.6
        var rows: [DetectionRow] = []

        for detection in detections.sorted(by: { $0.boundingBox.midY < $1.boundingBox.midY }) {
            if let rowIndex = closestRowIndex(in: rows, centerY: detection.boundingBox.midY, threshold: threshold) {
                rows[rowIndex].items.append(detection)
                rows[rowIndex].centerY = (rows[rowIndex].centerY * CGFloat(rows[rowIndex].count) + detection.boundingBox.midY)
                    / CGFloat(rows[rowIndex].count + 1)
                rows[rowIndex].count += 1
            } else {
                rows.append(DetectionRow(centerY: detection.boundingBox.midY, count: 1, items: [detection]))
            }
        }

        return rows
            .sorted(by: { $0.centerY < $1.centerY })
            .flatMap { row in
                row.items.sorted(by: { $0.boundingBox.midX < $1.boundingBox.midX })
            }
    }

    private static func closestRowIndex(in rows: [DetectionRow], centerY: CGFloat, threshold: CGFloat) -> Int? {
        var closestIndex: Int?
        var closestDistance = CGFloat.greatestFiniteMagnitude
        for index in rows.indices {
            let distance = abs(rows[index].centerY - centerY)
            if distance < threshold && distance < closestDistance {
                closestIndex = index
                closestDistance = distance
            }
        }
        return closestIndex
    }

    private static func trimOverLimitDetections(_ detections: [Detection]) -> [Detection] {
        var counts: [String: Int] = [:]
        var trimmed: [Detection] = []
        for detection in detections {
            let key = countKey(for: detection.code)
            guard counts[key, default: 0] < 4 else {
                continue
            }
            counts[key, default: 0] += 1
            trimmed.append(detection)
        }
        return trimmed
    }

    private static func countKey(for code: String) -> String {
        guard code.count == 2 else {
            return code
        }
        let characters = Array(code)
        if characters[0] == "0", ["m", "p", "s"].contains(String(characters[1])) {
            return "5\(characters[1])"
        }
        return code
    }

    private static func decodeDetections(
        from output: MLMultiArray,
        letterbox: Letterbox,
        confidenceThreshold: Double,
        nmsThreshold: Double
    ) throws -> [Detection] {
        let reader = try makeReader(for: output)
        let candidates = makeCandidates(
            reader: reader,
            letterbox: letterbox,
            confidenceThreshold: confidenceThreshold
        )
        return nonMaxSuppression(candidates, threshold: nmsThreshold).map(\.detection)
    }

    private static func makeReader(for output: MLMultiArray) throws -> MultiArrayReader {
        guard output.dataType == .float32 else {
            throw TileDetectionError.unsupportedOutputType(String(describing: output.dataType))
        }

        let shape = output.shape.map(\.intValue)
        let expectedRows = boxRowCount + yoloTileClasses.count + maskCoefficientCount
        guard shape.count == 3,
              shape[0] == 1,
              shape[1] == expectedRows,
              shape[2] == anchorCount else {
            throw TileDetectionError.invalidOutputShape(shape)
        }

        let strides = output.strides.map(\.intValue)
        guard strides.count == 3 else {
            throw TileDetectionError.invalidOutputShape(shape)
        }

        return MultiArrayReader(
            pointer: output.dataPointer.assumingMemoryBound(to: Float.self),
            rowStride: strides[1],
            anchorStride: strides[2]
        )
    }

    private static func makeCandidates(
        reader: MultiArrayReader,
        letterbox: Letterbox,
        confidenceThreshold: Double
    ) -> [Candidate] {
        var candidates: [Candidate] = []
        candidates.reserveCapacity(64)

        for anchor in 0..<anchorCount {
            let bestClass = maxClassScore(reader: reader, anchor: anchor)
            guard bestClass.score >= confidenceThreshold else {
                continue
            }

            let code = yoloTileClasses[bestClass.index]
            guard code != "0z" else {
                continue
            }

            guard let candidate = restoreCandidate(
                cx: reader.value(row: 0, anchor: anchor),
                cy: reader.value(row: 1, anchor: anchor),
                width: reader.value(row: 2, anchor: anchor),
                height: reader.value(row: 3, anchor: anchor),
                classIndex: bestClass.index,
                code: code,
                confidence: bestClass.score,
                letterbox: letterbox
            ) else {
                continue
            }

            candidates.append(candidate)
        }

        return candidates
    }

    private static func maxClassScore(reader: MultiArrayReader, anchor: Int) -> (index: Int, score: Double) {
        var bestIndex = 0
        var bestScore = -Double.infinity

        for classIndex in yoloTileClasses.indices {
            let score = reader.value(row: boxRowCount + classIndex, anchor: anchor)
            if score > bestScore {
                bestScore = score
                bestIndex = classIndex
            }
        }

        return (bestIndex, bestScore)
    }

    private static func restoreCandidate(
        cx: Double,
        cy: Double,
        width: Double,
        height: Double,
        classIndex: Int,
        code: String,
        confidence: Double,
        letterbox: Letterbox
    ) -> Candidate? {
        guard [cx, cy, width, height, confidence].allSatisfy(\.isFinite),
              width > 0,
              height > 0,
              letterbox.scale > 0 else {
            return nil
        }

        let left = (cx - width / 2.0 - letterbox.padX) / letterbox.scale
        let top = (cy - height / 2.0 - letterbox.padY) / letterbox.scale
        let right = (cx + width / 2.0 - letterbox.padX) / letterbox.scale
        let bottom = (cy + height / 2.0 - letterbox.padY) / letterbox.scale
        let x1 = clamp(left, min: 0, max: letterbox.originalWidth)
        let y1 = clamp(top, min: 0, max: letterbox.originalHeight)
        let x2 = clamp(right, min: 0, max: letterbox.originalWidth)
        let y2 = clamp(bottom, min: 0, max: letterbox.originalHeight)
        let boxWidth = x2 - x1
        let boxHeight = y2 - y1

        guard boxWidth > 0, boxHeight > 0 else {
            return nil
        }

        return Candidate(
            detection: Detection(
                code: code,
                confidence: clamp(confidence, min: 0, max: 1),
                boundingBox: CGRect(
                    x: x1 / letterbox.originalWidth,
                    y: y1 / letterbox.originalHeight,
                    width: boxWidth / letterbox.originalWidth,
                    height: boxHeight / letterbox.originalHeight
                ).standardized
            ),
            classIndex: classIndex,
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2
        )
    }

    private static func nonMaxSuppression(_ candidates: [Candidate], threshold: Double) -> [Candidate] {
        let grouped = Dictionary(grouping: candidates, by: \.classIndex)
        var kept: [Candidate] = []

        for classIndex in grouped.keys.sorted() {
            guard let group = grouped[classIndex] else {
                continue
            }
            var classKept: [Candidate] = []
            for candidate in group.sorted(by: { $0.detection.confidence > $1.detection.confidence }) {
                if classKept.allSatisfy({ calculateIoU(candidate, $0) <= threshold }) {
                    classKept.append(candidate)
                }
            }
            kept.append(contentsOf: classKept)
        }

        return kept
    }

    private static func calculateIoU(_ left: Candidate, _ right: Candidate) -> Double {
        let x1 = max(left.x1, right.x1)
        let y1 = max(left.y1, right.y1)
        let x2 = min(left.x2, right.x2)
        let y2 = min(left.y2, right.y2)
        let intersection = max(0, x2 - x1) * max(0, y2 - y1)
        guard intersection > 0 else {
            return 0
        }

        let leftArea = (left.x2 - left.x1) * (left.y2 - left.y1)
        let rightArea = (right.x2 - right.x1) * (right.y2 - right.y1)
        return intersection / (leftArea + rightArea - intersection)
    }

    private static func makeLetterbox(for imageSize: CGSize) throws -> Letterbox {
        let originalWidth = Double(imageSize.width)
        let originalHeight = Double(imageSize.height)
        guard originalWidth > 0, originalHeight > 0 else {
            throw TileDetectionError.invalidImage
        }

        let scale = min(modelInputSize / originalWidth, modelInputSize / originalHeight)
        return Letterbox(
            originalWidth: originalWidth,
            originalHeight: originalHeight,
            scale: scale,
            padX: (modelInputSize - originalWidth * scale) / 2.0,
            padY: (modelInputSize - originalHeight * scale) / 2.0
        )
    }

    private static func orientedImageSize(for cgImage: CGImage, orientation: CGImagePropertyOrientation) -> CGSize {
        switch orientation {
        case .left, .leftMirrored, .right, .rightMirrored:
            return CGSize(width: cgImage.height, height: cgImage.width)
        default:
            return CGSize(width: cgImage.width, height: cgImage.height)
        }
    }

    private static func clamp(_ value: Double, min: Double, max: Double) -> Double {
        Swift.max(min, Swift.min(max, value))
    }

    private static let yoloTileClasses = [
        "0m", "0p", "0s", "0z",
        "1m", "1p", "1s", "1z",
        "2m", "2p", "2s", "2z",
        "3m", "3p", "3s", "3z",
        "4m", "4p", "4s", "4z",
        "5m", "5p", "5s", "5z",
        "6m", "6p", "6s", "6z",
        "7m", "7p", "7s", "7z",
        "8m", "8p", "8s",
        "9m", "9p", "9s"
    ]
}

enum TileDetectionError: LocalizedError {
    case invalidImage
    case modelUnavailable
    case missingOutput(String)
    case invalidOutputShape([Int])
    case unsupportedOutputType(String)

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "图片无法读取，请换一张照片"
        case .modelUnavailable:
            return "本地识别模型不可用"
        case .missingOutput(let name):
            return "识别模型缺少输出：\(name)"
        case .invalidOutputShape(let shape):
            return "识别模型输出尺寸异常：[\(shape.map(String.init).joined(separator: ","))]"
        case .unsupportedOutputType(let type):
            return "识别模型输出格式异常：\(type)"
        }
    }
}

private extension CGImagePropertyOrientation {
    init(_ uiOrientation: UIImage.Orientation) {
        switch uiOrientation {
        case .up:
            self = .up
        case .down:
            self = .down
        case .left:
            self = .left
        case .right:
            self = .right
        case .upMirrored:
            self = .upMirrored
        case .downMirrored:
            self = .downMirrored
        case .leftMirrored:
            self = .leftMirrored
        case .rightMirrored:
            self = .rightMirrored
        @unknown default:
            self = .up
        }
    }
}
