import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// Serve the React frontend
const staticPath = path.resolve(__dirname, "../../live-music-tracker/dist/public");
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  // SPA fallback — let the frontend router handle all non-API routes
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

export default app;
