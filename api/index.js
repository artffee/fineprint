// Vercel serverless entry: re-exports the Express app from server.js.
// vercel.json rewrites every /api/* request to this file, so Express's
// own routing (/api/health, /api/analyze) takes over.
import app from "../server.js";

export default app;
