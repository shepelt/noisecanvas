# Setting Up MCP Server with Claude Desktop

## Prerequisites

1. ✅ NoiseCanvas API server running (`npm run dev`)
2. ✅ Vite frontend running (`npm run dev:vite`)
3. ✅ Claude Desktop installed

## Step 1: Locate Claude Desktop Config File

The config file is at:
```
C:\Users\shepe\AppData\Roaming\Claude\claude_desktop_config.json
```

If the file doesn't exist, create it.

## Step 2: Add NoiseCanvas MCP Server Configuration

Open the config file and add the NoiseCanvas MCP server:

```json
{
  "mcpServers": {
    "noisecanvas": {
      "command": "node",
      "args": [
        "C:\\Users\\shepe\\noisecanvas\\server\\mcp-entry.js"
      ]
    }
  }
}
```

**Important Notes:**
- Use double backslashes (`\\`) in Windows paths
- Use the absolute path to your `mcp-entry.js` file
- If you already have other MCP servers configured, just add `noisecanvas` to the existing `mcpServers` object

### Example with Multiple Servers

If you already have other servers:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\allowed\\path"]
    },
    "noisecanvas": {
      "command": "node",
      "args": [
        "C:\\Users\\shepe\\noisecanvas\\server\\mcp-entry.js"
      ]
    }
  }
}
```

## Step 3: Restart Claude Desktop

1. **Close Claude Desktop completely** (not just minimize)
2. **Reopen Claude Desktop**
3. The MCP server will start automatically when Claude Desktop launches

## Step 4: Verify Connection

In Claude Desktop, you should see a small icon or indicator that shows MCP servers are connected. You can ask Claude:

> "What MCP tools do you have access to?"

Claude should respond with the NoiseCanvas tools:
- `play_notes` - Play a sequence of notes
- `list_samples` - List available samples
- `get_sample_info` - Get sample information

## Step 5: Test the Hello World

### Make sure servers are running:

**Terminal 1:** API Server
```bash
npm run dev
```

**Terminal 2:** Vite Frontend (with browser at http://localhost:3000/mcp-demo.html)
```bash
npm run dev:vite
```

### In Claude Desktop, try:

> "Please use the play_notes tool to play C, D, and E notes"

or

> "Play a C major scale for me"

You should:
1. See Claude call the `play_notes` MCP tool
2. See the response from the server
3. If the browser is open at http://localhost:3000/mcp-demo.html with "Initialize Audio" clicked, you'll hear the notes play!

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Desktop                                               │
│   ↓ (stdio)                                                  │
│ MCP Server (server/mcp-entry.js)                            │
│   ↓ (function call)                                          │
│ PatternService (server/services/PatternService.js)          │
│   ↓ (HTTP POST)                                              │
│ Express API (localhost:3001/api/play-notes)                 │
│   ↓ (HTTP response with pattern)                            │
│ Browser Client (localhost:3000)                             │
│   ↓ (Web Audio API)                                          │
│ 🔊 SOUND!                                                    │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### MCP Server Not Showing Up

1. Check the config file path is correct
2. Make sure you used double backslashes in Windows paths
3. Restart Claude Desktop completely
4. Check Claude Desktop logs (usually in the same directory as config)

### Tool Calls Work But No Sound

1. Make sure `npm run dev` is running (API server on port 3001)
2. Make sure `npm run dev:vite` is running (frontend on port 3000)
3. Open http://localhost:3000/mcp-demo.html in your browser
4. Click "Initialize Audio" button (required for browser autoplay policy)
5. Now try the MCP tool call again from Claude Desktop

### Connection Errors

If you see connection errors in Claude Desktop:
1. Check that Node.js is in your PATH
2. Try running the MCP server manually first:
   ```bash
   node server/mcp-entry.js
   ```
   It should wait for input (that's correct - it's using stdio)
3. Press Ctrl+C to stop it, then try Claude Desktop again

## Testing Without Browser

The MCP tools will work even without the browser open - they'll return the pattern data. But to actually HEAR the music, you need:

1. Browser at http://localhost:3000/mcp-demo.html
2. "Initialize Audio" clicked
3. Then the audio system is ready to play sounds

## Alternative: Manual Testing

You can also test the MCP server directly using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node server/mcp-entry.js
```

This opens a web UI where you can test MCP tools before connecting to Claude Desktop.

## Next Steps

Once connected, try asking Claude to:
- "Play a C major scale"
- "Play the notes C, E, G together" (chord)
- "Create a simple melody"
- "List all available samples"

Have fun making music with Claude! 🎵
