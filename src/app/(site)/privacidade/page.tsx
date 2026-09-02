import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, type Secao } from "@/components/documento-legal";
import { operador, subprocessadores, vigencia } from "@/lib/legal";
import { abs } from "@/lib/site";

/**
 * Política de Privacidade.
 *
 * Escrita a partir do schema real, não de um modelo: cada dado listado aqui
 * existe numa coluna do banco, e cada operador citado é um serviço que o
 * projeto de fato chama. Uma política que descreve tratamento que não
 * acontece — ou que omite um que acontece — é pior do que nenhuma, porque
 * cria expectativa falsa e ainda assim não protege.
 *
 * Precisa de revisão por advogado antes de sustentar cobrança.
 */

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Quais dados o OABase coleta, para quê, com quem compartilha, por quanto tempo guarda e como exercer seus direitos previstos na LGPD.",
  alternates: { canonical: abs("/privacidade") },
  robots: { index: true, follow: true },
};

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

const secoes: Secao[] = [
  {
    id: "controlador",
    titulo: "Quem trata os seus dados",
    corpo: (
      <>
        <P>
          O controlador dos dados pessoais tratados no OABase é{" "}
          <strong>{operador.razaoSocial || "[razão social pendente]"}</strong>,
          CNPJ/CPF nº{" "}
          <strong>{operador.documento || "[documento pendente]"}</strong>,
          endereço em {operador.endereco || "[endereço pendente]"}.
        </P>
        <P>
          Encarregado pelo tratamento de dados (LGPD, art. 41):{" "}
          <strong>{operador.encarregado}</strong>.
        </P>
        <P>
          Esta política explica o que coletamos, por quê, com quem
          compartilhamos e o que você pode exigir de nós. Ela vale para o site
          e para a área logada.
        </P>
      </>
    ),
  },
  {
    id: "coleta",
    titulo: "Quais dados coletamos",
    corpo: (
      <>
        <P>
          <strong>Você não precisa de conta</strong> para ler a legislação, os
          exames e as estatísticas. Sem conta, coletamos apenas os dados
          técnicos do item seguinte.
        </P>
        <P>
          <strong>Ao criar conta:</strong> e-mail e senha. A senha é guardada
          apenas como hash — nem nós conseguimos lê-la. Opcionalmente, o nome
          que você quiser exibir.
        </P>
        <P>
          <strong>Ao contratar um plano:</strong> nome completo, CPF e
          telefone. São exigidos pelo processador de pagamento para emitir a
          cobrança, e ficam vinculados à sua conta para não serem pedidos de
          novo na compra seguinte. Também guardamos o registro da cobrança:
          plano, valor, situação e o identificador dela no gateway.{" "}
          <strong>Não recebemos nem armazenamos dados do seu cartão.</strong>
        </P>
        <P>
          <strong>Ao usar as ferramentas de estudo:</strong> as questões que
          você respondeu e a alternativa marcada, se acertou, o tempo gasto, a
          fila de revisão, os blocos de foco concluídos e a disciplina
          escolhida, os simulados e o cartão-resposta, o cronograma gerado e a
          conversa que o produziu, e as anotações e ligações do seu quadro.
        </P>
        <P>
          <strong>Dados técnicos:</strong> endereço IP e registros de acesso
          gerados pela hospedagem, mantidos por prazo legal. O Marco Civil da
          Internet (art. 15) obriga a guarda dos registros de acesso a
          aplicação por 6 meses.
        </P>
        <P>
          <strong>Não usamos</strong> Google Analytics, pixel de rede social,
          mapa de calor ou qualquer rastreador de terceiros. Não há cookie de
          publicidade.
        </P>
      </>
    ),
  },
  {
    id: "finalidade",
    titulo: "Para que usamos, e com qual base legal",
    corpo: (
      <>
        <P>
          <strong>Manter sua conta e entregar o serviço contratado</strong> —
          autenticação, histórico de estudo, cronograma, simulados. Base legal:
          execução de contrato (LGPD, art. 7º, V).
        </P>
        <P>
          <strong>Cobrar e comprovar o pagamento</strong> — emitir a cobrança,
          registrar a confirmação e liberar o acesso. Base legal: execução de
          contrato e cumprimento de obrigação legal e fiscal (art. 7º, II e V).
        </P>
        <P>
          <strong>Enviar e-mails do serviço</strong> — confirmação de compra e
          aviso de fim de plano. Base legal: execução de contrato. Esses não
          podem ser desativados enquanto houver plano, porque informam sobre o
          que você comprou.
        </P>
        <P>
          <strong>Enviar o lembrete diário de revisão</strong> — Base legal:
          consentimento (art. 7º, I). Você liga e desliga quando quiser em
          Configurações, e desligar não afeta nada além do lembrete.
        </P>
        <P>
          <strong>Medir a dificuldade das questões e comparar desempenho</strong>{" "}
          — usamos as respostas de todo mundo de forma agregada para calcular
          quantos por cento acertam cada questão e onde a sua taxa cai na
          distribuição. Esse cálculo só é exibido acima de um mínimo de
          participantes, justamente para que nenhum número revele a resposta de
          uma pessoa específica. Base legal: legítimo interesse (art. 7º, IX).
        </P>
        <P>
          <strong>Segurança e prevenção a fraude</strong> — registros de acesso
          e detecção de uso indevido de conta. Base legal: cumprimento de
          obrigação legal e legítimo interesse.
        </P>
        <P>
          <strong>Não vendemos seus dados</strong>, não os cedemos para
          publicidade e não fazemos perfilamento para anúncios.
        </P>
      </>
    ),
  },
  {
    id: "compartilhamento",
    titulo: "Com quem compartilhamos",
    corpo: (
      <>
        <P>
          Compartilhamos apenas com os serviços necessários para o OABase
          funcionar, e apenas o dado que cada um precisa:
        </P>
        <div className="not-prose my-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[0.9rem]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2.5 pr-4 font-semibold text-ink">Serviço</th>
                <th className="py-2.5 pr-4 font-semibold text-ink">Para quê</th>
                <th className="py-2.5 pr-4 font-semibold text-ink">
                  Quais dados
                </th>
                <th className="py-2.5 font-semibold text-ink">Onde fica</th>
              </tr>
            </thead>
            <tbody>
              {subprocessadores.map((s) => (
                <tr key={s.nome} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 font-semibold text-ink">
                    {s.nome}
                  </td>
                  <td className="py-2.5 pr-4 text-body">{s.papel}</td>
                  <td className="py-2.5 pr-4 text-body">{s.dados}</td>
                  <td className="py-2.5 text-body">{s.local}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          <strong>Transferência internacional.</strong> Parte desses serviços
          fica fora do Brasil, como indicado acima. A transferência é feita nos
          termos do art. 33 da LGPD, por ser necessária à execução do contrato
          com você, e com cláusulas contratuais de proteção oferecidas por cada
          fornecedor.
        </P>
        <P>
          <strong>Sobre a IA:</strong> quando você usa o cronograma, o texto
          que escreve na conversa e o total de minutos por disciplina são
          enviados ao provedor do modelo para gerar a resposta. Não enviamos
          seu nome, e-mail, CPF nem suas respostas de questões. Evite escrever
          dados pessoais sensíveis nessa conversa.
        </P>
        <P>
          Podemos ainda compartilhar dados por ordem judicial ou requisição de
          autoridade competente.
        </P>
      </>
    ),
  },
  {
    id: "prazo",
    titulo: "Por quanto tempo guardamos",
    corpo: (
      <>
        <P>
          <strong>Dados da conta e histórico de estudo:</strong> enquanto a
          conta existir. Ao encerrar, são apagados em até 30 dias.
        </P>
        <P>
          <strong>Dados de cobrança:</strong> 5 anos após a transação, prazo de
          guarda fiscal e do art. 27 do Código de Defesa do Consumidor.
        </P>
        <P>
          <strong>Registros de acesso:</strong> 6 meses, conforme o art. 15 do
          Marco Civil da Internet.
        </P>
        <P>
          <strong>Estatísticas agregadas de dificuldade</strong> permanecem
          depois do encerramento, porque nesse ponto já não identificam
          ninguém: são contagens por questão, sem vínculo com pessoa.
        </P>
      </>
    ),
  },
  {
    id: "direitos",
    titulo: "Seus direitos",
    corpo: (
      <>
        <P>
          A LGPD (art. 18) garante a você, a qualquer momento e sem custo:
          confirmar se tratamos seus dados; acessá-los; corrigir dado
          incompleto ou desatualizado; pedir anonimização, bloqueio ou
          eliminação de dado desnecessário ou tratado em desconformidade;
          solicitar portabilidade; obter informação sobre com quem
          compartilhamos; e revogar consentimento.
        </P>
        <P>
          Para exercer qualquer um deles, escreva para{" "}
          <strong>{operador.encarregado}</strong> a partir do e-mail cadastrado
          na conta. Respondemos em até 15 dias.
        </P>
        <P>
          Parte disso você faz sozinho: nome e senha em Configurações, e o
          lembrete de revisão no interruptor da mesma tela.
        </P>
        <P>
          Você também pode peticionar à Autoridade Nacional de Proteção de
          Dados (ANPD).
        </P>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies",
    corpo: (
      <>
        <P>
          Usamos <strong>apenas cookies necessários</strong> — os que mantêm
          sua sessão aberta depois do login. Sem eles, não há como você
          permanecer autenticado.
        </P>
        <P>
          Não usamos cookies de análise, de publicidade ou de terceiros. Por
          isso não há banner de consentimento: não existe escolha a fazer.
        </P>
        <P>
          Algumas preferências (menu recolhido, largura do painel, estado do
          modo foco) ficam no armazenamento local do seu navegador e nunca são
          enviadas para nós.
        </P>
      </>
    ),
  },
  {
    id: "seguranca",
    titulo: "Segurança",
    corpo: (
      <>
        <P>
          O acesso aos dados é controlado no próprio banco, por políticas que
          restringem cada registro ao seu dono — não apenas por verificação na
          aplicação. Senhas são armazenadas em hash. O tráfego é cifrado.
        </P>
        <P>
          Nenhum sistema é imune. Em caso de incidente com risco relevante,
          comunicaremos você e a ANPD, nos termos do art. 48 da LGPD.
        </P>
      </>
    ),
  },
  {
    id: "menores",
    titulo: "Crianças e adolescentes",
    corpo: (
      <P>
        O OABase é destinado a maiores de 18 anos, ou a maiores de 16
        assistidos por responsável legal. Não coletamos dados de crianças de
        forma consciente. Se identificarmos cadastro em desacordo, a conta será
        encerrada e os dados apagados.
      </P>
    ),
  },
  {
    id: "mudancas",
    titulo: "Mudanças nesta política",
    corpo: (
      <>
        <P>
          A data no topo indica a versão vigente. Mudanças relevantes serão
          comunicadas por e-mail antes de entrarem em vigor.
        </P>
        <P>
          Consulte também os <Link href="/termos">Termos de Uso</Link>.
        </P>
      </>
    ),
  },
];

export default function PrivacidadePage() {
  return (
    <DocumentoLegal
      titulo="Política de Privacidade"
      descricao="Quais dados coletamos, para quê, com quem compartilhamos e como você exerce seus direitos."
      atualizadoEm={vigencia.privacidade}
      crumbLabel="Privacidade"
      crumbHref="/privacidade"
      secoes={secoes}
    />
  );
}
