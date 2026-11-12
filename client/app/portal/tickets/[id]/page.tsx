import { PortalTicketDetail } from "@/components/portal/portal-ticket-detail";

export default async function PortalTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalTicketDetail ticketId={id} />;
}
