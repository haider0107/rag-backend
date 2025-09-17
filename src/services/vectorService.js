import { QdrantVectorStore } from "@langchain/qdrant";
import { JinaEmbeddings } from "@langchain/community/embeddings/jina";

const embeddings = new JinaEmbeddings({
  apiKey: process.env.JINA_API_KEY,
  model: "jina-embeddings-v3",
});

export const vectorStore = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  {
    url: process.env.QDRANT_URL,
    apikey: process.env.QDRANT_API_KEY,
    collectionName: "testing",
  }
);
