import express from "express";
import { getAuth, requireAuth } from "@clerk/express"; // 👈 Clerk middleware
import { ai } from "../services/aiService.js";
import { getSession, saveSession } from "../services/sessionService.js";
import { vectorStore } from "../services/vectorService.js";
import { linkifyCitations } from "../services/citationService.js";
import redisClient from "../redisClient.js"; // 👈 needed for /clear

const router = express.Router();

// 🔐 Protect this route with Clerk
router.post("/ask", requireAuth(), async (req, res) => {
  try {
    // Use Clerk's userId as sessionId
    const { userId } = getAuth(req);
    const sessionId = userId;
    const { question } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing Clerk userId" });
    }

    // Load history from Redis
    let history = await getSession(sessionId);

    // Retrieve relevant context
    const results = await vectorStore.similaritySearch(question, 5);
    const context = results
      .map(
        (r, i) =>
          `Source ${i + 1}:\nTitle: ${r.metadata.title}\nURL: ${
            r.metadata.url
          }\nContent: ${r.pageContent}`
      )
      .join("\n\n");

    // Build conversation prompt
    const historyText = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `
      You are a helpful assistant. Use the provided sources (provide url if available) to answer.

      Conversation so far:
      ${historyText}

      New question: ${question}

      Context from sources:
      ${context}

      Answer (with citations like [Source 1]):
    `;

    // Save user message in history
    history.push({ role: "user", content: question });

    // Stream Gemini response
    const response = await ai.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: [prompt],
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullAnswer = "";
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

    // Save assistant response
    history.push({ role: "assistant", content: fullAnswer });
    await saveSession(sessionId, history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// 🔐 Clear session also requires Clerk auth
router.post("/clear", requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  const sessionId = userId;
  if (sessionId) {
    await redisClient.del(sessionId);
  }
  res.json({ success: true });
});

// Test route (public)
router.get("/", (req, res) => {
  res.json({ message: "Chat API is working 🚀" });
});

export default router;
