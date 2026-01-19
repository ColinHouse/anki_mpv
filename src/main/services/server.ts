import express from "express";
import cors from "cors";
import getPort from "get-port";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "node:fs";
import path from "node:path";

// 设置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegStatic);

export class StreamingServer {
  private static instance: StreamingServer;
  private app: any; // 或 express.Application
  private port: number = 0;
  private server: any;

  private constructor() {
    this.app = express();
    this.app.use(cors());
    this.setupRoutes();
  }

  public static getInstance(): StreamingServer {
    if (!StreamingServer.instance) {
      StreamingServer.instance = new StreamingServer();
    }
    return StreamingServer.instance;
  }

  public getPort(): number {
    return this.port;
  }

  public async init(startPort: number = 54321): Promise<number> {
    this.port = await getPort({ port: startPort });
    this.server = this.app.listen(this.port, () => {
      console.log(`Local streaming server running on port ${this.port}`);
    });
    return this.port;
  }

  private setupRoutes() {
    // 核心路由 /stream：提供视频流
    this.app.get("/stream", (req: any, res: any) => {
      const filePath = req.query.file as string;

      if (!filePath) {
        return res.status(400).send("Missing file parameter");
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
      }

      // 使用 Express 的 sendFile 方法，自动支持 Range 请求和中文路径
      res.sendFile(filePath, {
        headers: {
          "Content-Type": "video/mp4",
        },
      });
    });

    // 预留路由 /metadata：获取视频元数据
    this.app.get("/metadata", (req: any, res: any) => {
      const filePath = req.query.file as string;

      if (!filePath) {
        return res.status(400).json({ error: "Missing file parameter" });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      // 使用 fluent-ffmpeg 读取视频信息
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error("Error reading video metadata:", err);
          return res
            .status(500)
            .json({ error: "Failed to read video metadata" });
        }

        const videoInfo = {
          duration: metadata.format.duration,
          format: metadata.format.format_name,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          streams: metadata.streams.map((stream) => ({
            codec_name: stream.codec_name,
            codec_type: stream.codec_type,
            width: stream.width,
            height: stream.height,
            r_frame_rate: stream.r_frame_rate,
          })),
        };

        res.json(videoInfo);
      });
    });
  }
}
