"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  CircleAlert,
  Headset,
  Inbox,
  LoaderCircle,
  LogOut,
  MessagesSquare,
  RefreshCw,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type ConversationStatus,
  type TicketSummary,
} from "@nexo/shared";
import type { ConsoleConversationDto, ConsoleListItemDto } from "@/console/console-handler";
import type { ConsoleAction } from "@/console/transitions";
import { NexoMark } from "@/components/nexo-mark";
import { StoredMessage } from "@/components/chat/messages";
import { STATUS_DOT, formatDayMonth, formatDue, initials } from "@/components/chat/format";
import { OverdueSeal } from "@/components/chat/cards";

const POLL_MS = 3000;

type FilterKey = "open" | "waiting_human" | "with_human" | "agent" | "closed" | "all";
const FILTERS: { key: FilterKey; label: string; query: string }[] = [
  { key: "open", label: "Para atender", query: "waiting_human,with_human" },
  { key: "waiting_human", label: "Aguardando", query: "waiting_human" },
  { key: "with_human", label: "Em atendimento", query: "with_human" },
  { key: "agent", label: "Com o agent", query: "agent" },
  { key: "closed", label: "Encerradas", query: "closed" },
  { key: "all", label: "Todas", query: "all" },
];

const STATUS_STYLE: Record<ConversationStatus, { label: string; box: string; dot: string; text: string }> = {
  waiting_human: { label: "Aguardando analista", box: "bg-amber/[0.1]", dot: "bg-amber", text: "text-amber-ink" },
  with_human: { label: "Em atendimento", box: "bg-info/[0.08]", dot: "bg-info", text: "text-link" },
  agent: { label: "Com o agent", box: "bg-green/[0.08]", dot: "bg-green", text: "text-green-ink" },
  closed: { label: "Encerrada", box: "bg-ink/[0.05]", dot: "bg-ink/40", text: "text-ink-3" },
};

const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

type ApiError = { code: string; message: string };

async function call<T>(input: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const response = await fetch(input, { cache: "no-store", ...init });
    if (response.status === 401) {
      window.location.assign("/login");
      return { ok: false, error: { code: "unauthorized", message: "Sessão expirada." } };
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object"
          ? (body.error as Partial<ApiError>)
          : {};
      return { ok: false, error: { code: error.code ?? `http_${response.status}`, message: error.message ?? "Não foi possível concluir." } };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: { code: "network", message: "Sem conexão. Tentando de novo…" } };
  }
}

const NOOP_INTERACTION = {
  active: false,
  drafts: {},
  onSend: () => undefined,
  onDraftAction: async () => "Só o funcionário pode confirmar o rascunho.",
};

function displayName(item: { employeeName: string | null; employeeId: string }): string {
  return item.employeeName ?? item.employeeId;
}

export function ConsoleApp({ analystName, roleLabel }: { analystName: string; roleLabel: string }) {
  const [filter, setFilter] = useState<FilterKey>("open");
  const [list, setList] = useState<ConsoleListItemDto[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = FILTERS.find((item) => item.key === filter)?.query ?? "all";
  const loadList = useCallback(async () => {
    const result = await call<{ conversations: ConsoleListItemDto[] }>(`/api/console/conversations?status=${query}`);
    if (result.ok) {
      setList(result.data.conversations);
      setListError(null);
    } else {
      setListError(result.error.message);
    }
  }, [query]);

  useEffect(() => {
    setList(null);
    void loadList();
    const timer = window.setInterval(() => void loadList(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList]);

  const waitingCount = list?.filter((item) => item.status === "waiting_human").length ?? 0;

  return (
    <div className="flex h-dvh bg-paper">
      <Rail analystName={analystName} waitingCount={filter === "open" ? waitingCount : 0} />

      <section
        aria-label="Conversas"
        className={`flex w-full shrink-0 flex-col border-r border-rule lg:w-[380px] ${selectedId ? "hidden lg:flex" : "flex"}`}
      >
        <header className="flex flex-col gap-3.5 px-4 pb-3 pt-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-bold tracking-[-0.3px] text-ink">Conversas</h1>
            <span className="text-[12.5px] text-ink-3">
              {analystName.split(" ")[0]} · {roleLabel}
            </span>
          </div>
          <div role="tablist" aria-label="Filtrar por status" className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                role="tab"
                type="button"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ${
                  filter === item.key ? "bg-info/[0.08] text-link" : "text-ink-2 hover:bg-ink/[0.04]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {listError ? (
            <p className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-danger/[0.06] px-3 py-2 text-[12.5px] text-danger-ink" role="alert">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {listError}
            </p>
          ) : null}
          {list === null ? (
            <ListSkeleton />
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Inbox className="h-6 w-6 text-ink-3" aria-hidden="true" />
              <p className="text-[14px] font-semibold text-ink">Nada por aqui</p>
              <p className="text-[13px] text-ink-3">Nenhuma conversa neste filtro. A lista atualiza sozinha a cada 3 s.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {list.map((item) => (
                <li key={item.id}>
                  <ListItem item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {selectedId ? (
        <ConversationPane key={selectedId} id={selectedId} onBack={() => setSelectedId(null)} onChanged={loadList} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-2 bg-desk text-center lg:flex">
          <MessagesSquare className="h-7 w-7 text-ink-3" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-ink">Selecione uma conversa</p>
          <p className="max-w-[320px] text-[13.5px] text-ink-3">Veja o histórico com as decisões do agent, assuma o atendimento e responda.</p>
        </div>
      )}
    </div>
  );
}

function Rail({ analystName, waitingCount }: { analystName: string; waitingCount: number }) {
  return (
    <nav aria-label="Principal" className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-rule bg-desk py-4 md:flex">
      <span className="flex h-10 w-10 items-center justify-center">
        <NexoMark className="h-[19px] w-[22px]" color="#1B2431" />
      </span>
      <span
        aria-current="page"
        title="Conversas"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-paper text-link shadow-[0_1px_2px_#1B24310D]"
      >
        <MessagesSquare className="h-[18px] w-[18px]" aria-hidden="true" />
        {waitingCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-cta px-1 text-[10px] font-bold text-white">
            {waitingCount}
          </span>
        ) : null}
      </span>
      <div className="flex-1" />
      <span title={analystName} className="flex h-9 w-9 items-center justify-center rounded-full bg-info/[0.07] text-[12.5px] font-bold text-link">
        {initials(analystName)}
      </span>
      <form action="/api/auth/logout" method="post">
        <button type="submit" title="Sair" aria-label="Sair" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-ink/[0.05]">
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </nav>
  );
}

function ListItem({ item, selected, onSelect }: { item: ConsoleListItemDto; selected: boolean; onSelect: () => void }) {
  const name = displayName(item);
  const last = item.lastMessage;
  const prefix = last?.role === "assistant" ? "Nexo: " : last?.role === "analyst" ? "Você: " : "";
  const tag =
    item.status === "waiting_human"
      ? { text: `Transferida${item.handoffReason ? ` · ${item.handoffReason}` : ""}`, className: "text-danger-ink" }
      : item.status === "with_human"
        ? { text: `Em atendimento${item.analystName ? ` · ${item.analystName}` : ""}`, className: "text-link" }
        : { text: STATUS_STYLE[item.status].label, className: "text-ink-3" };
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left ${selected ? "bg-desk" : "hover:bg-desk/70"}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/[0.1] text-[14.5px] font-semibold text-cta">
        {initials(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{name}</span>
          <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{timeFormat.format(new Date(item.updatedAt))}</span>
        </span>
        <span className="truncate text-[13.5px] text-ink-3">{last ? `${prefix}${last.content}` : "Sem mensagens"}</span>
        <span className={`truncate text-[11.5px] font-medium ${tag.className}`}>{tag.text}</span>
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-1" aria-busy="true" aria-label="Carregando conversas">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 rounded-xl px-3 py-3 motion-reduce:animate-none">
          <span className="h-10 w-10 rounded-full bg-ink/[0.06]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-1/2 rounded bg-ink/[0.06]" />
            <span className="h-3 w-4/5 rounded bg-ink/[0.05]" />
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`flex shrink-0 items-center gap-[7px] rounded-full px-2.5 py-[5px] ${style.box}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${style.dot}`} aria-hidden="true" />
      <span className={`text-[12.5px] font-semibold ${style.text}`}>{style.label}</span>
    </span>
  );
}

const ACTION_LABELS: Record<ConsoleAction, string> = {
  assume: "Assumir atendimento",
  return: "Devolver ao agent",
  close: "Encerrar",
};

function ConversationPane({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => Promise<void> }) {
  const [conversation, setConversation] = useState<ConsoleConversationDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<ConsoleAction | "send" | null>(null);
  const [text, setText] = useState("");
  const [showTickets, setShowTickets] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const result = await call<ConsoleConversationDto>(`/api/console/conversations/${encodeURIComponent(id)}`);
    if (result.ok) {
      setConversation(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error.message);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const messageCount = conversation?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  const runAction = async (action: ConsoleAction) => {
    if (action === "close" && !window.confirm("Encerrar esta conversa? O funcionário verá que o atendimento terminou.")) return;
    setPending(action);
    setNotice(null);
    const result = await call<ConsoleConversationDto>(`/api/console/conversations/${encodeURIComponent(id)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (result.ok) setConversation(result.data);
    else setNotice(result.error.message);
    await Promise.all([load(), onChanged()]);
    setPending(null);
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setPending("send");
    setNotice(null);
    const result = await call(`/api/console/conversations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (result.ok) setText("");
    else setNotice(result.error.message);
    await Promise.all([load(), onChanged()]);
    setPending(null);
  };

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-desk text-center">
        {loadError ? (
          <>
            <CircleAlert className="h-6 w-6 text-danger-ink" aria-hidden="true" />
            <p className="text-[14px] text-ink-2">{loadError}</p>
            <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-link hover:bg-info/[0.06]">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Tentar de novo
            </button>
          </>
        ) : (
          <LoaderCircle className="h-6 w-6 animate-spin text-ink-3" aria-label="Carregando conversa" />
        )}
      </div>
    );
  }

  const name = displayName(conversation);
  const status = conversation.status;
  const firstName = name.split(" ")[0] ?? name;
  const busy = pending !== null;

  return (
    <>
      <section aria-label={`Conversa com ${name}`} className="flex min-w-0 flex-1 flex-col bg-desk">
        <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-rule bg-paper px-4 py-3 sm:px-5">
          <button type="button" onClick={onBack} aria-label="Voltar para a lista" className="rounded-lg p-1.5 text-ink-2 hover:bg-ink/[0.05] lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/[0.1] text-[14.5px] font-semibold text-cta">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-semibold text-ink">{name}</p>
            <p className="truncate text-[12.5px] text-ink-3">
              {conversation.employeeId}
              {conversation.analystName ? ` · com ${conversation.analystName}` : ""}
            </p>
          </div>
          <StatusBadge status={status} />
          {status === "with_human" ? (
            <ActionButton action="return" pending={pending} disabled={busy} onClick={runAction} variant="secondary" />
          ) : null}
          {status !== "closed" ? (
            <ActionButton action="close" pending={pending} disabled={busy} onClick={runAction} variant="danger" />
          ) : null}
          <button
            type="button"
            onClick={() => setShowTickets((value) => !value)}
            aria-pressed={showTickets}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 outline outline-1 -outline-offset-[0.5px] outline-ink/[0.12] hover:bg-desk xl:hidden"
          >
            <TicketIcon className="h-4 w-4" aria-hidden="true" /> Chamados
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-end gap-5 px-4 pb-2 pt-6 sm:px-6">
            {conversation.handoffSummary ? <HandoffSummary reason={conversation.handoffReason} summary={conversation.handoffSummary} /> : null}
            {conversation.messages.length === 0 ? (
              <p className="py-10 text-center text-[13.5px] text-ink-3">Esta conversa ainda não tem mensagens.</p>
            ) : null}
            {conversation.messages.map((message) => (
              <StoredMessage key={message.id} message={message} interaction={{ ...NOOP_INTERACTION, drafts: conversation.drafts }} />
            ))}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-rule bg-paper px-4 py-3 sm:px-5">
          {notice ? (
            <p role="alert" className="mb-2 flex items-center gap-2 rounded-lg bg-danger/[0.06] px-3 py-2 text-[13px] text-danger-ink">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {notice}
              <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="ml-auto rounded p-0.5 hover:bg-danger/[0.08]">
                <X className="h-3.5 w-3.5" />
              </button>
            </p>
          ) : null}
          {status === "with_human" ? (
            <form onSubmit={send} className="flex h-12 items-center gap-2 rounded-xl bg-paper pl-4 pr-1.5 outline outline-1 -outline-offset-[0.5px] outline-ink/[0.12] focus-within:outline-[1.5px] focus-within:outline-cta">
              <label htmlFor="analyst-composer" className="sr-only">
                Mensagem para {firstName}
              </label>
              <input
                id="analyst-composer"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={2000}
                autoComplete="off"
                placeholder={`Responder para ${firstName}…`}
                className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="submit"
                disabled={busy || text.trim() === ""}
                className="flex h-9 items-center gap-1.5 rounded-md bg-cta px-3 text-[13.5px] font-semibold text-white hover:bg-[#0057ad] disabled:opacity-50"
              >
                {pending === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
                Enviar
              </button>
            </form>
          ) : status === "closed" ? (
            <p className="py-2 text-center text-[13.5px] text-ink-3">Conversa encerrada. O funcionário pode iniciar uma nova pelo chat.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/[0.12] text-amber-ink">
                {status === "waiting_human" ? <Headset className="h-4 w-4" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-ink">
                  {status === "waiting_human" ? `${firstName} espera um analista` : "O agent está atendendo"}
                </p>
                <p className="text-[12.5px] text-ink-3">
                  {status === "waiting_human" ? "Agent pausado. Assuma o atendimento para responder." : "Assumir pausa o agent e passa a conversa para você."}
                </p>
              </div>
              <ActionButton action="assume" pending={pending} disabled={busy} onClick={runAction} variant="primary" />
            </div>
          )}
        </div>
      </section>

      <TicketsPanel id={id} firstName={firstName} open={showTickets} onClose={() => setShowTickets(false)} />
    </>
  );
}

function ActionButton({
  action,
  pending,
  disabled,
  onClick,
  variant,
}: {
  action: ConsoleAction;
  pending: ConsoleAction | "send" | null;
  disabled: boolean;
  onClick: (action: ConsoleAction) => void;
  variant: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "bg-cta text-white hover:bg-[#0057ad] font-semibold",
    secondary: "text-ink-2 outline outline-1 -outline-offset-[0.5px] outline-ink/[0.12] hover:bg-desk font-medium",
    danger: "bg-danger/[0.07] text-danger-ink hover:bg-danger/[0.12] font-medium",
  }[variant];
  return (
    <button type="button" disabled={disabled} onClick={() => onClick(action)} className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] disabled:opacity-50 ${styles}`}>
      {pending === action ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {ACTION_LABELS[action]}
    </button>
  );
}

function HandoffSummary({ reason, summary }: { reason: string | null; summary: string }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3.5 outline outline-1 -outline-offset-[0.5px] outline-amber/40">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.4px] text-amber-ink">
        <Headset className="h-3.5 w-3.5" aria-hidden="true" /> Resumo da transferência
      </p>
      {reason ? <p className="mt-1.5 text-[13.5px] text-ink-2">Motivo: {reason}</p> : null}
      <p className="mt-1 whitespace-pre-line text-[14px]/[21px] text-ink">{summary}</p>
    </div>
  );
}

function TicketsPanel({ id, firstName, open, onClose }: { id: string; firstName: string; open: boolean; onClose: () => void }) {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await call<{ tickets: TicketSummary[] }>(`/api/console/conversations/${encodeURIComponent(id)}/tickets`);
    if (result.ok) setTickets(result.data.tickets);
    else setError(result.error.message);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = tickets?.filter((ticket) => ticket.status !== "resolved" && ticket.status !== "closed") ?? [];
  const done = tickets?.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed") ?? [];

  return (
    <aside
      aria-label={`Chamados de ${firstName}`}
      className={`${open ? "fixed inset-y-0 right-0 z-20 flex shadow-[0_6px_24px_#1B243126]" : "hidden"} w-[340px] max-w-full shrink-0 flex-col border-l border-rule bg-paper xl:static xl:flex xl:shadow-none`}
    >
      <header className="flex items-center gap-2 px-5 pb-3 pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15.5px] font-semibold text-ink">Chamados de {firstName}</h2>
          {tickets ? (
            <p className="text-[12.5px] text-ink-3">
              {active.length} {active.length === 1 ? "aberto" : "abertos"} · {done.length} {done.length === 1 ? "encerrado" : "encerrados"}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => void load()} aria-label="Atualizar chamados" className="rounded-lg p-2 text-ink-3 hover:bg-ink/[0.05]">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-ink-3 hover:bg-ink/[0.05] xl:hidden">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {error ? (
          <div role="alert" className="rounded-lg bg-danger/[0.06] px-3 py-2.5 text-[13px] text-danger-ink">
            {error}
            <button type="button" onClick={() => void load()} className="ml-1 font-semibold underline">
              Tentar de novo
            </button>
          </div>
        ) : tickets === null ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-ink-3" aria-label="Carregando chamados" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-ink-3">{firstName} não tem chamados.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <TicketGroup title="Em aberto" tickets={active} />
            <TicketGroup title="Encerrados" tickets={done} />
          </div>
        )}
      </div>
    </aside>
  );
}

function TicketGroup({ title, tickets }: { title: string; tickets: TicketSummary[] }) {
  if (tickets.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-[12.5px] text-ink-3">{title}</h3>
      <ul className="flex flex-col gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="rounded-xl px-3.5 py-3 outline outline-1 -outline-offset-[0.5px] outline-rule">
            <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">{ticket.id}</span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[ticket.status]}`} aria-hidden="true" />
              <span className="truncate">{TICKET_STATUS_LABELS[ticket.status]}</span>
              {ticket.isOverdue ? <span className="ml-auto"><OverdueSeal /></span> : null}
            </p>
            <p className="mt-1 text-[14.5px] font-semibold text-ink">{ticket.title}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {TICKET_CATEGORY_LABELS[ticket.category]} · prioridade {TICKET_PRIORITY_LABELS[ticket.priority].toLowerCase()}
              {ticket.resolvedAt ? ` · resolvido em ${formatDayMonth(ticket.resolvedAt)}` : ` · prazo ${formatDue(ticket.dueAt)}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
