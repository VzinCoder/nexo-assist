/** Esqueleto do chat enquanto a conversa é carregada no servidor. */
export default function ChatLoading() {
  return (
    <div className="flex h-dvh bg-paper" role="status" aria-label="Carregando a conversa">
      <div className="hidden w-[232px] shrink-0 border-r border-rule md:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b border-rule" />
        <div className="mx-auto flex w-full max-w-[848px] flex-1 flex-col justify-end gap-5 px-5 pb-4">
          <div className="ml-auto h-11 w-[46%] animate-pulse rounded-[12px_12px_4px_12px] bg-ink/[0.07] motion-reduce:animate-none" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-48 animate-pulse rounded bg-ink/[0.06] motion-reduce:animate-none" />
            <div className="h-[68px] w-[70%] animate-pulse rounded-[4px_12px_12px_12px] bg-ink/[0.05] motion-reduce:animate-none" />
          </div>
          <div className="h-12 w-full rounded-xl outline outline-1 outline-rule" />
        </div>
        <span className="sr-only">Carregando a conversa…</span>
      </div>
    </div>
  );
}
