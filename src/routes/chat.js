import express from "express";
import redisClient from "../redisClient.js";
import { QdrantVectorStore } from "@langchain/qdrant";
import { JinaEmbeddings } from "@langchain/community/embeddings/jina";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getSession(sessionId) {
  const data = await redisClient.get(sessionId);
  return data ? JSON.parse(data) : [];
}

async function saveSession(sessionId, history) {
  await redisClient.set(sessionId, JSON.stringify(history));
}

const embeddings = new JinaEmbeddings({
  apiKey: process.env.JINA_API_KEY,
  model: "jina-embeddings-v3", // Optional, defaults to "jina-clip-v2"
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  apikey: process.env.QDRANT_API_KEY,
  collectionName: "testing",
});

function linkifyCitations(answer, results) {
  return answer.replace(/\[Source (\d+)\]/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    const doc = results[idx];
    if (doc?.metadata?.url) {
      return `[Source ${doc.metadata.url}]`;
    }
    return match; // fallback if no URL
  });
}

router.post("/ask", async (req, res) => {
  try {
    const { sessionId, question } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    // 🔹 Load history from Redis
    let history = await getSession(sessionId);

    const results = await vectorStore.similaritySearch(question, 5);

    const context = results
      .map(
        (r, i) =>
          `Source ${i + 1}:\nTitle: ${r.metadata.title}\nURL: ${
            r.metadata.url
          }\nContent: ${r.pageContent}`
      )
      .join("\n\n");

    // 🔹 Build prompt with limited history
    const historyText = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `
      You are a helpful assistant. Use the provided sources(provide url if available) to answer.

      Conversation so far:
      ${historyText}

      New question: ${question}

      Context from sources:
      ${context}

      Answer (with citations like [Source 1]):
      `;

    // Save user msg
    history.push({ role: "user", content: question });

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

      console.log(text);

      if (text) {
        const linkedText = linkifyCitations(text, results);
        fullAnswer += linkedText;
        res.write(`data: ${JSON.stringify({ text: linkedText })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

    // Save assistant msg
    history.push({ role: "assistant", content: fullAnswer });
    await saveSession(sessionId, history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Clear session
router.post("/clear", async (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    await redisClient.del(sessionId);
  }
  res.json({ success: true });
});

// Simple test route
router.get("/", (req, res) => {
  res.json({ message: "Chat API is working 🚀" });
});

export default router;
