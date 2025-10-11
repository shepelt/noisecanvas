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

/**
 * Create and configure MCP server
 *
 * @param {object} services - Service instances
 * @param {PatternService} services.pattern - Pattern service
 * @param {SamplerService} services.sampler - Sampler service
 * @returns {Server} Configured MCP server
 */
export function createMCPServer(services) {
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
  setupToolHandlers(server, services);

  return server;
}

/**
 * Set up tool handlers
 */
function setupToolHandlers(server, services) {
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
          return await handlePlayNotes(services, args);

        case 'play_pattern':
          return await handlePlayPattern(services, args);

        case 'list_samples':
          return await handleListSamples(services);

        case 'get_sample_info':
          return await handleGetSampleInfo(services, args);

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
 * Calls the HTTP API instead of using services directly
 * This ensures the pattern goes to the shared queue that the browser polls
 */
async function handlePlayNotes(services, args) {
  // Note: Can't use console.log here - stdio is used for MCP communication

  const { notes, bpm, instrument, octave, volume } = args;

  // Call HTTP API instead of services directly
  try {
    const response = await fetch('http://localhost:3001/api/play-notes', {
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
 * Plays a tracker-style pattern with multi-channel support
 * Calls the HTTP API to ensure the pattern goes to the shared queue
 */
async function handlePlayPattern(services, args) {
  const { rows, bpm, speed, repeat } = args;

  try {
    const response = await fetch('http://localhost:3001/api/play-pattern', {
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
 * Calls the HTTP API to get the current list of samples
 */
async function handleListSamples(services) {
  try {
    const response = await fetch('http://localhost:3001/api/samples');
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
 * Calls the HTTP API to get sample info
 */
async function handleGetSampleInfo(services, args) {
  const { sampleId } = args;

  try {
    const response = await fetch(`http://localhost:3001/api/samples/${sampleId}`);
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
 * @param {object} services - Service instances
 */
export async function startMCPServer(services) {
  const server = createMCPServer(services);
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
