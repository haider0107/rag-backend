import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import chatRoutes from "./routes/chat.js";
import feedRoutes from "./routes/feed.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Routes
app.use("/chat", chatRoutes);
app.use("/upload", feedRoutes);

export default app;
