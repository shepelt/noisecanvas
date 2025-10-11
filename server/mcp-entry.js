#!/usr/bin/env node
/**
 * MCP Server Entry Point (stdio transport)
 *
 * This is a standalone entry point for the MCP server using stdio transport.
 * Claude Desktop/CLI connects to this via stdio to access NoiseCanvas tools.
 *
 * Note: This server does NOT handle the actual audio playback.
 * It communicates with the web frontend via the Express API.
 */

import { PatternService } from './services/PatternService.js';
import { SamplerService } from './services/SamplerService.js';
import { startMCPServer } from './mcp/mcp-server.js';

async function main() {
  // Initialize services (disable logging for MCP - stdio is used for protocol)
  const services = {
    pattern: new PatternService({ enableLogging: false, testBroadcast: false }),
    sampler: new SamplerService(),
  };

  // Start MCP server with stdio transport
  await startMCPServer(services);

  // Note: No console.log here - stdio is used for MCP communication
  // Any logging will interfere with the protocol
}

main().catch((error) => {
  console.error('MCP Server error:', error);
  process.exit(1);
});
