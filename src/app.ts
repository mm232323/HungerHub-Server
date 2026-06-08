import "./load-env.js";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes/index.js";
import { logger } from "./utils/logger.js";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middleware/clerkProxyMiddleware.js";

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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || ""
  })),
);

app.use("/api", router);

export default app;
