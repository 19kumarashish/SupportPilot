import { EmailVerificationPage } from "@/components/email-verification-page";

type VerifyEmailPageSearchParams = {
  token?: string | string[];
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<VerifyEmailPageSearchParams>;
}) {
  const { token } = await searchParams;
  return <EmailVerificationPage token={Array.isArray(token) ? token[0] ?? "" : token ?? ""} />;
}
