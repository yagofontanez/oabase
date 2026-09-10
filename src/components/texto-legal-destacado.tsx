import {
  classeDaCor,
  segmentarDestaques,
  type DestaqueLeiSeca,
} from "@/lib/caderno-lei-seca";

export function TextoLegalDestacado({
  texto,
  inicio = 0,
  destaques,
}: {
  texto: string;
  inicio?: number;
  destaques: DestaqueLeiSeca[];
}) {
  return segmentarDestaques(texto, inicio, destaques).map(
    (segmento, indice) =>
      segmento.destaque ? (
        <mark
          key={`${segmento.destaque.inicio}-${segmento.destaque.fim}`}
          className={`rounded-[3px] px-0.5 box-decoration-clone ${classeDaCor(segmento.destaque.cor)}`}
        >
          {segmento.texto}
        </mark>
      ) : (
        <span key={`texto-${indice}`}>{segmento.texto}</span>
      ),
  );
}

export function MemoriaDoCaderno({
  destaques,
  nota,
}: {
  destaques: DestaqueLeiSeca[];
  nota?: string;
}) {
  if (destaques.length === 0 && !nota?.trim()) return null;
  return (
    <aside className="mt-3 rounded-[12px] border border-ouro-200 bg-ouro-50/60 p-3.5">
      <span className="text-[0.66rem] font-bold tracking-[0.12em] text-ouro-700 uppercase">
        Do seu caderno de lei seca
      </span>
      {destaques.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {destaques.slice(0, 2).map((destaque) => (
            <blockquote
              key={`${destaque.inicio}-${destaque.fim}`}
              className="line-clamp-2 border-l-2 border-ouro-300 pl-2.5 text-[0.78rem] leading-relaxed text-body"
            >
              “{destaque.trecho}”
            </blockquote>
          ))}
          {destaques.length > 2 && (
            <span className="text-[0.7rem] text-muted">
              +{destaques.length - 2} outros destaques
            </span>
          )}
        </div>
      )}
      {nota?.trim() && (
        <p className="mt-2 line-clamp-2 text-[0.76rem] leading-relaxed text-muted">
          Nota: {nota}
        </p>
      )}
    </aside>
  );
}
