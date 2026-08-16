import { networkInterfaces } from "node:os";

/**
 * Os IPs desta máquina na rede local — é o que o celular digita para abrir o
 * app em desenvolvimento (http://192.168.x.x:3000).
 *
 * Enumerados em runtime, e não fixados em env: o IP muda de rede para rede
 * (casa, trabalho, hotspot) e um valor decorado quebraria em silêncio no
 * primeiro Wi-Fi diferente. Usado em DOIS lugares que precisam concordar:
 * `allowedDevOrigins` do Next e `trustedOrigins` do Better Auth — sem o
 * segundo, o login pelo celular morre em erro de CSRF.
 *
 * Fora de desenvolvimento devolve vazio: produção confia só na URL canônica.
 */
export function lanIPs(): string[] {
  if (process.env.NODE_ENV === "production") return [];

  return Object.values(networkInterfaces())
    .flatMap((lista) => lista ?? [])
    .filter((iface) => iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);
}

export function lanOrigins(porta = process.env.PORT ?? "3000"): string[] {
  return lanIPs().map((ip) => `http://${ip}:${porta}`);
}
