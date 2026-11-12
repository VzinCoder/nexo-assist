import { toAISdkStream } from "@mastra/ai-sdk";
import {
  CONTEXT_MESSAGES,
  PROVIDER_ERROR_MESSAGES,
  classifyProviderError,
  collectTurn,
  streamNexoReply,
  type CollectedTurn,
  type ConversationStore,
  type DraftStore,
  type NexoAgent,
  type RawToolResult,
} from "@nexo/agent";
import type { ChatPart, ConversationStatus, TraceStep } from "@nexo/shared";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage, type UIMessageChunk } from "ai";
import { z } from "zod";
import { getSessionFromRequest } from "../auth/session";
import type { Db } from "../db/client";
import { toMessageDto, type MessageDto } from "./dto";
import { GATE_MESSAGES, decideChatGate } from "./gate";
import { createDbPorts } from "./ports";
import { appendMessage, appendUserMessage, getOwnedConversation, lastMessages } from "./repository";

export const chatBodySchema = z.object({
  conversationId: z.string().min(1).max(100),
  text: z.string().trim().min(1, "Escreva uma mensagem.").max(2000, "Mensagem longa demais (máx. 2000 caracteres)."),
});

/** Dados enviados ao navegador no fim do turno (a mensagem já gravada, com trace e decisão). */
export type TurnData = {
  message: MessageDto;
  conversation: { status: ConversationStatus; userMessageCount: number };
};
export type NexoUIMessage = UIMessage<never, { turn: TurnData }>;

export type ChatHandlerDeps = {
  getDb: () => Db;
  sessionSecret: string;
  hasApiKey: boolean;
  modelId: string;
  /** Cria o agent com as portas ligadas ao banco; só é chamado quando o gate libera. */
  createAgent: (ports: { drafts: DraftStore; conversations: ConversationStore }) => NexoAgent;
  now?: () => Date;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  conversation?: { status: ConversationStatus; userMessageCount: number },
): Response {
  return Response.json({ error: { code, message }, ...(conversation ? { conversation } : {}) }, { status });
}

/** Coleta os resultados de tools do stream mesmo que ele tenha terminado com erro. */
async function readToolResults(output: Awaited<ReturnType<typeof streamNexoReply>>): Promise<RawToolResult[]> {
  try {
    const chunks = await output.toolResults;
    return chunks.map((chunk) => ({ toolName: chunk.payload.toolName, args: chunk.payload.args, result: chunk.payload.result }));
  } catch {
    return [];
  }
}

async function readText(output: Awaited<ReturnType<typeof streamNexoReply>>): Promise<string> {
  try {
    return await output.text;
  } catch {
    return "";
  }
}

/**
 * `POST /api/chat`. Ordem (determinística, antes do modelo): sessão → posse → status → limite →
 * chave configurada. Só então grava a mensagem do funcionário, lê as últimas 12 do banco e chama o
 * agent; a resposta (texto, trace, decisão e partes) é gravada no fim do streaming.
 */
export function createChatHandler(deps: ChatHandlerDeps) {
  const now = deps.now ?? (() => new Date());

  return async function chat(request: Request): Promise<Response> {
    const session = await getSessionFromRequest(request, deps.sessionSecret, now());
    if (!session) return errorResponse(401, "unauthorized", "Sessão expirada. Entre novamente.");

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return errorResponse(400, "invalid_body", "Requisição inválida.");
    }
    const body = chatBodySchema.safeParse(raw);
    if (!body.success) return errorResponse(400, "invalid_body", body.error.issues[0]?.message ?? "Requisição inválida.");

    const db = deps.getDb();
    const conversation = getOwnedConversation(db, body.data.conversationId, session.employeeId);
    const gate = decideChatGate({ conversation, hasApiKey: deps.hasApiKey });
    const state = conversation ? { status: conversation.status, userMessageCount: conversation.userMessageCount } : undefined;
    switch (gate.type) {
      case "not_found":
        return errorResponse(404, "not_found", GATE_MESSAGES.not_found);
      case "not_agent":
        return errorResponse(409, `conversation_${gate.status}`, GATE_MESSAGES[gate.status], state);
      case "limit_reached":
        return errorResponse(409, "limit_reached", GATE_MESSAGES.limit_reached, state);
      case "not_configured":
        return errorResponse(503, "not_configured", GATE_MESSAGES.not_configured, state);
    }
    if (!conversation) return errorResponse(404, "not_found", GATE_MESSAGES.not_found);

    const appended = appendUserMessage(db, conversation.id, body.data.text, now());
    if (!appended) return errorResponse(409, "limit_reached", GATE_MESSAGES.limit_reached, state);

    const history = lastMessages(db, conversation.id, CONTEXT_MESSAGES).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const agent = deps.createAgent(createDbPorts(db, now));
    const sessionIds = { employeeId: session.employeeId, conversationId: conversation.id };

    const stream = createUIMessageStream<NexoUIMessage>({
      execute: async ({ writer }) => {
        const write = (chunk: UIMessageChunk) => {
          try {
            writer.write(chunk as never);
          } catch {
            // Navegador desconectou: seguimos consumindo o stream para gravar a resposta.
          }
        };
        const started = performance.now();
        let providerError: unknown = null;
        let output: Awaited<ReturnType<typeof streamNexoReply>> | null = null;

        try {
          output = await streamNexoReply(agent, { history, session: sessionIds });
          for await (const chunk of toAISdkStream(output, { from: "agent", version: "v7", sendFinish: false })) {
            const part = chunk as UIMessageChunk;
            if (part.type === "error") {
              providerError ??= new Error(part.errorText);
              continue;
            }
            write(part);
          }
          // `output.error` preserva o erro original (com statusCode); preferimos ele ao texto do chunk.
          if (output.error) providerError = output.error;
        } catch (error) {
          providerError ??= error;
        }

        const toolResults = output ? await readToolResults(output) : [];
        const text = output && !providerError ? await readText(output) : "";
        const turn: CollectedTurn = collectTurn({ text, toolResults });

        let content = turn.text;
        let trace: TraceStep[] = turn.trace;
        let parts: ChatPart[] = turn.parts;
        let decision = turn.decision;
        if (providerError) {
          const code = classifyProviderError(providerError);
          content = PROVIDER_ERROR_MESSAGES[code];
          trace = [
            ...turn.trace,
            {
              tool: "llm",
              label: "Chamou o modelo",
              input: { model: deps.modelId },
              output: null,
              durationMs: Math.round(performance.now() - started),
              error: code === "provider_rate_limited" ? "Limite de requisições do provedor (429)." : "Provedor do modelo indisponível.",
            },
          ];
          parts = [...turn.parts, { type: "notice", code }];
          decision = turn.decisionMissing ? { ...turn.decision, reason: "A resposta foi interrompida por falha do provedor do modelo." } : turn.decision;
        }

        const saved = appendMessage(
          db,
          { conversationId: conversation.id, role: "assistant", content, parts, trace, decision },
          now(),
        );
        const current = getOwnedConversation(db, conversation.id, session.employeeId);
        write({
          type: "data-turn",
          data: {
            message: toMessageDto(saved),
            conversation: {
              status: current?.status ?? conversation.status,
              userMessageCount: current?.userMessageCount ?? appended.userMessageCount,
            },
          },
        } as UIMessageChunk);
        write({ type: "finish" } as UIMessageChunk);
      },
      onError: () => "Não foi possível concluir a resposta.",
    });

    return createUIMessageStreamResponse({ stream });
  };
}
