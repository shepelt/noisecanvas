/**
 * MCP Server: Model Context Protocol integration for NoiseCanvas
 *
 * Exposes NoiseCanvas functionality as MCP tools that Claude can use
 * to control music playback programmatically.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// API endpoint configuration
// Use localhost:3001 if running dev:api separately, or localhost:3000 for hybrid server
const API_BASE_URL = process.env.NOISECANVAS_API_URL || 'http://localhost:3000';

/**
 * Create and configure MCP server
 *
 * The MCP server acts as a pure gateway/relay to the Express API.
 * It does not handle business logic or services directly.
 *
 * @returns {Server} Configured MCP server
 */
export function createMCPServer() {
  const server = new Server(
    {
      name: 'noisecanvas',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool handlers
  setupToolHandlers(server);

  return server;
}

/**
 * Set up tool handlers
 *
 * All handlers forward requests to the Express API
 */
function setupToolHandlers(server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'play_notes',
          description: 'Play a sequence of notes using the web sampler. Notes will be played sequentially at the specified BPM. Supports multiple instruments/channels in a single pattern.',
          inputSchema: {
            type: 'object',
            properties: {
              notes: {
                type: 'array',
                items: {
                  oneOf: [
                    {
                      type: 'string',
                      description: 'Simple note name (e.g., "C", "D-4")'
                    },
                    {
                      type: 'object',
                      properties: {
                        note: {
                          type: 'string',
                          description: 'Note name (e.g., "C", "D-4")'
                        },
                        instrument: {
                          type: 'string',
                          description: 'Sample/instrument name for this note (e.g., "ST-01", "808-KICK")'
                        },
                        volume: {
                          type: 'number',
                          description: 'Volume level 0-64 for this note',
                          minimum: 0,
                          maximum: 64
                        }
                      },
                      required: ['note']
                    }
                  ]
                },
                description: 'Array of notes to play. Can be simple strings ["C", "D", "E"] or objects with per-note instrument/volume [{note: "C", instrument: "ST-01"}, {note: "C", instrument: "808-KICK"}]',
              },
              bpm: {
                type: 'number',
                description: 'Beats per minute (default: 120)',
                default: 120,
              },
              instrument: {
                type: 'string',
                description: 'Default sample/instrument name (default: "ST-01"). Used for notes that don\'t specify their own instrument.',
                default: 'ST-01',
              },
              octave: {
                type: 'number',
                description: 'Default octave number (default: 4). Used for notes that don\'t include octave.',
                default: 4,
              },
              volume: {
                type: 'number',
                description: 'Default volume level 0-64 (default: 64). Used for notes that don\'t specify their own volume.',
                default: 64,
                minimum: 0,
                maximum: 64,
              },
            },
            required: ['notes'],
          },
        },
        {
          name: 'list_samples',
          description: 'Get a list of all available samples/instruments',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_sample_info',
          description: 'Get detailed information about a specific sample/instrument',
          inputSchema: {
            type: 'object',
            properties: {
              sampleId: {
                type: 'string',
                description: 'Sample identifier (e.g., "ST-01")',
              },
            },
            required: ['sampleId'],
          },
        },
        {
          name: 'play_pattern',
          description: 'Play a tracker-style pattern with multiple channels. Each row can contain multiple notes that play simultaneously (like a music tracker). Perfect for drum beats, chords, and multi-instrument arrangements.',
          inputSchema: {
            type: 'object',
            properties: {
              rows: {
                type: 'array',
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      sample: {
                        type: 'string',
                        description: 'Sample/instrument name (e.g., "ST-01", "808-KICK")'
                      },
                      note: {
                        type: 'string',
                        description: 'Note to play (e.g., "C-4", "D#5")'
                      },
                      volume: {
                        type: 'number',
                        description: 'Volume level 0-64 (optional, default: 64)',
                        minimum: 0,
                        maximum: 64
                      },
                      delay: {
                        type: 'number',
                        description: 'Note delay in ticks (0-5, optional). Delays note trigger within the row for off-beat timing. Example: delay:3 for mid-row hi-hat',
                        minimum: 0,
                        maximum: 5
                      }
                    },
                    required: ['sample', 'note']
                  }
                },
                description: 'Array of rows, where each row is an array of notes to play simultaneously. Example: [[{sample:"ST-01",note:"C-4"},{sample:"808-KICK",note:"C-2"}], [{sample:"ST-01",note:"E-4"}]]'
              },
              bpm: {
                type: 'number',
                description: 'Beats per minute (default: 120)',
                default: 120
              },
              speed: {
                type: 'number',
                description: 'Ticks per row for timing (default: 6)',
                default: 6
              },
              repeat: {
                type: 'number',
                description: 'Number of times to repeat the pattern (default: 1)',
                default: 1
              }
            },
            required: ['rows']
          }
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'play_notes':
          return await handlePlayNotes(args);

        case 'play_pattern':
          return await handlePlayPattern(args);

        case 'list_samples':
          return await handleListSamples();

        case 'get_sample_info':
          return await handleGetSampleInfo(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

/**
 * Handle play_notes tool call
 *
 * Forwards the request to the Express API
 */
async function handlePlayNotes(args) {
  const { notes, bpm, instrument, octave, volume } = args;

  // Call HTTP API
  try {
    const response = await fetch(`${API_BASE_URL}/api/play-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, bpm, instrument, octave, volume })
    });

    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling API: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle play_pattern tool call
 *
 * Forwards the request to the Express API
 */
async function handlePlayPattern(args) {
  const { rows, bpm, speed, repeat } = args;

  try {
    const response = await fetch(`${API_BASE_URL}/api/play-pattern`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, bpm, speed, repeat })
    });

    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling API: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle list_samples tool call
 *
 * Forwards the request to the Express API
 */
async function handleListSamples() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/samples`);
    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling API: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle get_sample_info tool call
 *
 * Forwards the request to the Express API
 */
async function handleGetSampleInfo(args) {
  const { sampleId } = args;

  try {
    const response = await fetch(`${API_BASE_URL}/api/samples/${sampleId}`);
    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling API: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Start MCP server with stdio transport
 *
 * The MCP server acts as a pure gateway/relay to the Express API.
 */
export async function startMCPServer() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle errors
  server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}
