import express from "express";
import cors from "cors";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import getPort from "get-port";
import path from "path";
import fs from "fs";

// 设置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegStatic);

interface VideoServer {
  app: express.Application;
  port: number;
  server: any;
  isRunning: boolean;
}

class VideoServerManager {
  private server: VideoServer | null = null;

  async startServer(): Promise<VideoServer> {
    if (this.server && this.server.isRunning) {
      return this.server;
    }

    // 获取可用端口
    const port = await getPort({ port: 3000 });

    const app = express();

    // 启用 CORS
    app.use(cors());

    // 设置静态文件服务
    app.use(express.static(path.join(__dirname, "../renderer")));

    // 视频流路由
    app.get("/stream", (req, res) => {
      const filePath = req.query.file as string;
      const startTime = req.query.start as string;
      const endTime = req.query.end as string;

      if (!filePath) {
        return res.status(400).send("File path is required");
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("Video not found");
      }

      // 如果有时间参数，进行裁剪
      if (startTime && endTime) {
        const start = parseFloat(startTime);
        const end = parseFloat(endTime);
        const duration = end - start;

        if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
          return res.status(400).send("Invalid time parameters");
        }

        // 创建临时文件名
        const tempFileName = `temp_${Date.now()}_${path.basename(filePath)}`;
        const tempFilePath = path.join(process.cwd(), "temp", tempFileName);

        // 确保 temp 目录存在
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log(`Creating trimmed video: ${tempFilePath}`);
        console.log(`Start: ${start}s, End: ${end}s, Duration: ${duration}s`);

        // 使用 ffmpeg 裁剪视频
        ffmpeg(filePath)
          .setStartTime(start)
          .setDuration(duration)
          .output(tempFilePath)
          .on("end", () => {
            console.log("Video trimming completed");
            serveVideoFile(tempFilePath, res, req);
          })
          .on("error", (err) => {
            console.error("Error trimming video:", err);
            return res.status(500).send("Error processing video");
          })
          .run();
      } else {
        // 直接流式传输原视频
        serveVideoFile(filePath, res, req);
      }
    });

    // 辅助函数：处理视频文件流式传输
    function serveVideoFile(videoPath: string, res: express.Response, req: express.Request) {
      // 获取视频文件信息
      fs.stat(videoPath, (err, stats) => {
        if (err) {
          console.error("Error getting video stats:", err);
          return res.status(500).send("Error getting video stats");
        }

        const range = req.headers.range;
        if (!range) {
          // 普通请求，直接返回视频
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Length", stats.size);
          const stream = fs.createReadStream(videoPath);
          stream.pipe(res);
        } else {
          // Range 请求，支持视频拖拽
          const positions = range.replace(/bytes=/, "").split("-");
          const start = parseInt(positions[0], 10);
          const total = stats.size;
          const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
          const chunksize = end - start + 1;

          res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Content-Length", chunksize);
          res.setHeader("Content-Type", "video/mp4");
          res.status(206);

          const stream = fs.createReadStream(videoPath, { start, end });
          stream.pipe(res);
        }
      });
    }

    // 启动服务器
    const server = app.listen(port, () => {
      console.log(`Video server running on port ${port}`);
    });

    this.server = {
      app,
      port,
      server,
      isRunning: true
    };

    return this.server;
  }

  async getServerUrl(): Promise<string> {
    const server = await this.startServer();
    return `http://localhost:${server.port}`;
  }

  stopServer() {
    if (this.server && this.server.isRunning) {
      this.server.server.close();
      this.server.isRunning = false;
      this.server = null;
      console.log("Video server stopped");
    }
  }
}

export const videoServerManager = new VideoServerManager();
