import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, type Secao } from "@/components/documento-legal";
import { operador, vigencia } from "@/lib/legal";
import { planos } from "@/lib/planos";
import { abs } from "@/lib/site";

/**
 * Termos de Uso.
 *
 * Rascunho técnico, escrito a partir do que o produto de fato faz — não um
 * modelo genérico colado. Precisa de revisão por advogado antes de sustentar
 * cobrança: o texto descreve corretamente o serviço, mas quem responde por
 * redação de cláusula é quem tem OAB.
 *
 * Duas coisas que este documento existe para dizer com todas as letras, e que
 * o produto inteiro depende de serem verdade:
 *
 * - o OABase **não tem vínculo** com a OAB nem com a FGV;
 * - o cronograma gerado por IA organiza tempo e **não afirma conteúdo
 *   jurídico** — é a mesma regra que está no código, em `src/lib/ia/plano.ts`.
 */

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Condições de uso do OABase: o que o serviço é, o que não é, como funcionam os planos, o direito de arrependimento e as regras de uso do conteúdo.",
  alternates: { canonical: abs("/termos") },
  // Página institucional: útil para quem procura, sem valor de posicionamento.
  robots: { index: true, follow: true },
};

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

const precoDe = (chave: string) =>
  planos.find((p) => p.chave === chave)?.preco ?? "—";

const secoes: Secao[] = [
  {
    id: "quem-somos",
    titulo: "Quem opera o OABase",
    corpo: (
      <>
        <P>
          O OABase é operado por{" "}
          <strong>{operador.razaoSocial || "[razão social pendente]"}</strong>,
          inscrita no CNPJ/CPF sob o nº{" "}
          <strong>{operador.documento || "[documento pendente]"}</strong>, com
          endereço em {operador.endereco || "[endereço pendente]"}.
        </P>
        <P>
          Contato: <strong>{operador.email}</strong>.
        </P>
        <P>
          Ao criar uma conta ou contratar um plano, você concorda com estes
          Termos. Se não concordar, não use o serviço — o conteúdo aberto do
          site pode ser consultado sem conta e sem aceite.
        </P>
      </>
    ),
  },
  {
    id: "sem-vinculo",
    titulo: "O OABase não tem vínculo com a OAB nem com a FGV",
    corpo: (
      <>
        <P>
          Este é um serviço educacional <strong>independente</strong>. Não somos
          e não representamos a Ordem dos Advogados do Brasil, o Conselho
          Federal da OAB, nenhuma Seccional, nem a Fundação Getulio Vargas —
          banca examinadora do Exame de Ordem.
        </P>
        <P>
          Os enunciados de questões e os gabaritos reproduzidos no OABase vêm
          dos cadernos e das listas de respostas <strong>oficiais</strong>,
          publicados pela banca. Reproduzimos com indicação de origem e para
          fim didático de estudo e crítica. Marcas, nomes e sinais da OAB e da
          FGV pertencem a seus titulares.
        </P>
        <P>
          Nenhuma informação do OABase é comunicado oficial de exame. Prazos,
          editais, locais de prova e resultados devem ser conferidos sempre nos
          canais oficiais da OAB e da FGV.
        </P>
      </>
    ),
  },
  {
    id: "o-que-e",
    titulo: "O que o serviço é — e o que não é",
    corpo: (
      <>
        <P>
          O OABase reúne legislação com comentários de estudo, questões de
          exames anteriores com gabarito oficial, estatísticas de incidência e
          ferramentas de treino: resolução de questões, simulado cronometrado,
          caderno de erros, revisão espaçada, cronograma e anotações.
        </P>
        <P>
          <strong>Não garantimos aprovação.</strong> Nenhum material de estudo
          pode garantir resultado em exame, e qualquer promessa nesse sentido
          seria falsa. O que oferecemos é material e organização; o desempenho
          depende de você e de fatores fora do nosso controle.
        </P>
        <P>
          <strong>O conteúdo não é consultoria jurídica.</strong> Comentários e
          textos são material didático voltado à preparação para o Exame de
          Ordem. Não use o OABase como fonte para decidir um caso concreto, seu
          ou de terceiro.
        </P>
        <P>
          Textos de lei são reproduzidos a partir das versões compiladas
          publicadas pelo Planalto. Trabalhamos para mantê-los atualizados, mas
          a versão que vale juridicamente é sempre a do Diário Oficial.
        </P>
      </>
    ),
  },
  {
    id: "conta",
    titulo: "Conta e cadastro",
    corpo: (
      <>
        <P>
          Para usar as funções de estudo é preciso criar uma conta com e-mail
          válido e senha. Você é responsável por manter a senha em sigilo e por
          tudo que for feito com a sua conta.
        </P>
        <P>
          A conta é <strong>individual e intransferível</strong>. Compartilhar
          acesso, revender ou usar a mesma conta em nome de mais de uma pessoa
          é motivo para suspensão sem reembolso do período restante.
        </P>
        <P>
          O serviço é dirigido a maiores de 18 anos, ou a maiores de 16 anos
          assistidos por responsável legal. Ao se cadastrar, você declara
          atender a esse requisito.
        </P>
        <P>
          Você pode encerrar sua conta quando quiser, pelo e-mail de contato. O
          encerramento apaga seus dados pessoais conforme descrito na{" "}
          <Link href="/privacidade">Política de Privacidade</Link>.
        </P>
      </>
    ),
  },
  {
    id: "planos",
    titulo: "Planos, preços e pagamento",
    corpo: (
      <>
        <P>
          Parte do conteúdo é aberta e permanece acessível sem conta e sem
          pagamento: legislação, exames, gabaritos e estatísticas. As
          ferramentas de treino e o banco de questões dependem de plano ativo.
        </P>
        <P>
          Os planos e preços vigentes estão em{" "}
          <Link href="/precos">/precos</Link>. Na data desta versão:
          Experimentar por {precoDe("experimentar")}, Mensal por{" "}
          {precoDe("mensal")}, Até a prova por {precoDe("ate-a-prova")} e Anual
          por {precoDe("anual")}.
        </P>
        <P>
          <strong>Não há renovação automática.</strong> O acesso vale pelo
          período contratado e termina no fim dele, sem nova cobrança. Para
          continuar, é preciso contratar de novo.
        </P>
        <P>
          O pagamento é processado pela Asaas. O OABase não recebe nem armazena
          dados de cartão. Preços podem mudar a qualquer tempo; a alteração não
          atinge plano já contratado e em vigência.
        </P>
      </>
    ),
  },
  {
    id: "arrependimento",
    titulo: "Direito de arrependimento e cancelamento",
    corpo: (
      <>
        <P>
          Como a contratação acontece pela internet, você tem{" "}
          <strong>7 (sete) dias corridos</strong>, contados do pagamento, para
          desistir e receber de volta o valor integral — é o direito de
          arrependimento do art. 49 do Código de Defesa do Consumidor. Não
          precisa justificar.
        </P>
        <P>
          Para exercer, basta escrever para <strong>{operador.email}</strong> a
          partir do e-mail da sua conta. O estorno é feito pelo mesmo meio de
          pagamento, no prazo do processador.
        </P>
        <P>
          Depois dos 7 dias, o valor pago não é devolvido proporcionalmente,
          salvo se o serviço ficar indisponível por culpa nossa por período
          relevante. Você pode encerrar a conta a qualquer momento; isso
          interrompe o uso, mas não gera reembolso do período restante.
        </P>
      </>
    ),
  },
  {
    id: "uso",
    titulo: "Uso permitido e proibido",
    corpo: (
      <>
        <P>
          Você pode usar o OABase para estudar, inclusive imprimir ou copiar
          trechos para uso pessoal.
        </P>
        <P>Não é permitido:</P>
        <P>
          — copiar, republicar ou revender o conteúdo do OABase, no todo ou em
          parte, inclusive comentários e estatísticas;
        </P>
        <P>
          — extrair conteúdo de forma automatizada (raspagem, robôs, scripts)
          ou tentar contornar os limites do plano;
        </P>
        <P>
          — compartilhar credenciais, ou usar a conta para dar acesso a
          terceiros;
        </P>
        <P>
          — usar o serviço para qualquer finalidade ilícita, ou de modo a
          prejudicar a disponibilidade para outras pessoas.
        </P>
        <P>
          O descumprimento autoriza a suspensão ou o encerramento da conta, sem
          prejuízo das medidas cabíveis.
        </P>
      </>
    ),
  },
  {
    id: "propriedade",
    titulo: "Propriedade do conteúdo",
    corpo: (
      <>
        <P>
          Os <strong>comentários, análises, estatísticas, organização e
          código</strong> do OABase são de nossa titularidade e protegidos pela
          Lei 9.610/98.
        </P>
        <P>
          Os <strong>textos de lei</strong> não são protegidos por direito
          autoral (art. 8º, IV, da Lei 9.610/98) e são reproduzidos das versões
          oficiais.
        </P>
        <P>
          Os <strong>enunciados e gabaritos</strong> das provas pertencem à OAB
          e à FGV, e são reproduzidos com indicação de fonte, para fim de
          estudo e crítica.
        </P>
        <P>
          As <strong>anotações que você escreve</strong> no quadro e nos
          cartões continuam suas. Não as usamos para nada além de exibi-las de
          volta para você.
        </P>
      </>
    ),
  },
  {
    id: "ia",
    titulo: "Cronograma gerado por inteligência artificial",
    corpo: (
      <>
        <P>
          O plano de estudos é montado por um modelo de linguagem a partir do
          que você escreve sobre sua disponibilidade, do peso de cada
          disciplina na prova e do seu histórico de estudo no serviço.
        </P>
        <P>
          Esse recurso <strong>distribui tempo e não ensina matéria</strong>.
          Ele não afirma conteúdo jurídico, não cita dispositivo e não responde
          questão — a restrição é aplicada no próprio sistema, e o conteúdo
          jurídico do OABase vem sempre do acervo, nunca do modelo.
        </P>
        <P>
          Ainda assim, é uma sugestão de organização gerada automaticamente.
          Trate como ponto de partida, não como recomendação profissional.
        </P>
      </>
    ),
  },
  {
    id: "disponibilidade",
    titulo: "Disponibilidade e mudanças no serviço",
    corpo: (
      <>
        <P>
          Trabalhamos para manter o serviço no ar, mas não prometemos
          disponibilidade ininterrupta. Pode haver interrupção para manutenção,
          por falha de fornecedor ou por caso fortuito e força maior.
        </P>
        <P>
          Podemos alterar, acrescentar ou remover funcionalidades. Se uma
          mudança reduzir de forma relevante o que foi contratado, você poderá
          pedir o reembolso proporcional do período não usufruído.
        </P>
      </>
    ),
  },
  {
    id: "responsabilidade",
    titulo: "Limitação de responsabilidade",
    corpo: (
      <>
        <P>
          Nos limites permitidos pela lei, e ressalvados os direitos do
          consumidor previstos no Código de Defesa do Consumidor, nossa
          responsabilidade fica limitada ao valor pago por você nos 12 meses
          anteriores ao fato.
        </P>
        <P>
          Não respondemos por resultado em exame, por decisão que você tome com
          base no conteúdo, nem por indisponibilidade causada por terceiros.
        </P>
      </>
    ),
  },
  {
    id: "alteracoes",
    titulo: "Alterações destes Termos",
    corpo: (
      <>
        <P>
          Podemos alterar estes Termos. A data no topo indica a versão vigente,
          e mudanças relevantes serão avisadas por e-mail com antecedência
          razoável.
        </P>
        <P>
          Se você não concordar com a nova versão, pode encerrar a conta; se
          houver plano em vigência, o valor proporcional ao período restante
          será devolvido.
        </P>
      </>
    ),
  },
  {
    id: "foro",
    titulo: "Lei aplicável e foro",
    corpo: (
      <>
        <P>
          Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro
          da comarca de{" "}
          <strong>{operador.comarca || "[comarca pendente]"}</strong>,
          ressalvado o direito do consumidor de propor ação no foro do seu
          domicílio, nos termos do art. 101, I, do Código de Defesa do
          Consumidor.
        </P>
      </>
    ),
  },
];

export default function TermosPage() {
  return (
    <DocumentoLegal
      titulo="Termos de Uso"
      descricao="O que o OABase é, o que não é, como funcionam os planos e quais são os seus direitos."
      atualizadoEm={vigencia.termos}
      crumbLabel="Termos de Uso"
      crumbHref="/termos"
      secoes={secoes}
    />
  );
}
