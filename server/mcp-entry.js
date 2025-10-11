#!/usr/bin/env node
/**
 * MCP Server Entry Point (stdio transport)
 *
 * This is a standalone entry point for the MCP server using stdio transport.
 * Claude Desktop/CLI connects to this via stdio to access NoiseCanvas tools.
 *
 * The MCP server is a pure gateway/relay that forwards tool calls to the
 * Express API running on localhost:3001. It does not handle business logic
 * or audio playback directly.
 */

import { startMCPServer } from './mcp/mcp-server.js';

async function main() {
  // Start MCP server with stdio transport
  // No services needed - MCP is a pure gateway that calls HTTP API
  await startMCPServer();

  // Note: No console.log here - stdio is used for MCP communication
  // Any logging will interfere with the protocol
}

main().catch((error) => {
  console.error('MCP Server error:', error);
  process.exit(1);
});
