export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Outbound email. Swappable (SMTP, SES, Resend…) without touching callers. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
