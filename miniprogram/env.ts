export const CLOUD_ENV_ID = "cloud1-d8gnhaa3a51e881f1";
export const TILE_MODEL_FILE_ID = "cloud://cloud1-d8gnhaa3a51e881f1.636c-cloud1-d8gnhaa3a51e881f1-1312639385/best-v31seg.onnx";
// 发布 v3.1 segmentation 模型时，将 TILE_MODEL_FILE_ID 替换为 best-v31seg.onnx 的云存储 fileID。
// 端侧模型的输入边长须与 ONNX 导出时的 imgsz 一致（v3.1 seg 为 960）。
export const TILE_MODEL_INPUT_SIZE = 960;
