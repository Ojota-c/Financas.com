/**
 * Exceção consciente à regra de "barrel file só em lib/finance/": o Drizzle e o
 * drizzleAdapter recebem UM objeto de schema, e o drizzle-kit varre este
 * diretório para gerar migration. Sem o barrel, cada tabela nova teria que ser
 * registrada em três lugares.
 */
export * from "./auth";
export * from "./categories";
