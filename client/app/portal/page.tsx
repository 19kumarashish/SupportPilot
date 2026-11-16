import Link from "next/link";

import { PortalTicketList } from "@/components/portal/portal-ticket-list";

export default function PortalPage() {
  return <><PortalTicketList /><p className="portal-page"><Link className="secondary-button" href="/portal/kb">Browse help articles</Link></p></>;
}
