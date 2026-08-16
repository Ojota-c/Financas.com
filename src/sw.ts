/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

/**
 * Service worker do PWA (§8, fase 5). A estratégia vem pronta do Serwist:
 * `defaultCache` já faz stale-while-revalidate nos dados e cache-first nos
 * assets com hash — exatamente o que o planejamento pede, sem regra à mão.
 *
 * Dado financeiro NUNCA entra em precache: o que se vê offline é o último
 * fetch, não uma cópia congelada no deploy.
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
