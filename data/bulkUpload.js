import Parser from "rss-parser";
import { extractArticle } from "./extractor.js"; // import helper

const parser = new Parser();

async function fetchArticles() {
  const feed = await parser.parseURL(
    "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"
  );

  let articles = [];

  for (let item of feed.items.slice(0, 5)) {
    try {
      const text = await extractArticle(item.link);

      articles.push({
        title: item.title,
        link: item.link,
        content: text,
      });
    } catch (err) {
      console.error(`Failed to fetch article: ${item.link}`, err.message);
    }
  }

  return articles;
}

// Run it
fetchArticles().then((arts) => console.log(arts));
