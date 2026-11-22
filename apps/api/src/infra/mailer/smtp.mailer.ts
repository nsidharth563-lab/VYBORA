import { Inject, Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { Mailer, type MailMessage } from './mailer.js';

/** SMTP delivery — Mailpit locally, Amazon SES SMTP / any provider in production. */
@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.transport = nodemailer.createTransport(config.SMTP_URL);
    this.from = config.EMAIL_FROM;
  }

  async send(m: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
  }
}
