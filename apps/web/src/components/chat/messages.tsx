"use client";

import type { ReactNode } from "react";
import { CircleCheck, Headset, UserRound } from "lucide-react";
import type { ChatPart, Decision, DraftView } from "@nexo/shared";
import type { MessageDto } from "@/chat/dto";
import { DraftCard, Notice, QuickOptions, TicketCard, TicketPicker, type DraftAction } from "./cards";
import { TraceChips, type ChipStep } from "./trace-panel";

/**
 * Quando há opções rápidas, a pergunta já aparece acima dos botões; se o texto do modelo termina
 * repetindo uma pergunta, essa última linha é omitida.
 */
export function withoutTrailingQuestion(text: string): string {
  const lines = text.trimEnd().split("\n");
  const last = lines.at(-1)?.trim() ?? "";
  if (lines.length > 1 && last.endsWith("?")) return lines.slice(0, -1).join("\n").trimEnd();
  return text;
}

export const ASK_ANALYST_TEXT = "Quero falar com um analista.";

/** Texto do modelo: só **negrito** é interpretado; o resto é texto puro (sem HTML). */
export function RichText({ text }: { text: string }) {
  const pieces = text.split(/\*\*(.+?)\*\*/g);
  return (
    <p className="whitespace-pre-line break-words">
      {pieces.map((piece, index) => (index % 2 === 1 ? <strong key={index} className="font-semibold">{piece}</strong> : piece))}
    </p>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[520px] whitespace-pre-line break-words rounded-[12px_12px_4px_12px] bg-ink px-4 py-[11px] text-[14.5px]/[21px] text-white">
        {text}
      </div>
    </div>
  );
}

function AgentBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[600px] flex-col gap-3 rounded-[4px_12px_12px_12px] bg-paper px-4 py-3 text-[14.5px]/[22px] text-ink outline outline-1 -outline-offset-[0.5px] outline-rule">
      {children}
    </div>
  );
}

type Interaction = {
  /** Esta é a resposta mais recente e a conversa está com o agent: botões ficam ativos. */
  active: boolean;
  drafts: Record<string, DraftView>;
  onSend: (text: string) => void;
  onDraftAction: (draftId: string, action: DraftAction) => Promise<string | null>;
};

/** Resposta do assistente: linha de trace, texto, opções e cards derivados das tools. */
export function AssistantMessage({
  content,
  parts,
  steps,
  decision,
  streaming = false,
  interaction,
}: {
  content: string;
  parts: ChatPart[];
  steps: ChipStep[];
  decision: Decision | null;
  streaming?: boolean;
  interaction: Interaction;
}) {
  const options = parts.find((part) => part.type === "options");
  const handedOff = parts.some((part) => part.type === "handoff");
  const offerAnalyst = !streaming && decision?.confidence === "low" && !handedOff;
  const others = parts.filter((part) => part.type !== "options");
  const text = options ? withoutTrailingQuestion(content) : content;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <TraceChips steps={steps} decision={streaming ? null : decision} />
      {text || options || streaming ? (
        <AgentBubble>
          {text ? <RichText text={text} /> : null}
          {streaming && !text ? <TypingDots /> : null}
          {options && options.type === "options" ? (
            <QuickOptions
              question={options.question}
              options={options.options}
              onPick={interaction.onSend}
              disabled={!interaction.active}
            />
          ) : null}
          {offerAnalyst ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!interaction.active}
                onClick={() => interaction.onSend(ASK_ANALYST_TEXT)}
                className="flex items-center gap-2 rounded-lg bg-paper px-3 py-[7px] text-[13.5px] font-medium text-ink outline outline-1 -outline-offset-[0.5px] outline-rule enabled:hover:outline-info/60 disabled:text-ink-3"
              >
                <Headset className="h-4 w-4" aria-hidden="true" />
                Falar com um analista
              </button>
            </div>
          ) : null}
        </AgentBubble>
      ) : null}
      {others.map((part, index) => (
        <PartView key={index} part={part} interaction={interaction} />
      ))}
    </div>
  );
}

function PartView({ part, interaction }: { part: ChatPart; interaction: Interaction }) {
  switch (part.type) {
    case "ticket":
      return <TicketCard ticket={part.ticket} />;
    case "tickets":
      return <TicketPicker tickets={part.tickets} onPick={interaction.onSend} disabled={!interaction.active} />;
    case "draft":
      return <DraftCard draft={interaction.drafts[part.draftId]} onAction={interaction.onDraftAction} />;
    case "handoff":
      return (
        <p className="flex items-center gap-2 text-[13px] text-ink-3">
          <Headset className="h-4 w-4" aria-hidden="true" />
          Conversa transferida para um analista · {part.reason}
        </p>
      );
    case "notice":
      return <Notice code={part.code} />;
    case "options":
      return null;
  }
}

/** Mensagem do sistema (ex.: chamado criado após Confirmar). */
function SystemMessage({ message }: { message: MessageDto }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <CircleCheck className="h-3.5 w-3.5 text-green-ink" aria-hidden="true" />
        {message.content}
      </p>
      {message.parts.map((part, index) => (part.type === "ticket" ? <TicketCard key={index} ticket={part.ticket} /> : null))}
    </div>
  );
}

function AnalystMessage({ message }: { message: MessageDto }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
        <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Analista
      </p>
      <AgentBubble>
        <RichText text={message.content} />
      </AgentBubble>
    </div>
  );
}

export function StoredMessage({ message, interaction }: { message: MessageDto; interaction: Interaction }) {
  if (message.role === "user") return <UserBubble text={message.content} />;
  if (message.role === "system") return <SystemMessage message={message} />;
  if (message.role === "analyst") return <AnalystMessage message={message} />;
  return (
    <AssistantMessage
      content={message.content}
      parts={message.parts}
      steps={message.trace}
      decision={message.decision}
      interaction={interaction}
    />
  );
}

export function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1.5" role="status" aria-label="O assistente está respondendo">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40 motion-reduce:animate-none"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}
