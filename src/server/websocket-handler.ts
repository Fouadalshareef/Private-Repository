import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';

import {
  EventDTO,
  EventType,
} from './dto/EventTypes.js';
import { CommandRequestDTO, CommandResponseDTO, CommandType } from './dto/CommandTypes.js';
import { AgentRuntime } from '../agent/agent-runtime.js';
import { MemoryBundle } from '../memory/types.js';
import { IToolRegistry } from '../tools/IToolRegistry.js';
import { AgentOrchestrator } from '../orchestrator/agent-orchestrator.js';

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
    this.setupEventSubscriptions();
    this.initializeWebSocketServer(config.port ?? 3001);
  }

  /**
   * Sets up event subscriptions from the core to broadcast to GUI clients.
   */
  private setupEventSubscriptions(): void {
    this.eventBus.subscribe('agent.execution.started', (data: any) => {
      this.broadcast({
        type: EventType.AgentStatus,
        sessionId: data.agentId,
        payload: { agentId: data.agentId, status: 'running' },
      });
    });

    this.eventBus.subscribe('agent.execution.completed', (data: any) => {
      this.broadcast({
        type: EventType.AgentStatus,
        sessionId: data.agentId,
        payload: { agentId: data.agentId, status: 'completed' },
      });
    });

    this.eventBus.subscribe('agent.execution.failed', (data: any) => {
      this.broadcast({
        type: EventType.AgentStatus,
        sessionId: data.agentId,
        payload: { agentId: data.agentId, status: 'failed', error: data.error },
      });
    });

    this.eventBus.subscribe('planner.tasktree.created', (data: any) => {
      this.broadcast({
        type: EventType.TaskTreeReady,
        payload: this.serializeTaskTree(data.taskTree),
      });
    });

    this.eventBus.subscribe('orchestrator.started', (data: any) => {
      this.broadcast({
        type: EventType.OrchestrationStarted,
        payload: { workflowId: data.workflowId },
      });
    });

    this.eventBus.subscribe('orchestrator.progress', (data: any) => {
      this.broadcast({
        type: EventType.OrchestrationProgress,
        payload: data,
      });
    });

    this.eventBus.subscribe('orchestrator.completed', (data: any) => {
      this.broadcast({
        type: EventType.OrchestrationProgress,
        payload: { ...data, completed: true },
      });
    });

    this.eventBus.subscribe('session.created', (data: any) => {
      this.broadcast({
        type: EventType.SessionUpdated,
        payload: this.serializeSessionInfo(data.session),
      });
    });

    this.eventBus.subscribe('session.updated', (data: any) => {
      this.broadcast({
        type: EventType.SessionUpdated,
        payload: this.serializeSessionInfo(data.session),
      });
    });

    this.eventBus.subscribe('tool.executed', (data: any) => {
      this.broadcast({
        type: EventType.ToolExecuted,
        payload: {
          toolName: data.tool.name,
          success: data.success,
          result: data.result,
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
    const json = JSON.stringify(event);
    this.wss.forEach((ws, id) => {
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
  private serializeAgentLifecycleState(state: any): AgentLifecycleStateDTO {
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
  private serializeTaskTree(tree: any): TaskTreeDTO {
    return {
      rootId: tree.rootId,
      nodes: tree.nodes.map((node: any) => ({
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
  private serializeSessionInfo(session: any): SessionInfoDTO {
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
  private serializeToolInfo(tool: any): ToolInfoDTO {
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
      const data = JSON.parse(message);

      if (!data || !data.command) {
        throw new Error('Missing command field');
      }

      switch (data.command) {
        case CommandType.Chat: {
          if (this.agentRuntime && data.sessionId) {
            const result = await this.agentRuntime.executeAgent(
              data.agentId ?? '',
              data.args?.prompt ?? ''
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
              data.args?.agentId ?? '',
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
            const plan = this.orchestrator.planTask(data.args?.prompt ?? '');
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
            const result = this.orchestrator.runOrchestration(data.args);
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
              data: this.memory?.listSessions(),
              timestamp: Date.now(),
            },
          }));
          break;

        case CommandType.SessionInfo: {
          const session = this.memory?.getSession(data.sessionId);
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
          this.memory?.clearSession(data.sessionId);
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
          requestId: data.requestId,
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
