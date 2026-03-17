import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";

const app: Express = express();

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[\w-]+\.replit\.dev$/,
  /^https:\/\/[\w-]+\.replit\.app$/,
  /^https:\/\/[\w-]+\.spock\.replit\.dev$/,
];

if (process.env.PRODUCTION_ORIGIN) {
  const escaped = process.env.PRODUCTION_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  ALLOWED_ORIGIN_PATTERNS.push(new RegExp(`^${escaped}$`));
}

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
