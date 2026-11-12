import type { ReactNode } from "react";

import { CustomerAuthProvider } from "@/lib/customer-auth";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <CustomerAuthProvider>{children}</CustomerAuthProvider>;
}
