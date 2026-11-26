/** The MCP protocol itself (JSON-RPC 2.0 over «Streamable HTTP», answers as plain JSON): initialize, ping, tools/list, tools/call. */
import { DbError } from './rtdb';
import { TOOLS, ToolError, type Ctx } from './tools';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Plano is the owner's personal planner: tasks, a calendar, notes and habits.
- Dates are YYYY-MM-DD, times HH:MM, in the owner's time zone. Call «today» first when the current date matters.
- Call «planner_info» first: it gives today's date, the real project and category names and what the priorities mean.
- To add something, use «add» with «items»: fill in the title, date, time, project, category and priority yourself from what the person said (a task is a thing to do, an event is a meeting or anything at a set time). Pick a priority only when the words say so («терміново» = urgent, «важливо» = high, «не терміново» = low); otherwise leave it out. Use a project or category only if one that exists fits.
- Change or finish things by the exact id returned by list_tasks, today or add. Ask before deleting anything.
- Notes are Markdown.`;

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const ok = (id: RpcRequest['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: RpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function callTool(params: Record<string, unknown> | undefined, ctx: Ctx) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) return null;
  const args =
    params?.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? (params.arguments as Record<string, unknown>) : {};
  try {
    const result = await tool.run(args, ctx);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }], structuredContent: result };
  } catch (e) {
    if (e instanceof ToolError) return { isError: true, content: [{ type: 'text', text: e.message }] };
    // What Google or the database said (a status and a short reason): it helps to set things right, and holds nothing private.
    if (e instanceof DbError) return { isError: true, content: [{ type: 'text', text: `Plano could not reach its data. ${e.message}` }] };
    // Not shown to the assistant: it may hold details of the database.
    console.error('MCP tool failed', tool.name, e);
    return { isError: true, content: [{ type: 'text', text: 'Plano could not do that right now. Try again in a moment.' }] };
  }
}

/** One JSON-RPC message → its answer (null for a notification, which has none). */
export async function handleMessage(msg: RpcRequest, ctx: Ctx): Promise<unknown | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid request');
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case 'initialize': {
      const wanted = typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : '';
      return ok(msg.id, {
        protocolVersion: VERSIONS.includes(wanted) ? wanted : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'plano', title: 'Plano', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(msg.id, {});
    case 'tools/list':
      return ok(msg.id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { title: t.title, ...t.annotations },
        })),
      });
    case 'tools/call': {
      const result = await callTool(msg.params, ctx);
      return result ? ok(msg.id, result) : fail(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`);
    }
    default:
      // «notifications/initialized» and the like need no answer.
      return isNotification || msg.method.startsWith('notifications/') ? null : fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
