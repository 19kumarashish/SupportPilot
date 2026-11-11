import { EmailVerificationPage } from "@/components/email-verification-page";

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  return <EmailVerificationPage token={Array.isArray(token) ? token[0] ?? "" : token ?? ""} />;
}
