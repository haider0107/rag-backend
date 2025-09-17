export function linkifyCitations(answer, results) {
  return answer.replace(/\[Source ([\d,\s]+)\]/g, (match, nums) => {
    // split "1, 2, 4" -> ["1", "2", "4"]
    const indices = nums.split(",").map((n) => parseInt(n.trim(), 10) - 1);

    // map to URLs if available
    const links = indices
      .map((idx) => {
        const doc = results[idx];
        if (doc?.metadata?.url) {
          return `[Source ${doc.metadata.url}]`;
        }
        return null;
      })
      .filter(Boolean);

    // if we got links, join them with spaces, else return original
    return links.length > 0 ? links.join(" ") : match;
  });
}
