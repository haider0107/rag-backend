import express from "express";
import { requireAuth } from "@clerk/express";
import { vectorStore } from "../services/vectorService.js";
import { extractArticle } from "../../data/extractor.js";
import Parser from "rss-parser";
import { chunkText } from "../../data/chunker.js";

const router = express.Router();
const parser = new Parser();

// ✅ Utility: validate URL
function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

router.post("/add-feed", requireAuth(), async (req, res) => {
  const { rssUrl } = req.body;

  // 1. Validate input
  if (!rssUrl || typeof rssUrl !== "string") {
    return res.status(400).json({ error: "RSS feed URL is required" });
  }
  if (!isValidUrl(rssUrl)) {
    return res.status(400).json({ error: "Invalid RSS feed URL" });
  }

  try {
    // 2. Parse feed
    const feed = await parser.parseURL(rssUrl);
    if (!feed.items || feed.items.length === 0) {
      return res.status(400).json({ error: "No items found in the RSS feed" });
    }

    let count = 0;

    for (let item of feed.items.slice(0, 30)) {
      try {
        const text = await extractArticle(item.link);

        // Split into chunks
        const chunks = chunkText(text, 300, 50);

        await vectorStore.addDocuments(
          chunks.map((chunk) => ({
            pageContent: chunk,
            metadata: { title: item.title, url: item.link },
          }))
        );

        console.log(`✅ ID ${++count} Article "${item.title}" added to Qdrant`);
      } catch (err) {
        console.error(`❌ Failed to fetch article: ${item.link}`, err.message);
      }
    }

    // 3. Send success response
    return res.json({
      message: `Feed processed successfully`,
      totalArticles: count,
      feedTitle: feed.title || "Unknown",
    });
  } catch (err) {
    console.error("❌ Error parsing RSS feed:", err.message);
    return res.status(500).json({
      error: "Failed to process RSS feed",
      details: err.message,
    });
  }
});

export default router;
