import Parser from "rss-parser";
import { extractArticle } from "./extractor.js"; // import helper
import { chunkText } from "./chunker.js";
import { JinaEmbeddings } from "@langchain/community/embeddings/jina";
import { QdrantVectorStore } from "@langchain/qdrant";
import dotenv from "dotenv";

dotenv.config();

const parser = new Parser();

async function fetchArticles() {
  // const feed = await parser.parseURL(
  //   "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"
  // );

  const feed = await parser.parseURL(
    "https://www.thehindu.com/news/national/?service=rss"
  );

  console.log(feed.items.length);

  // return;
  let articles = [];

  const embeddings = new JinaEmbeddings({
    apiKey: process.env.JINA_API_KEY,
    model: "jina-embeddings-v3", // Optional, defaults to "jina-clip-v2"
  });

  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      url: process.env.QDRANT_URL,
      apikey: process.env.QDRANT_API_KEY,
      collectionName: "testing",
    }
  );
  let count = 0;

  for (let item of feed.items.slice(0, 50)) {
    try {
      const text = await extractArticle(item.link);

      // Split into chunks
      const chunks = chunkText(text, 300, 50);

      // Store each chunk as a separate record
      // chunks.forEach((chunk, idx) => {
      //   articles.push({
      //     title: item.title,
      //     link: item.link,
      //     chunkId: idx,
      //     content: chunk,
      //   });
      // });

      // articles.push({
      //   title: item.title,
      //   link: item.link,
      //   content: text,
      // });

      await vectorStore.addDocuments(
        chunks.map((chunk) => ({
          pageContent: chunk,
          metadata: { title: item.title, url: item.link },
        }))
      );

      console.log(`✅ ID ${++count} Articles ${item.title} added to Qdrant`);
    } catch (err) {
      console.error(`Failed to fetch article: ${item.link}`, err.message);
    }
  }

  return articles;
}

// Run it
// fetchArticles().then((articles) => console.log(articles));
fetchArticles();
