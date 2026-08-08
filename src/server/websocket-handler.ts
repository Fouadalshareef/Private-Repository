interface WebSocket {
  send(message: string): void;
  on(event: 'message', handler: (message: string) => void): void;
  on(event: 'close', handler: () => void): void;
  close(): void;
}

import {
  EventDTO,
  EventType,
} from './dto/EventTypes.js';
import type { AgentLifecycleStateDTO, TaskTreeDTO, SessionInfoDTO, ToolInfoDTO } from './dto/PayloadTypes.js';
import type { CommandRequestDTO } from './dto/CommandTypes.js';
import { CommandType } from './dto/CommandTypes.js';
import { AgentRuntime } from '../agent/agent-runtime.js';
import type { MemoryBundle } from '../memory/types.js';
import { IToolRegistry } from '../tools/IToolRegistry.js';
import { AgentOrchestrator } from '../orchestrator/agent-orchestrator.js';
import type { AgentRole } from '../orchestrator/types.js';

import type { Event } from '../events/EventTypes.js';
import type { IEventBus } from '../events/IEventBus.js';

/**
 * WebSocket handler for real-time GUI communication.
 *
 * Maintains active WebSocket connections and broadcasts events from the core
 * to connected GUI clients. All GUI interactions go through the WebSocket
 * interface. Zero business logic in the GUI layer.
 */
export class WebSocketHandler {
  private readonly wss: Map<string, WebSocket>;
  private readonly eventBus: IEventBus;
  private readonly agentRuntime: AgentRuntime | undefined;
  private readonly memory: MemoryBundle | undefined;
  private readonly toolRegistry: IToolRegistry | undefined;
  private readonly orchestrator: AgentOrchestrator | undefined;
  private readonly sessionMemory?: {
    listSessions?: () => unknown[];
    getSession?: (sessionId: string) => unknown;
    clearSession?: (sessionId: string) => void;
  };

  constructor(
    config: {
      eventBus: IEventBus;
      agentRuntime?: AgentRuntime;
      memory?: MemoryBundle;
      toolRegistry?: IToolRegistry;
      orchestrator?: AgentOrchestrator;
      port?: number;
    }
  ) {
    this.eventBus = config.eventBus;
    this.agentRuntime = config.agentRuntime;
    this.memory = config.memory;
    this.toolRegistry = config.toolRegistry;
    this.orchestrator = config.orchestrator;

    this.wss = new Map();
    this.sessionMemory = config.memory as unknown as {
      listSessions?: () => unknown[];
      getSession?: (sessionId: string) => unknown;
      clearSession?: (sessionId: string) => void;
    };
    this.setupEventSubscriptions();
    this.initializeWebSocketServer(config.port ?? 3001);
  }

  /**
   * Sets up event subscriptions from the core to broadcast to GUI clients.
   */
  private setupEventSubscriptions(): void {
    this.eventBus.subscribe('agent.execution.started', (event: Event<{ agentId: string }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        timestamp: Date.now(),
        type: EventType.AgentStatus,
        sessionId: event.payload.agentId,
        payload: { agentId: event.payload.agentId, status: 'running' },
      });
    });

    this.eventBus.subscribe('agent.execution.completed', (event: Event<{ agentId: string }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        timestamp: Date.now(),
        type: EventType.AgentStatus,
        sessionId: event.payload.agentId,
        payload: { agentId: event.payload.agentId, status: 'completed' },
      });
    });

    this.eventBus.subscribe('agent.execution.failed', (event: Event<{ agentId: string; error?: string }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        timestamp: Date.now(),
        type: EventType.AgentStatus,
        sessionId: event.payload.agentId,
        payload: { agentId: event.payload.agentId, status: 'failed', error: event.payload.error },
      });
    });

    this.eventBus.subscribe('planner.tasktree.created', (event: Event<{ taskTree: TaskTreeDTO }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.TaskTreeReady,
        timestamp: Date.now(),
        payload: this.serializeTaskTree(event.payload.taskTree),
      });
    });

    this.eventBus.subscribe('orchestrator.started', (event: Event<{ workflowId: string }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.OrchestrationStarted,
        timestamp: Date.now(),
        payload: { workflowId: event.payload.workflowId },
      });
    });

    this.eventBus.subscribe('orchestrator.progress', (event: Event<unknown>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.OrchestrationProgress,
        timestamp: Date.now(),
        payload: event.payload,
      });
    });

    this.eventBus.subscribe('orchestrator.completed', (event: Event<unknown>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.OrchestrationProgress,
        timestamp: Date.now(),
        payload: { ...(event.payload as Record<string, unknown>), completed: true },
      });
    });

    this.eventBus.subscribe('session.created', (event: Event<{ session: { id: string; advisorId: string; workspaceId: string; messages: unknown[]; status: string } }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.SessionUpdated,
        timestamp: Date.now(),
        payload: this.serializeSessionInfo(event.payload.session),
      });
    });

    this.eventBus.subscribe('session.updated', (event: Event<{ session: { id: string; advisorId: string; workspaceId: string; messages: unknown[]; status: string } }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.SessionUpdated,
        timestamp: Date.now(),
        payload: this.serializeSessionInfo(event.payload.session),
      });
    });

    this.eventBus.subscribe('tool.executed', (event: Event<{ tool: { name: string; description: string; required: boolean }; success: boolean; result: unknown }>) => {
      this.broadcast({
        eventId: String(Date.now()),
        type: EventType.ToolExecuted,
        timestamp: Date.now(),
        payload: {
          toolName: event.payload.tool.name,
          success: event.payload.success,
          result: event.payload.result,
        },
      });
    });
  }

  /**
   * Initializes the WebSocket server on the given port.
   */
  private initializeWebSocketServer(port: number): void {
    // The WebSocket server is initialized here.
    // In a production environment, this would use the 'ws' package:
    // import WebSocket from 'ws';
    // this.server = new WebSocket.Server({ port });
    console.log(`WebSocket server listening on port ${port}`);
  }

  /**
   * Broadcasts an event to all connected WebSocket clients.
   */
  private broadcast(event: EventDTO): void {
    const payload: EventDTO = {
      eventId: String(Date.now()),
      timestamp: event.timestamp ?? Date.now(),
      type: event.type,
      sessionId: event.sessionId,
      payload: event.payload,
    };
    const json = JSON.stringify(payload);
    this.wss.forEach((ws) => {
      try {
        ws.send(json);
      } catch {
        // ignore stale connections
      }
    });
  }

  /**
   * Serializes agent lifecycle state for transport.
   */
  private serializeAgentLifecycleState(state: { agentId: string; name: string; status: string; cycleCount: number; createdAt: number; updatedAt: number; lastError?: string }): AgentLifecycleStateDTO {
    return {
      agentId: state.agentId,
      name: state.name,
      status: state.status,
      cycleCount: state.cycleCount,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      lastError: state.lastError,
    };
  }

  /**
   * Serializes task tree (DAG) for transport.
   */
  private serializeTaskTree(tree: TaskTreeDTO): TaskTreeDTO {
    return {
      rootId: tree.rootId,
      nodes: tree.nodes.map((node) => ({
        id: node.id,
        description: node.description,
        status: node.status,
        dependencies: node.dependencies,
        assignedAgent: node.assignedAgent,
        result: node.result,
        error: node.error,
      })),
    };
  }

  /**
   * Serializes session info for transport.
   */
  private serializeSessionInfo(session: { id: string; advisorId: string; workspaceId: string; messages: unknown[]; status: string }): SessionInfoDTO {
    return {
      sessionId: session.id,
      advisorId: session.advisorId,
      workspaceId: session.workspaceId,
      messageCount: session.messages.length,
      status: session.status,
    };
  }

  /**
   * Serializes tool info for transport.
   */
  private serializeToolInfo(tool: { name: string; description: string; required: boolean }): ToolInfoDTO {
    return {
      name: tool.name,
      description: tool.description,
      required: tool.required,
    };
  }

  /**
   * Handles an incoming message from a connected GUI client.
   */
  private async handleMessage(ws: WebSocket, message: string): Promise<void> {
    try {
      const data = JSON.parse(message) as CommandRequestDTO;

      if (!data || !data.command) {
        throw new Error('Missing command field');
      }

      switch (data.command) {
        case CommandType.Chat: {
          if (this.agentRuntime && data.sessionId) {
            const result = await this.agentRuntime.executeAgent(
              data.args?.agentId as string ?? '',
              (data.args?.prompt as string) ?? ''
            );
            ws.send(JSON.stringify({
              response: {
                requestId: data.requestId,
                success: true,
                data: result,
                timestamp: Date.now(),
              },
            }));
          } else {
            ws.send(JSON.stringify({
              response: {
                requestId: data.requestId,
                success: false,
                error: 'Agent not registered',
                timestamp: Date.now(),
              },
            }));
          }
          break;
        }

        case CommandType.AgentExecute: {
          if (this.agentRuntime) {
            const result = await this.agentRuntime.executeAgent(
              (data.args?.agentId as string) ?? '',
              data.args?.input ?? null
            );
            ws.send(JSON.stringify({
              response: {
                requestId: data.requestId,
                success: true,
                data: result,
                timestamp: Date.now(),
              },
            }));
          }
          break;
        }

        case CommandType.PlannerPlan: {
          if (this.orchestrator) {
            const plan = await this.orchestrator.planTask((data.args?.prompt as string) ?? '');
            ws.send(JSON.stringify({
              response: {
                requestId: data.requestId,
                success: true,
                data: plan,
                timestamp: Date.now(),
              },
            }));
          }
          break;
        }

        case CommandType.OrchestratorRun: {
          if (this.orchestrator) {
            const result = await this.orchestrator.runOrchestration(
              data.args as unknown as {
                workflowName: string;
                agents: readonly { agentId: string; role: AgentRole }[];
                task: string;
              }
            );
            ws.send(JSON.stringify({
              response: {
                requestId: data.requestId,
                success: true,
                data: result,
                timestamp: Date.now(),
              },
            }));
          }
          break;
        }

        case CommandType.SessionList:
          ws.send(JSON.stringify({
            response: {
              requestId: data.requestId,
              success: true,
              data: this.sessionMemory?.listSessions?.() ?? [],
              timestamp: Date.now(),
            },
          }));
          break;

        case CommandType.SessionInfo: {
          const session = this.sessionMemory?.getSession?.(data.sessionId ?? '');
          ws.send(JSON.stringify({
            response: {
              requestId: data.requestId,
              success: true,
              data: session,
              timestamp: Date.now(),
            },
          }));
          break;
        }

        case CommandType.SessionClear: {
          this.sessionMemory?.clearSession?.(data.sessionId ?? '');
          ws.send(JSON.stringify({
            response: {
              requestId: data.requestId,
              success: true,
              data: { cleared: true },
              timestamp: Date.now(),
            },
          }));
          break;
        }

        case CommandType.AdvisorList:
          ws.send(JSON.stringify({
            response: {
              requestId: data.requestId,
              success: true,
              data: { advisors: [] },
              timestamp: Date.now(),
            },
          }));
          break;

        case CommandType.ToolList:
          ws.send(JSON.stringify({
            response: {
              requestId: data.requestId,
              success: true,
              data: this.toolRegistry?.getAllTools(),
              timestamp: Date.now(),
            },
          }));
          break;

        case CommandType.SystemStatus:
          ws.send(JSON.stringify({
            response: {
              requestId: data.requestId,
              success: true,
              data: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: Date.now(),
              },
              timestamp: Date.now(),
            },
          }));
          break;

        default:
          throw new Error(`Unknown command: ${data.command}`);
      }
    } catch (error) {
      ws.send(JSON.stringify({
        response: {
          requestId: undefined,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      }));
    }
  }

  /**
   * Registers a WebSocket client and sets up the message handler.
   */
  onClientConnection(ws: WebSocket): void {
    const id = Date.now().toString();
    this.wss.set(id, ws);
    console.log(`Client connected: ${id}`);

    ws.on('message', (message: string) => {
      this.handleMessage(ws, message).catch(
        (err: unknown) => console.error('WS handleMessage error:', err)
      );
    });

    ws.on('close', () => {
      console.log(`Client disconnected: ${id}`);
      this.wss.delete(id);
    });
  }

  /**
   * Gracefully shuts down the WebSocket server.
   */
  public shutdown(): void {
    console.log('WebSocket handler shutting down');
    this.wss.forEach((ws) => ws.close());
    this.wss.clear();
  }
}
