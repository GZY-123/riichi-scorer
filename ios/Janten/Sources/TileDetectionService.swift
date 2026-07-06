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

    private let confidenceThreshold: Double = 0.45
    private static var cachedVisionModel: VNCoreMLModel?

    func detectTiles(in image: UIImage) throws -> [Detection] {
        guard let cgImage = image.cgImage else {
            throw TileDetectionError.invalidImage
        }

        let visionModel = try Self.loadVisionModel()

        var capturedDetections: [Detection] = []
        var capturedError: Error?
        let request = VNCoreMLRequest(model: visionModel) { [confidenceThreshold] request, error in
            if let error {
                capturedError = error
                return
            }

            guard let observations = request.results as? [VNRecognizedObjectObservation] else {
                capturedDetections = []
                return
            }

            do {
                capturedDetections = try observations.compactMap { observation in
                    guard let label = observation.labels.first else {
                        return nil
                    }
                    let code = label.identifier.trimmingCharacters(in: .whitespacesAndNewlines)
                    let confidence = Double(label.confidence)
                    guard confidence >= confidenceThreshold, code != "0z" else {
                        return nil
                    }
                    guard Self.validTileCodes.contains(code) else {
                        throw TileDetectionError.unknownLabel(code)
                    }
                    return Detection(
                        code: code,
                        confidence: confidence,
                        boundingBox: Self.convertVisionBoundingBox(observation.boundingBox)
                    )
                }
            } catch {
                capturedError = error
            }
        }
        request.imageCropAndScaleOption = .scaleFit

        let handler = VNImageRequestHandler(
            cgImage: cgImage,
            orientation: CGImagePropertyOrientation(image.imageOrientation),
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
        let model = try MLModel(contentsOf: compiledURL, configuration: MLModelConfiguration())
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

    private static func convertVisionBoundingBox(_ box: CGRect) -> CGRect {
        CGRect(
            x: box.minX,
            y: 1.0 - box.maxY,
            width: box.width,
            height: box.height
        ).standardized
    }

    private static let validTileCodes: Set<String> = {
        var codes: Set<String> = ["0m", "0p", "0s", "0z"]
        for suit in ["m", "p", "s"] {
            for rank in 1...9 {
                codes.insert("\(rank)\(suit)")
            }
        }
        for rank in 1...7 {
            codes.insert("\(rank)z")
        }
        return codes
    }()
}

enum TileDetectionError: LocalizedError {
    case invalidImage
    case modelUnavailable
    case unknownLabel(String)

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "图片无法读取，请换一张照片"
        case .modelUnavailable:
            return "本地识别模型不可用"
        case .unknownLabel(let label):
            return "识别到了未知类别：\(label)"
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
