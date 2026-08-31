import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/container";
import { Contagem } from "@/components/contagem";
import { formatarData } from "@/lib/format";

/**
 * Moldura das telas de conta.
 *
 * À esquerda a tarefa, numa superfície branca elevada. À direita, num plano
 * esmeralda, o motivo pelo qual a pessoa está ali: a data da prova correndo.
 * Numa jornada em que a única urgência real é o calendário, essa é a
 * informação que merece ocupar metade da tela.
 */
export function MolduraAuth({
  eyebrow,
  titulo,
  descricao,
  children,
  rodape,
  proximoExame,
  dias,
}: {
  eyebrow: string;
  titulo: ReactNode;
  descricao: string;
  children: ReactNode;
  rodape: ReactNode;
  proximoExame: { edicao: number; data: string };
  dias: number;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[40%] left-[-10%] h-[700px] w-[700px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(233,162,59,0.22) 0%, rgba(245,248,246,0) 70%)",
        }}
      />

      <Container className="relative grid items-stretch gap-8 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-20">
        <div className="superficie-alta p-8 sm:p-11">
          <div className="flex flex-col gap-3">
            <span className="selo self-start">{eyebrow}</span>
            <h1 className="text-[clamp(1.9rem,3.6vw,2.4rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
              {titulo}
            </h1>
            <p className="max-w-[46ch] text-[0.98rem] text-body">{descricao}</p>
          </div>

          <div className="mt-8">{children}</div>

          <div className="mt-8 border-t border-line pt-6 text-[0.94rem] text-muted">
            {rodape}
          </div>
        </div>

        <aside
          className="flex flex-col justify-center gap-8 rounded-[26px] p-8 sm:p-10"
          style={{
            background:
              "linear-gradient(150deg, #0B6250 0%, #073B33 55%, #052B26 100%)",
          }}
        >
          <div className="flex flex-col gap-3">
            <span className="selo selo-claro self-start">
              {proximoExame.edicao}º Exame de Ordem
            </span>
            <p className="text-[clamp(1.6rem,3vw,2.1rem)] leading-none font-extrabold tracking-[-0.03em] text-white">
              <Contagem dataISO={proximoExame.data} dias={dias} />
            </p>
            <p className="max-w-[38ch] text-[0.96rem] text-brand-100">
              A 1ª fase é em{" "}
              {formatarData(proximoExame.data, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              . O plano vai até esse dia — sem renovação depois.
            </p>
          </div>

          <dl className="flex flex-col divide-y divide-white/12 border-y border-white/12">
            {[
              ["Banco de questões", "1.120 questões reais, comentadas"],
              ["Caderno de erros", "montado sozinho, a cada erro seu"],
              ["Simulados", "80 questões, cinco horas, como na prova"],
              ["Revisão espaçada", "a questão volta na hora de voltar"],
            ].map(([rotulo, nota]) => (
              <div key={rotulo} className="flex flex-col gap-0.5 py-3.5">
                <dt className="text-[0.95rem] font-semibold text-white">
                  {rotulo}
                </dt>
                <dd className="text-[0.88rem] text-brand-200">{nota}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center gap-4">
            <div
              className="isolate w-16 shrink-0 overflow-hidden rounded-full p-1.5"
              style={{
                background: "linear-gradient(150deg, #FAE9CC 0%, #CFE8DF 100%)",
              }}
            >
              <Image
                src="/mascote.jpg"
                alt=""
                width={200}
                height={200}
                sizes="64px"
                className="mix-blend-multiply"
              />
            </div>
            <p className="text-[0.88rem] text-brand-200">
              Toda a{" "}
              <Link
                href="/legislacao"
                className="text-white underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white/70"
              >
                legislação comentada
              </Link>{" "}
              continua aberta, com ou sem conta.
            </p>
          </div>
        </aside>
      </Container>
    </section>
  );
}
