import { InvitationAcceptancePage } from "@/components/invitation-acceptance-page";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationAcceptancePage token={token} />;
}
