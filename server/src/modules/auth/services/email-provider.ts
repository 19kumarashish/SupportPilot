import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";

export interface EmailProvider {
  sendVerificationEmail(input: {
    to: string;
    verificationUrl: string;
    expiresAt: Date;
  }): Promise<void>;
  sendTicketNotification(input: {
    to: string;
    ticketId: string;
    subject: string;
    body: string;
  }): Promise<void>;
  sendSlaBreachAlert(input: {
    to: string;
    ticketId: string;
    subject: string;
    breachedAt: Date;
  }): Promise<void>;
  sendInvitationEmail(input: {
    to: string;
    invitationUrl: string;
    expiresAt: Date;
  }): Promise<void>;
}

const developmentVerificationLinks = new Map<
  string,
  { verificationUrl: string; expiresAt: Date }
>();

const developmentEmailProvider: EmailProvider = {
  async sendVerificationEmail(input) {
    const now = Date.now();
    for (const [email, link] of developmentVerificationLinks) {
      if (link.expiresAt.getTime() <= now) {
        developmentVerificationLinks.delete(email);
      }
    }
    developmentVerificationLinks.set(input.to.toLowerCase(), {
      verificationUrl: input.verificationUrl,
      expiresAt: input.expiresAt,
    });
  },
  async sendTicketNotification() {},
  async sendSlaBreachAlert() {},
  async sendInvitationEmail(input) {
    developmentInvitationLinks.set(input.to.toLowerCase(), {
      verificationUrl: input.invitationUrl,
      expiresAt: input.expiresAt,
    });
  },
};

const developmentInvitationLinks = new Map<string, { verificationUrl: string; expiresAt: Date }>();

const unconfiguredProductionEmailProvider: EmailProvider = {
  async sendVerificationEmail() {
    throw new AppError(
      503,
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "Email delivery is not configured",
    );
  },
  async sendTicketNotification() {
    throw new AppError(
      503,
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "Email delivery is not configured",
    );
  },
  async sendSlaBreachAlert() {
    throw new AppError(
      503,
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "Email delivery is not configured",
    );
  },
  async sendInvitationEmail() {
    throw new AppError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Email delivery is not configured");
  },
};

const httpEmailProvider = (apiUrl: string, apiKey: string, from: string): EmailProvider => {
  const send = async (input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<void> => {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email provider rejected the request (${response.status})`);
    }
  };

  return {
    sendVerificationEmail: (input) =>
      send({
        to: input.to,
        subject: "Verify your SupportPilot workspace",
        text: `Verify your workspace: ${input.verificationUrl}`,
      }),
    sendTicketNotification: (input) =>
      send({
        to: input.to,
        subject: `Ticket update: ${input.subject}`,
        text: input.body,
      }),
    sendSlaBreachAlert: (input) =>
      send({
        to: input.to,
        subject: `SLA breach: ${input.subject}`,
        text: `Ticket ${input.ticketId} breached its SLA at ${input.breachedAt.toISOString()}.`,
      }),
    sendInvitationEmail: (input) =>
      send({
        to: input.to,
        subject: "You have been invited to SupportPilot",
        text: `Accept your invitation: ${input.invitationUrl}`,
      }),
  };
};

export const createEmailProvider = (
  productionProvider?: EmailProvider,
): EmailProvider => {
  if (productionProvider) {
    return productionProvider;
  }

  if (env.NODE_ENV !== "production") {
    return developmentEmailProvider;
  }

  if (
    env.EMAIL_PROVIDER === "http" &&
    env.EMAIL_API_URL &&
    env.EMAIL_API_KEY &&
    env.EMAIL_FROM
  ) {
    return httpEmailProvider(
      env.EMAIL_API_URL,
      env.EMAIL_API_KEY,
      env.EMAIL_FROM,
    );
  }

  return unconfiguredProductionEmailProvider;
};

export let emailProvider = createEmailProvider();
const defaultProductionEmailProvider = unconfiguredProductionEmailProvider;

export const isEmailDeliveryConfigured = (): boolean =>
  env.NODE_ENV !== "production" ||
  emailProvider !== defaultProductionEmailProvider;

export const configureEmailProvider = (provider: EmailProvider): void => {
  emailProvider = provider;
};

export const resetEmailProvider = (): void => {
  emailProvider = createEmailProvider();
};

export const takeDevelopmentVerificationLink = (
  email: string,
): string | null => {
  if (env.NODE_ENV === "production") {
    throw new AppError(
      404,
      "NOT_FOUND",
      "Development verification retrieval is unavailable",
    );
  }

  const key = email.trim().toLowerCase();
  const link = developmentVerificationLinks.get(key);
  developmentVerificationLinks.delete(key);

  if (!link || link.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return link.verificationUrl;
};

export const takeDevelopmentInvitationLink = (email: string): string | null => {
  const key = email.trim().toLowerCase();
  const link = developmentInvitationLinks.get(key);
  developmentInvitationLinks.delete(key);
  if (!link || link.expiresAt.getTime() <= Date.now()) return null;
  return link.verificationUrl;
};

export const getVerificationUrl = (token: string): string => {
  const url = new URL("/verify-email", env.PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
};

export const shouldQueueEmailNotifications = (): boolean =>
  env.ENABLE_ASYNC_NOTIFICATIONS &&
  env.NODE_ENV === "production" &&
  Boolean(env.REDIS_URL);
