import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createRequestListener } from "@react-router/node";
import type { ServerBuild } from "react-router";
import sirv from "sirv";
import { readServerConfig } from "./app/server/config.server";
import { createApplicationServices } from "./app/server/services.server";
import { ServerConfigurationError } from "./app/server/errors/http-errors";
import { SERVER_ERROR_MESSAGES } from "./app/server/errors/messages/server-error-messages";

async function startServer() {
  const webDirectory = fileURLToPath(new URL("./", import.meta.url));
  const environmentFile = fileURLToPath(new URL("../../.env", import.meta.url));
  if (existsSync(environmentFile)) loadEnvFile(environmentFile);
  const config = readServerConfig(process.env);
  const services = await createApplicationServices(config);
  const isProduction = process.env.NODE_ENV === "production";
  const server = createServer();
  let developmentServer: import("vite").ViteDevServer | undefined;

  try {
    let build: ServerBuild | (() => Promise<ServerBuild>);
    if (isProduction) {
      const serverBuildUrl = pathToFileURL(
        resolve(webDirectory, "build/server/index.js"),
      );
      build = (await import(serverBuildUrl.href)) as ServerBuild;
    } else {
      const { createServer: createViteServer } = await import("vite");
      const viteServer = await createViteServer({
        root: webDirectory,
        server: { middlewareMode: true, hmr: { server } },
        appType: "custom",
      });
      developmentServer = viteServer;
      build = () =>
        viteServer.ssrLoadModule(
          "virtual:react-router/server-build",
        ) as Promise<ServerBuild>;
    }
    const handleRequest = createRequestListener({
      build,
      mode: isProduction ? "production" : "development",
      getLoadContext: (_, client) => ({
        services,
        clientAddress: client.address,
      }),
    });
    const serveAssets =
      developmentServer?.middlewares ??
      sirv(resolve(webDirectory, "build/client"));
    server.on("request", (request, response) => {
      serveAssets(request, response, () => handleRequest(request, response));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, resolve);
    });
    console.log(`Listening on http://${config.host}:${config.port}`);
  } catch (error) {
    await developmentServer?.close();
    await services.close();
    server.close();
    throw error;
  }

  let isStopping = false;
  async function stopServer() {
    if (isStopping) return;
    isStopping = true;
    const serverClosed = new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    await developmentServer?.close();
    await serverClosed;
    await services.close();
    process.exit(0);
  }
  process.once("SIGINT", () => {
    void stopServer();
  });
  process.once("SIGTERM", () => {
    void stopServer();
  });
}

startServer().catch((error: unknown) => {
  console.error(
    error instanceof ServerConfigurationError
      ? error.message
      : SERVER_ERROR_MESSAGES.startupFailed,
  );
  process.exitCode = 1;
});
