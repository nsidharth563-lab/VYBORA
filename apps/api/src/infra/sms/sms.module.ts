import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { ConsoleSms } from './console.sms.js';
import { SmsSender } from './sms.js';
import { TwilioSms } from './twilio.sms.js';

@Global()
@Module({
  providers: [
    {
      provide: SmsSender,
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig) =>
        c.SMS_PROVIDER === 'twilio'
          ? new TwilioSms({ accountSid: c.TWILIO_ACCOUNT_SID!, authToken: c.TWILIO_AUTH_TOKEN!, from: c.TWILIO_FROM! })
          : new ConsoleSms(),
    },
  ],
  exports: [SmsSender],
})
export class SmsModule {}
