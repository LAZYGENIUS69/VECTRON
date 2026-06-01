// Vercel Serverless Function entry.
// Routes:
// - /api/*  -> this function (Express app)
// - /health -> this function
//
// IMPORTANT: server/dist/index.js must NOT call app.listen() on import.

declare const require: (path: string) => { default: unknown };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require("../server/dist/index.js").default;

export default app;
