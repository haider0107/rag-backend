import express from "express";
import { getAuth, requireAuth } from "@clerk/express";
import { ai } from "../services/aiService.js";
import { getSession, saveSession } from "../services/sessionService.js";
import { vectorStore } from "../services/vectorService.js";
import { linkifyCitations } from "../services/citationService.js";
import redisClient from "../redisClient.js";

const router = express.Router();

/**
 * Utility to send consistent error responses
 */
function sendError(res, status, message, details = null) {
  return res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
  });
}

/**
 * POST /chat/ask
 * Protected route – streams AI response
 */
router.post("/ask", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return sendError(res, 401, "Unauthorized: Clerk userId missing");
    }

    const { question } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      return sendError(res, 400, "Invalid request: 'question' is required");
    }

    const sessionId = userId;
    let history = await getSession(sessionId);

    // Vector store lookup
    let results = [];
    try {
      results = await vectorStore.similaritySearch(question, 5);
    } catch (err) {
      console.error("❌ Qdrant search error:", err);
      return sendError(res, 500, "Failed to query vector store", err.message);
    }

    const context = results
      .map(
        (r, i) =>
          `Source ${i + 1}:\nTitle: ${r.metadata?.title || "Untitled"}\nURL: ${
            r.metadata?.url || "N/A"
          }\nContent: ${r.pageContent}`
      )
      .join("\n\n");

    const historyText = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `
      You are a helpful assistant. Use the provided sources (include url if available) to answer.

      Conversation so far:
      ${historyText}

      New question: ${question}

      Context from sources:
      ${context}

      Answer (with citations like [Source 1]):
    `;

    history.push({ role: "user", content: question });

    // AI streaming
    let response;
    try {
      response = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: [prompt],
      });
    } catch (err) {
      console.error("❌ AI service error:", err);
      return sendError(res, 500, "AI service failed", err.message);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullAnswer = "";
    try {
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          const linkedText = linkifyCitations(text, results);
          fullAnswer += linkedText;
          res.write(`data: ${JSON.stringify({ text: linkedText })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("❌ Error streaming response:", err);
      return sendError(res, 500, "Error streaming AI response", err.message);
    }

    // Save AI response
    try {
      history.push({ role: "assistant", content: fullAnswer });
      await saveSession(sessionId, history);
    } catch (err) {
      console.error("⚠️ Failed to save session:", err);
      // don’t crash – but inform the frontend
    }
  } catch (error) {
    console.error("❌ Unexpected error in /ask:", error);
    return sendError(res, 500, "Unexpected server error", error.message);
  }
});

/**
 * POST /chat/clear
 * Clears Redis session
 */
router.post("/clear", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return sendError(res, 401, "Unauthorized: Clerk userId missing");
    }

    await redisClient.del(userId);
    return res.json({ success: true, message: "Session cleared" });
  } catch (err) {
    console.error("❌ Redis clear error:", err);
    return sendError(res, 500, "Failed to clear session", err.message);
  }
});

/**
 * GET /chat/history
 * Returns chat history for the logged-in user
 */
router.get("/history", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return sendError(res, 401, "Unauthorized: Clerk userId missing");
    }

    const history = await getSession(userId);

    if (!history || history.length === 0) {
      return res.json({
        success: true,
        history: [],
        message: "No chat history found",
      });
    }

    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error("❌ Error fetching chat history:", err);
    return sendError(res, 500, "Failed to fetch chat history", err.message);
  }
});

/**
 * GET /chat/
 * Public health-check route
 */
router.get("/", (req, res) => {
  res.json({ message: "Chat API is working 🚀" });
});

export default router;
