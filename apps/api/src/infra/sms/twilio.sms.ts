import { Logger } from '@nestjs/common';
import { SmsSender } from './sms.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** E.164 sender number or Messaging Service SID (MG…). */
  from: string;
}

/** Twilio Programmable Messaging over REST (no SDK needed). */
export class TwilioSms extends SmsSender {
  private readonly logger = new Logger('TwilioSms');

  constructor(
    private readonly cfg: TwilioConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  async send(to: string, body: string): Promise<void> {
    const form = new URLSearchParams({ To: to, Body: body });
    form.set(this.cfg.from.startsWith('MG') ? 'MessagingServiceSid' : 'From', this.cfg.from);
    const res = await this.fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Twilio send failed (${res.status}): ${detail.slice(0, 300)}`);
      throw new Error(`SMS delivery failed (${res.status})`);
    }
  }
}
