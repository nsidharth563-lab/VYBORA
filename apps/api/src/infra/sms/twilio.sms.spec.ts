import { TwilioSms } from './twilio.sms.js';

describe('TwilioSms', () => {
  it('posts a form-encoded message with basic auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    await new TwilioSms({ accountSid: 'AC1', authToken: 'secret', from: '+15005550006' }, fetchImpl).send('+919876543210', 'Your code is 123456');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from('AC1:secret').toString('base64')}`);
    const body = new URLSearchParams(init.body);
    expect(body.get('To')).toBe('+919876543210');
    expect(body.get('From')).toBe('+15005550006');
    expect(body.get('Body')).toBe('Your code is 123456');
  });

  it('uses MessagingServiceSid for MG senders and throws on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"bad"}', { status: 400 }));
    const sms = new TwilioSms({ accountSid: 'AC1', authToken: 's', from: 'MG123' }, fetchImpl);
    await expect(sms.send('+1', 'x')).rejects.toThrow('SMS delivery failed (400)');
    expect(new URLSearchParams(fetchImpl.mock.calls[0]![1].body).get('MessagingServiceSid')).toBe('MG123');
  });
});
