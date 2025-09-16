import { createClient } from "redis";

// console.log("Redis Host:", process.env.REDIS_HOST);
// console.log("Redis Port:", process.env.REDIS_PORT);
// console.log(
//   "Redis Password:",
//   process.env.REDIS_PASSWORD ? "Loaded ✅" : "Missing ❌"
// );

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

await redisClient.connect();

export default redisClient;
