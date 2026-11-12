import { MAX_USER_MESSAGES, type ChatPart, type ConversationStatus, type Decision, type DraftView, type MessageRole, type TraceStep } from "@nexo/shared";
import type { Db } from "../db/client";
import { listDraftViews, listMessages, type ChatMessage, type Conversation } from "./repository";

/** Formatos JSON trocados com o navegador. */
export type MessageDto = {
  id: string;
  role: MessageRole;
  content: string;
  parts: ChatPart[];
  trace: TraceStep[];
  decision: Decision | null;
  createdAt: string;
};

export type ConversationDto = {
  id: string;
  status: ConversationStatus;
  handoffReason: string | null;
  userMessageCount: number;
  maxUserMessages: number;
  messages: MessageDto[];
  drafts: Record<string, DraftView>;
};

export function toMessageDto(message: ChatMessage): MessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    parts: message.parts,
    trace: message.trace,
    decision: message.decision,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationDto(db: Db, conversation: Conversation): ConversationDto {
  const drafts: Record<string, DraftView> = {};
  for (const draft of listDraftViews(db, conversation.id)) drafts[draft.id] = draft;
  return {
    id: conversation.id,
    status: conversation.status,
    handoffReason: conversation.handoffReason,
    userMessageCount: conversation.userMessageCount,
    maxUserMessages: MAX_USER_MESSAGES,
    messages: listMessages(db, conversation.id).map(toMessageDto),
    drafts,
  };
}
