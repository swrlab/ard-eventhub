import { createMcpHandler } from '@modelcontextprotocol/server'
import { liveSources } from './live.ts'
import { createEventhubMcpServer } from './server.ts'

/**
 * Stateless MCP endpoint for the connect process, mounted at `/mcp`.
 * Each request gets a fresh server. No session is kept open between calls.
 */
export const mcpHandler = createMcpHandler(() => createEventhubMcpServer(liveSources))
