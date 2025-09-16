import express from "express";
import cors from "cors";
import { clerkMiddleware } from '@clerk/express'
import chatRoutes from "./routes/chat.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware())

// Routes
app.use("/chat", chatRoutes);

export default app;
