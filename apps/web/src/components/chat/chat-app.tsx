"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, ChevronRight, Headset, LoaderCircle, MessageSquarePlus, X } from "lucide-react";
import type { NexoUIMessage } from "@/chat/chat-handler";
import type { ConversationDto } from "@/chat/dto";
import { Notice, type DraftAction, type NoticeCode } from "./cards";
import { AssistantMessage, StoredMessage, UserBubble } from "./messages";
import { streamingSteps, streamingText } from "./streaming";

/** Erro de requisição com o código devolvido pela API. */
class ChatRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function goToLogin(): never {
  window.location.assign("/login");
  throw new ChatRequestError("unauthorized", "Sessão expirada.");
}

async function readError(response: Response): Promise<ChatRequestError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ChatRequestError(body.error?.code ?? `http_${response.status}`, body.error?.message ?? "Não foi possível concluir.");
  } catch {
    return new ChatRequestError(`http_${response.status}`, "Não foi possível concluir.");
  }
}

/** `fetch` do transporte: 401 leva ao login; erros da API viram `ChatRequestError` com a mensagem dela. */
const chatFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) goToLogin();
  if (!response.ok) throw await readError(response);
  return response;
};

type ActiveNotice = { code: NoticeCode; message?: string };

function noticeFor(error: unknown): ActiveNotice {
  if (error instanceof ChatRequestError) {
    if (error.code === "not_configured") return { code: "not_configured", message: error.message };
    return { code: "generic", message: error.message };
  }
  if (error instanceof TypeError) return { code: "network" };
  return { code: "generic" };
}

function lastUserText(messages: NexoUIMessage[]): string {
  const last = [...messages].reverse().find((message) => message.role === "user");
  return last ? streamingText(last.parts) : "";
}

const SUGGESTIONS = [
  "Minha VPN não conecta, aparece o erro 809",
  "Qual o status do meu chamado?",
  "Preciso de acesso a um sistema",
  "Quero falar com um analista",
];

export function ChatApp({ initial, firstName }: { initial: ConversationDto; firstName: string }) {
  const [conversation, setConversation] = useState<ConversationDto>(initial);
  const [notice, setNotice] = useState<ActiveNotice | null>(null);
  const [input, setInput] = useState("");
  const [startingNew, setStartingNew] = useState(false);
  const conversationIdRef = useRef(initial.id);
  const lastSentRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (): Promise<ConversationDto | null> => {
    const response = await fetch("/api/conversations/current", { cache: "no-store" });
    if (response.status === 401) goToLogin();
    if (!response.ok) throw await readError(response);
    const dto = (await response.json()) as ConversationDto;
    conversationIdRef.current = dto.id;
    setConversation(dto);
    return dto;
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<NexoUIMessage>({
        api: "/api/chat",
        fetch: chatFetch,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { conversationId: conversationIdRef.current, text: lastUserText(messages) },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat<NexoUIMessage>({
    transport,
    onFinish: async () => {
      try {
        await refresh();
      } catch (error) {
        setNotice(noticeFor(error));
      }
      setMessages([]);
    },
    onError: async (error) => {
      setNotice(noticeFor(error));
      // Nada foi gravado (ex.: limite, não configurado): devolve o texto ao campo.
      if (error instanceof ChatRequestError) setInput((current) => current || lastSentRef.current);
      try {
        await refresh();
      } catch {
        // mantém o histórico que já está na tela
      }
      setMessages([]);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const transferred = conversation.status === "waiting_human" || conversation.status === "with_human";
  const limitReached = conversation.userMessageCount >= conversation.maxUserMessages;
  const canSend = conversation.status === "agent" && !busy && !limitReached;

  // Enquanto estiver com analista, acompanha o estado sem recarregar a página.
  useEffect(() => {
    if (!transferred) return;
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [transferred, refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [conversation.messages.length, messages]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      lastSentRef.current = trimmed;
      setNotice(null);
      setInput("");
      void sendMessage({ text: trimmed });
    },
    [canSend, sendMessage],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(input);
  };

  const startNewConversation = async () => {
    setStartingNew(true);
    try {
      const response = await fetch("/api/conversations", { method: "POST" });
      if (response.status === 401) goToLogin();
      if (!response.ok) throw await readError(response);
      const dto = (await response.json()) as ConversationDto;
      conversationIdRef.current = dto.id;
      setConversation(dto);
      setMessages([]);
      setNotice(null);
    } catch (error) {
      setNotice(noticeFor(error));
    }
    setStartingNew(false);
  };

  const onDraftAction = useCallback(
    async (draftId: string, action: DraftAction): Promise<string | null> => {
      try {
        const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/${action}`, { method: "POST" });
        if (response.status === 401) goToLogin();
        if (!response.ok) {
          const error = await readError(response);
          if (response.status === 409) await refresh();
          return error.message;
        }
        await refresh();
        return null;
      } catch (error) {
        return error instanceof TypeError ? "Sem conexão. Tente de novo." : "Não foi possível concluir.";
      }
    },
    [refresh],
  );

  const lastAssistantId = [...conversation.messages].reverse().find((message) => message.role === "assistant")?.id;
  const interactionFor = (messageId: string) => ({
    active: messageId === lastAssistantId && canSend && messages.length === 0,
    drafts: conversation.drafts,
    onSend: send,
    onDraftAction,
  });

  const streamingAssistant = messages.find((message) => message.role === "assistant");
  const isEmpty = conversation.messages.length === 0 && messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-rule px-4 sm:px-8">
        <nav aria-label="Você está em" className="flex flex-1 items-center gap-2 text-[13.5px]">
          <span className="text-ink-3">Service desk de TI</span>
          <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
          <span className="font-semibold text-ink">Atendimento</span>
        </nav>
        <StatusPill status={conversation.status} busy={busy} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex min-h-full w-full max-w-[848px] flex-col justify-end gap-5 px-4 pb-1 pt-7 sm:px-5">
          {isEmpty ? <EmptyState firstName={firstName} onPick={send} disabled={!canSend} /> : null}
          {conversation.messages.map((message) => (
            <StoredMessage key={message.id} message={message} interaction={interactionFor(message.id)} />
          ))}
          {messages.map((message) =>
            message.role === "user" ? (
              <UserBubble key={message.id} text={streamingText(message.parts)} />
            ) : message.role === "assistant" ? (
              <AssistantMessage
                key={message.id}
                content={streamingText(message.parts)}
                parts={[]}
                steps={streamingSteps(message.parts)}
                decision={null}
                streaming
                interaction={interactionFor("")}
              />
            ) : null,
          )}
          {busy && !streamingAssistant ? (
            <AssistantMessage content="" parts={[]} steps={[]} decision={null} streaming interaction={interactionFor("")} />
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[848px] shrink-0 flex-col gap-1.5 px-4 pb-[18px] pt-2.5 sm:px-5">
        {notice ? (
          <div className="relative w-full max-w-[600px]">
            <Notice code={notice.code} message={notice.message} />
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="absolute right-2 top-2 rounded p-1 text-ink-3 hover:bg-ink/[0.05]"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        {transferred ? <TransferBanner status={conversation.status} reason={conversation.handoffReason} /> : null}
        {limitReached && !transferred ? (
          <p className="rounded-xl bg-desk px-3.5 py-3 text-[13.5px]/5 text-ink-2">
            Esta conversa chegou ao limite de {conversation.maxUserMessages} mensagens. Comece uma nova conversa para continuar.
          </p>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="flex h-12 items-center gap-2 rounded-xl bg-paper pl-4 pr-1.5 outline outline-1 -outline-offset-[0.5px] outline-ink/[0.12] focus-within:outline-[1.5px] focus-within:outline-cta has-[input:disabled]:bg-desk"
        >
          <label htmlFor="composer" className="sr-only">
            Mensagem
          </label>
          <input
            id="composer"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={conversation.status !== "agent" || limitReached}
            maxLength={2000}
            autoComplete="off"
            placeholder={
              transferred
                ? "O assistente está pausado enquanto um analista atende"
                : limitReached
                  ? "Limite de mensagens atingido"
                  : "Escreva para o Nexo…"
            }
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!canSend || input.trim() === ""}
            className="flex h-9 items-center gap-1.5 rounded-md bg-cta px-3 text-[13.5px] font-semibold text-white hover:bg-[#0057ad] disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
            Enviar
          </button>
        </form>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void startNewConversation()}
            disabled={busy || startingNew}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium disabled:opacity-50 ${
              limitReached ? "bg-cta text-white hover:bg-[#0057ad]" : "text-ink-3 hover:bg-ink/[0.05] hover:text-ink"
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            Nova conversa
          </button>
          <p className="text-[12.5px] tabular-nums text-ink-3">
            {conversation.userMessageCount} de {conversation.maxUserMessages} mensagens nesta conversa
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, busy }: { status: ConversationDto["status"]; busy: boolean }) {
  const style =
    status === "agent"
      ? { box: "bg-green/[0.08]", dot: "bg-green", text: "text-green-ink", label: busy ? "Assistente respondendo" : "Assistente online" }
      : status === "waiting_human"
        ? { box: "bg-amber/[0.1]", dot: "bg-amber", text: "text-amber-ink", label: "Aguardando analista" }
        : status === "with_human"
          ? { box: "bg-info/[0.08]", dot: "bg-info", text: "text-link", label: "Com analista" }
          : { box: "bg-ink/[0.05]", dot: "bg-ink/40", text: "text-ink-3", label: "Encerrada" };
  return (
    <span className={`flex items-center gap-[7px] rounded-full px-2.5 py-[5px] ${style.box}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${style.dot} ${busy ? "animate-pulse motion-reduce:animate-none" : ""}`} aria-hidden="true" />
      <span className={`text-[12.5px] font-semibold ${style.text}`}>{style.label}</span>
    </span>
  );
}

function TransferBanner({ status, reason }: { status: ConversationDto["status"]; reason: string | null }) {
  const waiting = status === "waiting_human";
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl px-4 py-3 outline outline-1 -outline-offset-[0.5px] ${
        waiting ? "bg-amber/[0.08] outline-amber/30" : "bg-info/[0.06] outline-info/25"
      }`}
    >
      <Headset className={`mt-0.5 h-4 w-4 shrink-0 ${waiting ? "text-amber-ink" : "text-link"}`} aria-hidden="true" />
      <div className="text-[13.5px]/5">
        <p className={`font-semibold ${waiting ? "text-amber-ink" : "text-link"}`}>
          {waiting ? "Aguardando um analista" : "Em atendimento com analista"}
        </p>
        <p className="text-ink-2">
          {waiting
            ? "Passamos um resumo do caso para a equipe. Um analista vai continuar por aqui; enquanto isso o assistente fica pausado."
            : "Um analista está cuidando do seu caso nesta conversa."}
          {reason ? <span className="text-ink-3"> Motivo: {reason}</span> : null}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ firstName, onPick, disabled }: { firstName: string; onPick: (text: string) => void; disabled: boolean }) {
  return (
    <section className="flex flex-col gap-5 pb-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[34px]/[40px] tracking-[-0.6px] text-ink">Olá, {firstName}. O que está acontecendo?</h1>
        <p className="max-w-[560px] text-[14.5px]/[22px] text-ink-3">
          Conte o problema com suas palavras. Eu consulto seus chamados e a central de ajuda, preparo o chamado para você
          confirmar e chamo um analista quando for preciso.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Sugestões para começar">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className="rounded-lg bg-paper px-3 py-[7px] text-[13.5px] font-medium text-ink outline outline-1 -outline-offset-[0.5px] outline-rule hover:outline-info/60 disabled:text-ink-3"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}
