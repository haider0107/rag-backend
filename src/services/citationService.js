export function linkifyCitations(answer, results) {
  return answer.replace(/\[Source (\d+)\]/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    const doc = results[idx];
    if (doc?.metadata?.url) {
      return `[Source ${doc.metadata.url}]`;
    }
    return match;
  });
}
