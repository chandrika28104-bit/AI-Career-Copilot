import { defineConfig } from "vite";

const basePath = process.env.BASE_PATH || "/";
const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
const port = Number(process.env.PORT || 5173);
const localApiPath = `${normalizedBase}api/analyze`.replace(/\/+/g, "/");

export default defineConfig({
  base: normalizedBase,
  plugins: [
    {
      name: "local-gemini-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const requestPath = new URL(req.url || "/", "http://localhost").pathname;
          if (requestPath !== localApiPath) return next();

          try {
            const { default: handler } = await import("./api/analyze.js");
            await handler(req, res);
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "The analysis service failed." }));
          }
        });
      },
    },
  ],
  server: {
    port,
    strictPort: Boolean(process.env.PORT),
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
