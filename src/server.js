// import dotenv from "dotenv";
// dotenv.config();

import "dotenv/config";

import app from "./app.js";

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
