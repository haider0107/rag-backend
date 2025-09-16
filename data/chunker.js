// chunker.js
export function chunkText(text, chunkSize = 300, overlap = 50) {
  const words = text.split(" ");
  let chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    chunks.push(chunk);
  }

  return chunks;
}
