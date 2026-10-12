/**
 * Custom Next.js server: serves the app and the live-whiteboard Socket.IO server
 * (realtime/src) from one process on one port, so production is a single web service.
 *
 *   dev:   yarn dev     (tsx server.ts)
 *   prod:  yarn build && yarn start   (node dist/server.js, compiled by tsconfig.server.json)
 *
 * Plain `next dev` / `next start` still work for the site alone, without live classrooms.
 */
import { createServer } from "node:http";
import next from "next";

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

// Passing httpServer lets Next.js attach its own upgrade handling (dev hot reload)
const httpServer = createServer();
const app        = next({ dev, port, httpServer });
const handle     = app.getRequestHandler();

app.prepare()
  .then(async () => {
    httpServer.on("request", (req, res) => { void handle(req, res); });

    // Imported only after prepare(): Next.js loads .env* files there, and the realtime
    // modules read DATABASE_URL / WHITEBOARD_JWT_SECRET when they load
    const { attachSocketIO } = await import("./realtime/src/index");
    attachSocketIO(httpServer);

    httpServer.listen(port, () => {
      console.log(`> Ready on http://localhost:${port} (${dev ? "development" : "production"})`);
    });
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
