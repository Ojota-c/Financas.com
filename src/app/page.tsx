import { redirect } from "next/navigation";

import { HOME_ROUTE } from "@/lib/utils/routes";

// Sem landing page na V0. Quem não tem sessão é devolvido ao /login pelo proxy.
export default function RootPage() {
  redirect(HOME_ROUTE);
}
