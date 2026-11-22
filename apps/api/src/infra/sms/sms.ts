/** Outbound SMS. Phone numbers are E.164. */
export abstract class SmsSender {
  abstract send(to: string, body: string): Promise<void>;
}
