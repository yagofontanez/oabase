import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

type VarianteAuth = "entrar" | "criar";

function IconeLivro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
    </svg>
  );
}

function CenaDeRetorno() {
  return (
    <div className="relative mx-auto aspect-[1.18] w-full max-w-[420px]" aria-hidden="true">
      <div className="auth-orbita absolute inset-[8%] rounded-full border border-white/12" />
      <div className="auth-orbita auth-orbita-reversa absolute inset-[20%] rounded-full border border-dashed border-ouro-200/25" />
      <span className="auth-ponto absolute top-[5%] left-[48%] h-3 w-3 rounded-full bg-ouro-400 shadow-[0_0_22px_rgba(233,162,59,.9)]" />
      <span className="auth-ponto auth-atraso-1 absolute top-[48%] right-[4%] h-2.5 w-2.5 rounded-full bg-brand-200 shadow-[0_0_20px_rgba(162,210,194,.8)]" />

      <div className="auth-flutua absolute top-[16%] right-[8%] left-[8%] overflow-hidden rounded-[24px] border border-white/15 bg-white/[0.09] p-5 shadow-[0_30px_70px_-30px_rgba(0,0,0,.7)] backdrop-blur-md sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-brand-100 uppercase">
            <span className="h-2 w-2 rounded-full bg-ouro-400" />
            Sessão de hoje
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-semibold text-white">45 min</span>
        </div>
        <div className="mt-7 flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-ouro-400 text-noite"><IconeLivro /></span>
          <div>
            <strong className="block text-[1.05rem] text-white">Retome de onde parou</strong>
            <span className="mt-1 block text-[0.78rem] text-brand-100">O próximo bloco já está separado.</span>
          </div>
        </div>
        <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="auth-progresso h-full rounded-full bg-ouro-400" />
        </div>
        <div className="mt-3 flex justify-between text-[0.68rem] text-brand-200">
          <span>foco registrado</span><span>ritmo preservado</span>
        </div>
      </div>

      <div className="auth-flutua-atrasada absolute right-[3%] bottom-[3%] rounded-[16px] border border-white/15 bg-[#103f37] px-4 py-3 shadow-xl">
        <span className="block text-[0.66rem] text-brand-200">Próxima revisão</span>
        <strong className="text-[0.82rem] text-white">na hora certa</strong>
      </div>
    </div>
  );
}

function CenaDeComeco() {
  const etapas = [
    ["01", "Escolha as matérias", "feito"],
    ["02", "Defina sua prova", "ativo"],
    ["03", "Receba o roadmap", "depois"],
  ] as const;

  return (
    <div className="relative mx-auto aspect-[1.18] w-full max-w-[420px]" aria-hidden="true">
      <div className="absolute inset-x-[8%] top-[8%] bottom-[4%] rotate-[-3deg] rounded-[28px] border border-white/10 bg-white/[0.05]" />
      <div className="auth-flutua absolute inset-x-[12%] top-[12%] overflow-hidden rounded-[24px] border border-white/15 bg-white/[0.1] p-5 shadow-[0_30px_70px_-30px_rgba(0,0,0,.7)] backdrop-blur-md sm:p-7">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] font-bold tracking-[0.12em] text-vinho-100 uppercase">Seu primeiro plano</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ouro-400 text-[0.78rem] font-extrabold text-noite">✓</span>
        </div>
        <ol className="relative mt-6 flex flex-col gap-3">
          <span className="absolute top-5 bottom-5 left-[18px] w-px bg-white/15" />
          {etapas.map(([numero, titulo, estado]) => (
            <li key={numero} className="relative flex items-center gap-3 rounded-[14px] border border-white/10 bg-black/10 p-3.5">
              <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${estado === "ativo" ? "auth-pulso-suave bg-ouro-400 text-noite" : estado === "feito" ? "bg-brand-200 text-brand-900" : "bg-white/10 text-vinho-100"}`}>{numero}</span>
              <div>
                <strong className="block text-[0.84rem] text-white">{titulo}</strong>
                <span className="text-[0.68rem] text-vinho-100">{estado === "feito" ? "Tudo certo" : estado === "ativo" ? "Você está aqui" : "O OABase organiza"}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="auth-flutua-atrasada absolute bottom-[1%] left-[4%] rounded-[16px] bg-ouro-100 px-4 py-3 text-noite shadow-xl">
        <span className="block text-[0.65rem] text-noite/60">Faculdade ou OAB</span>
        <strong className="text-[0.82rem]">o plano começa por você</strong>
      </div>
    </div>
  );
}

/** Moldura única para acesso e cadastro, com a tarefa ocupando uma coluna
 * inteira e uma cena de estudo própria em cada momento da jornada. */
export function MolduraAuth({
  eyebrow,
  titulo,
  descricao,
  children,
  rodape,
  variante = "entrar",
}: {
  eyebrow: string;
  titulo: ReactNode;
  descricao: string;
  children: ReactNode;
  rodape: ReactNode;
  variante?: VarianteAuth;
}) {
  const criando = variante === "criar";

  return (
    <section className="h-svh overflow-hidden">
      <div className="grid h-full min-h-0 lg:grid-cols-[1.08fr_0.92fr]">
        <aside className={`relative hidden h-full min-h-0 flex-col justify-center overflow-hidden px-[clamp(2.5rem,5vw,6rem)] py-[clamp(2rem,4vh,3.5rem)] lg:flex ${criando ? "bg-[#432132]" : "bg-noite"}`}>
          <div className={`pointer-events-none absolute -top-36 -left-28 h-[28rem] w-[28rem] rounded-full blur-3xl ${criando ? "bg-vinho-400/20" : "bg-brand-400/20"}`} aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[620px]">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-[0.7rem] font-bold tracking-[0.12em] uppercase ${criando ? "border-vinho-200/25 bg-vinho-100/10 text-vinho-100" : "border-brand-200/20 bg-brand-100/10 text-brand-100"}`}>
              {criando ? "Comece do seu jeito" : "Seu estudo continua"}
            </span>
            <h2 className="mt-4 max-w-[15ch] text-[clamp(1.85rem,3vw,3rem)] leading-[1.02] font-extrabold tracking-[-0.05em] text-white">
              {criando ? "Um plano para a prova que importa agora." : "Seu próximo passo já sabe onde você parou."}
            </h2>
            <p className={`mt-4 max-w-[48ch] text-[0.96rem] leading-relaxed ${criando ? "text-vinho-100" : "text-brand-100"}`}>
              {criando
                ? "Organize uma avaliação da faculdade, uma disciplina inteira ou a preparação para a OAB."
                : "Roadmap, foco, anotações e revisões ficam juntos para você não recomeçar a cada sessão."}
            </p>
            <div className="mt-[clamp(1rem,3vh,2rem)]">{criando ? <CenaDeComeco /> : <CenaDeRetorno />}</div>
          </div>
        </aside>

        <div className={`flex h-full min-h-0 items-center overflow-hidden px-6 py-[clamp(1.5rem,5vh,3.5rem)] sm:px-12 lg:px-[clamp(3rem,6vw,6.5rem)] ${criando ? "bg-[#edf5f0]" : "bg-[#f7f1e8]"}`}>
          <div className="mx-auto w-full max-w-[470px]">
            <div className="flex items-center justify-between gap-4">
              <Wordmark className="block" />
              <span className={`inline-flex rounded-full px-3 py-1.5 text-[0.7rem] font-bold ${criando ? "bg-vinho-100 text-vinho-700" : "bg-brand-100 text-brand-800"}`}>{eyebrow}</span>
            </div>
            <h1 className="mt-5 text-[clamp(1.85rem,3.4vw,2.65rem)] leading-[1.02] font-extrabold tracking-[-0.05em] text-ink">{titulo}</h1>
            <p className="auth-descricao mt-3 max-w-[42ch] text-[0.92rem] leading-relaxed text-body">{descricao}</p>
            <div className="auth-conteudo mt-6">{children}</div>
            <div className="auth-rodape mt-6 border-t border-ink/10 pt-5 text-[0.9rem] text-muted">{rodape}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
