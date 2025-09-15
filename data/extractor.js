import * as cheerio from "cheerio";
import axios from "axios";

// Generic extractor (can extend for other sites like Reuters, BBC)
export async function extractArticle(url) {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);

  let text = "";

  if (url.includes("timesofindia.indiatimes.com")) {
    // TOI case
    text = $('[data-articlebody="1"]')
      .find("p, div, span")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");
  } else {
    // fallback: normal <p> tags
    text = $("p")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");
  }

  return text.replace(/\s+/g, " ").trim();
}
