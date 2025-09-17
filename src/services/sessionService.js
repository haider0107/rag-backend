import redisClient from "../redisClient.js";

export async function getSession(sessionId) {
  const data = await redisClient.get(sessionId);
  return data ? JSON.parse(data) : [];
}

export async function saveSession(sessionId, history) {
  await redisClient.set(sessionId, JSON.stringify(history));
}
