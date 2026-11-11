import { PRODUCT_NAME } from "@nexo/shared";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-rule bg-paper p-8">
        <h1 className="font-display text-4xl text-ink">{PRODUCT_NAME}</h1>
        <p className="mt-3 text-ink-3">
          Service desk de TI: descreva o problema e o assistente consulta, abre ou acompanha seus
          chamados.
        </p>
        <span className="mt-6 inline-block rounded-md bg-cta px-4 py-2 text-sm font-medium text-white">
          Em construção
        </span>
      </div>
    </main>
  );
}
