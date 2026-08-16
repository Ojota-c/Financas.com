/**
 * A regra 1 do projeto em forma de código: dinheiro é inteiro de centavos, e o
 * único lugar do sistema onde existe uma casa decimal é o formatador daqui.
 *
 * Sem Dinero.js de propósito — a biblioteca resolveria isto e traria um modelo
 * de moeda inteiro que o app não usa (moeda única, sem conversão). O que
 * realmente precisa de cuidado é o rateio, e é o que esta lib faz com atenção.
 */

/**
 * Centavos. Sempre inteiro, nunca fracionário.
 *
 * `number` e não `bigint`: o limite seguro do double é 2^53 centavos, ou uns
 * R$ 90 trilhões, e cada função abaixo recusa o que passar disso. `bigint`
 * contaminaria toda a UI, o Zod e o Recharts para cobrir um caso que não
 * existe. Onde a exatidão intermediária importa — o rateio — o cálculo usa
 * `bigint` internamente e devolve `number`.
 */
export type Cents = number;

const CENTAVOS_POR_REAL = 100;

/**
 * A guarda compartilhada do motor: recusa o que não é centavo inteiro dentro
 * da faixa segura do double. Exportada porque todo módulo do motor valida a
 * própria borda com a MESMA régua — duplicada, uma das cópias afrouxaria.
 */
export function assertCents(valor: number, papel: string): void {
  if (!Number.isInteger(valor)) {
    throw new TypeError(
      `${papel} precisa ser inteiro em centavos, veio ${valor}`,
    );
  }

  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(
      `${papel} passou do inteiro seguro do double e perderia precisão: ${valor}`,
    );
  }
}

/**
 * A borda de entrada do banco.
 *
 * `BIGINT` chega do driver `pg` como string, justamente porque pode não caber
 * num double. Converter sem olhar é onde o centavo some, então a checagem de
 * faixa acontece aqui, uma vez, e não espalhada por cada query.
 */
export function parseCents(valor: string | number): Cents {
  if (typeof valor === "number") {
    assertCents(valor, "valor em centavos");
    return valor;
  }

  const limpo = valor.trim();

  // O `Number()` aceita "", "0x10" e " 12 " — todos erros de origem que viram
  // saldo errado em silêncio. Só dígitos com sinal opcional passam.
  if (!/^[+-]?\d+$/.test(limpo)) {
    throw new TypeError(
      `valor em centavos malformado vindo do banco: ${valor}`,
    );
  }

  const convertido = Number(limpo);
  assertCents(convertido, "valor em centavos");

  return convertido;
}

/**
 * A borda de entrada do usuário: texto digitado vira centavos.
 *
 * Devolve `null` em vez de lançar porque quem chama é validação de formulário —
 * a mensagem de erro é do Zod, não daqui.
 *
 * O separador decimal é decidido pelo ÚLTIMO separador presente, e só quando
 * ele é seguido de uma ou duas casas. É o que faz "1.234" valer mil duzentos e
 * trinta e quatro reais e "1.5" valer um e cinquenta, que é como a pessoa
 * espera nos dois casos — regra fixa de "vírgula é decimal, ponto é milhar"
 * erra o segundo, e ninguém digita "1.5" querendo cento e cinquenta.
 */
export function parseMoneyInput(bruto: string): Cents | null {
  const limpo = bruto.replace(/\s|R\$/g, "");

  if (!/^[+-]?[\d.,]+$/.test(limpo) || !/\d/.test(limpo)) return null;

  const negativo = limpo.startsWith("-");
  const semSinal = limpo.replace(/^[+-]/, "");

  const ultimoSeparador = Math.max(
    semSinal.lastIndexOf(","),
    semSinal.lastIndexOf("."),
  );

  const casas =
    ultimoSeparador === -1 ? 0 : semSinal.length - ultimoSeparador - 1;
  const ehDecimal = casas === 1 || casas === 2;

  const inteiroTexto = (
    ehDecimal ? semSinal.slice(0, ultimoSeparador) : semSinal
  ).replace(/[.,]/g, "");

  // Não precisa de limpeza: por ser o ÚLTIMO separador, não há outro depois.
  const fracaoTexto = ehDecimal ? semSinal.slice(ultimoSeparador + 1) : "";

  // "," e ",50" começam sem parte inteira.
  const inteiro = inteiroTexto === "" ? 0 : Number(inteiroTexto);
  const fracao = ehDecimal ? Number(fracaoTexto.padEnd(2, "0")) : 0;

  const total = inteiro * CENTAVOS_POR_REAL + fracao;

  if (!Number.isSafeInteger(total)) return null;

  return negativo ? -total : total;
}

// Instanciar Intl a cada chamada custa caro numa lista de lançamentos.
const agrupador = new Intl.NumberFormat("pt-BR", { useGrouping: true });

export type FormatCentsOptions = {
  /** `false` devolve só o número, para eixo de gráfico e input. Padrão `true`. */
  symbol?: boolean;
  /** `"always"` força o `+` em valores positivos. Padrão `"auto"`. */
  sign?: "auto" | "always";
};

/**
 * A ÚNICA saída para exibição, e o único ponto do sistema onde existe vírgula.
 *
 * A parte inteira e a fracionária são separadas por resto, não por divisão em
 * ponto flutuante: `abs % 100` é exato em inteiros, e `(abs - resto) / 100` cai
 * num múltiplo exato de 100, que o double representa sem erro dentro da faixa
 * segura. Formatar 1234567 dividindo por 100 direto seria a divisão que a regra
 * 1 proíbe — e o motivo dela.
 */
export function formatCents(
  cents: Cents,
  { symbol = true, sign = "auto" }: FormatCentsOptions = {},
): string {
  assertCents(cents, "valor em centavos");

  const negativo = cents < 0;
  const absoluto = Math.abs(cents);

  const centavos = absoluto % CENTAVOS_POR_REAL;
  const reais = (absoluto - centavos) / CENTAVOS_POR_REAL;

  const numero = `${agrupador.format(reais)},${String(centavos).padStart(2, "0")}`;

  const prefixo = negativo ? "-" : sign === "always" && cents > 0 ? "+" : "";
  const moeda = symbol ? "R$ " : "";

  return `${prefixo}${moeda}${numero}`;
}

/**
 * Soma que recusa estourar em silêncio.
 */
export function sumCents(valores: readonly Cents[]): Cents {
  let total = 0;

  for (const valor of valores) {
    assertCents(valor, "parcela da soma");
    total += valor;
  }

  assertCents(total, "soma");

  return total;
}

/**
 * Rateio por **maior resto**, e a propriedade que importa é uma só:
 * `sumCents(allocate(total, pesos)) === total`, sempre, sem exceção.
 *
 * É o que divide parcelamento, rateio de despesa compartilhada e aporte entre
 * metas. Arredondar cada parte por conta própria — meio para cima ou mesmo
 * meio para par — não preserva a soma: R$ 100,00 em três vira 33,33 × 3 =
 * 99,99, e o centavo perdido reaparece como divergência de saldo.
 *
 * O cálculo intermediário usa `bigint` porque `peso * total` estoura o inteiro
 * seguro do double bem antes de qualquer um dos dois estourar sozinho.
 *
 * A sobra vai para os maiores restos; empate desempata pela ordem de entrada,
 * o que torna o resultado determinístico — parcela 1 fica com o centavo a mais,
 * e não uma qualquer que mude a cada execução.
 */
export function allocate(total: Cents, pesos: readonly number[]): Cents[] {
  assertCents(total, "total do rateio");

  if (pesos.length === 0) {
    throw new TypeError("rateio precisa de ao menos um peso");
  }

  for (const peso of pesos) {
    if (!Number.isInteger(peso) || peso < 0) {
      throw new TypeError(
        `peso precisa ser inteiro não negativo, veio ${peso}`,
      );
    }
  }

  const somaPesos = pesos.reduce((acc, peso) => acc + peso, 0);

  if (somaPesos === 0) {
    throw new TypeError("a soma dos pesos do rateio não pode ser zero");
  }

  // O sinal sai do cálculo e volta no fim: com total negativo a divisão trunca
  // em direção a zero e a sobra inverteria de lado, dando o centavo extra a
  // quem tem o MENOR resto.
  const negativo = total < 0;
  const absoluto = BigInt(Math.abs(total));
  const divisor = BigInt(somaPesos);

  const partes: bigint[] = [];
  const restos: bigint[] = [];

  for (const peso of pesos) {
    const produto = BigInt(peso) * absoluto;
    partes.push(produto / divisor);
    restos.push(produto % divisor);
  }

  const distribuido = partes.reduce((acc, parte) => acc + parte, 0n);
  let sobra = absoluto - distribuido;

  const ordem = pesos
    .map((_, indice) => indice)
    .sort((a, b) => {
      if (restos[a]! === restos[b]!) return a - b;
      return restos[a]! > restos[b]! ? -1 : 1;
    });

  for (const indice of ordem) {
    if (sobra === 0n) break;
    partes[indice] = partes[indice]! + 1n;
    sobra -= 1n;
  }

  // Converter de volta é seguro sem nova checagem: cada parte é no máximo o
  // próprio total, que já passou por `assertCents` na entrada.
  return partes.map((parte) => {
    const valor = Number(parte);
    return negativo ? -valor : valor;
  });
}
