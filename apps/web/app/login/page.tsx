import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@nexo/shared";
import { getSession } from "@/auth/server-session";
import { homeFor } from "@/auth/session";
import { NexoMark } from "@/components/nexo-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `Entrar · ${PRODUCT_NAME}` };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  return (
    <main className="flex min-h-dvh bg-paper">
      <Showcase />
      <section className="flex min-h-dvh flex-1 flex-col justify-between px-6 py-8 sm:px-14 sm:py-10">
        <div className="flex items-center justify-between gap-1.5 text-[13.5px] lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden">
            <NexoMark className="h-5 w-5" color="#1B2431" />
            <span className="text-base font-bold tracking-[-0.2px] text-ink">{PRODUCT_NAME}</span>
          </div>
          <p className="text-ink-3">
            Problema para entrar? <span className="font-semibold text-link">Ligue no ramal 4000</span>
          </p>
        </div>

        <div className="flex justify-center py-10">
          <div className="flex w-full max-w-[380px] flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[40px]/[44px] tracking-[-0.8px] text-ink">Entrar</h1>
              <p className="text-[15.5px]/[23px] text-ink-3">
                Use seu e-mail corporativo e a senha da rede Nexo.
              </p>
            </div>
            <LoginForm />
          </div>
        </div>

        <footer className="flex justify-between gap-4 text-[12.5px] text-ink-3">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}

function Showcase() {
  return (
    <aside className="hidden w-[800px] max-w-[55vw] shrink-0 flex-col justify-between overflow-hidden bg-ink px-16 pb-12 pt-10 lg:flex">
      <div className="flex items-center gap-2.5">
        <NexoMark className="h-[21px] w-6" color="#ffffff" />
        <span className="text-[17px] font-bold tracking-[-0.2px] text-white">{PRODUCT_NAME}</span>
      </div>

      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-[18px]">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <h2 className="font-display text-[54px]/[56px] tracking-[-1.2px] text-white">
            Seu problema de TI, resolvido em uma conversa.
          </h2>
          <p className="max-w-[520px] text-base/[25px] text-white/65">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de
            ajuda e chama um analista quando precisa.
          </p>
        </div>

        <div className="pl-24 max-xl:pl-0">
          <div
            className="flex w-[500px] max-w-full flex-col gap-2.5 rounded-2xl bg-white/[0.04] p-[18px] outline outline-1 -outline-offset-[0.5px] outline-white/[0.08]"
            aria-hidden="true"
          >
            <div className="flex justify-end">
              <div className="rounded-[12px_12px_4px_12px] bg-white px-3.5 py-[9px] text-[13.5px] text-ink">
                Meu notebook não conecta na VPN. Erro 809.
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="font-semibold text-white/80">{PRODUCT_NAME}</span>
                <span className="text-white/45">consultou seus chamados · criou um chamado</span>
              </div>
              <div className="w-[380px] max-w-full rounded-[4px_12px_12px_12px] bg-white/[0.08] px-3.5 py-2.5 text-[13.5px]/5 text-white">
                Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
              </div>
              <div className="flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-[7px] text-[12.5px]">
                <span className="h-[7px] w-[7px] rounded-full bg-amber" />
                <span className="font-semibold text-ink">INC-20517</span>
                <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dl className="flex border-t border-white/10 pt-6">
        {[
          { value: "8 s", label: "primeira resposta, em média" },
          { value: "72%", label: "resolvidos sem fila" },
          { value: "6", label: "analistas online agora", live: true },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`flex flex-1 flex-col-reverse gap-1.5 ${index > 0 ? "border-l border-white/10 pl-6" : ""}`}
          >
            <dt className="text-[13.5px] text-white/55">{stat.label}</dt>
            <dd className="flex items-center gap-2 font-display text-[34px] tracking-[-0.6px] text-white">
              {stat.value}
              {stat.live ? <span className="h-2 w-2 rounded-full bg-green" /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
