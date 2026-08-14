import { afterEach, describe, expect, it } from "vitest";
import {
  CLIENT_CAPABILITIES_META_KEY,
  PROTOCOL_VERSION_META_KEY,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import {
  createGodotHttpHandler,
  createGodotMcpServer,
  tools,
} from "./index.js";

const handlers: McpHttpHandler[] = [];

afterEach(async () => {
  await Promise.all(handlers.splice(0).map((handler) => handler.close()));
});

function modernRequest(method: string, params: Record<string, unknown> = {}): Request {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-method": method,
    "mcp-protocol-version": "2026-07-28",
  };
  if (typeof params.name === "string") {
    headers["mcp-name"] = params.name;
  }

  return new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          [PROTOCOL_VERSION_META_KEY]: "2026-07-28",
          [CLIENT_CAPABILITIES_META_KEY]: {},
        },
      },
    }),
  });
}

function legacyRequest(method: string, params: Record<string, unknown>): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

describe("MCP v2 server", () => {
  it("creates a fresh protocol server instance from the shared registry", () => {
    const first = createGodotMcpServer();
    const second = createGodotMcpServer();

    expect(first).not.toBe(second);
    expect(tools.size).toBe(99);
  });

  it("serves modern discovery and the complete tool list", async () => {
    const handler = createGodotHttpHandler();
    handlers.push(handler);

    const discoverResponse = await handler.fetch(modernRequest("server/discover"));
    expect(discoverResponse.status).toBe(200);
    const discover = await discoverResponse.json();
    expect(discover.result.supportedVersions).toContain("2026-07-28");
    expect(discover.result.ttlMs).toBe(0);

    const listResponse = await handler.fetch(modernRequest("tools/list"));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    expect(list.result.tools).toHaveLength(99);
    expect(list.result.tools.some((tool: { name: string }) => tool.name === "godot_read_scene"))
      .toBe(true);

    const callResponse = await handler.fetch(
      modernRequest("tools/call", { name: "godot_connection_status", arguments: {} })
    );
    expect(callResponse.status).toBe(200);
    const call = await callResponse.json();
    expect(call.result.structuredContent).toMatchObject({ connected: false });
  });

  it("keeps 2025-era HTTP compatibility stateless", async () => {
    const handler = createGodotHttpHandler();
    handlers.push(handler);

    const initializeResponse = await handler.fetch(
      legacyRequest("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "godot-mcp-test", version: "1.0.0" },
      })
    );
    expect(initializeResponse.status).toBe(200);
    expect(await initializeResponse.text()).toContain('"protocolVersion":"2025-11-25"');

    // No Mcp-Session-Id is supplied: a fresh server answers this next request.
    const listResponse = await handler.fetch(legacyRequest("tools/list", {}));
    expect(listResponse.status).toBe(200);
    const body = await listResponse.text();
    expect(body).toContain('"name":"godot_read_scene"');
    expect(listResponse.headers.get("mcp-session-id")).toBeNull();
  });
});
