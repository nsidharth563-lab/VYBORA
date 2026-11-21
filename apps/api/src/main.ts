import './instrument.js';
import { ConfigError, loadConfig } from './config/config.js';
import { createApp } from './app.factory.js';

let config;
try {
  config = loadConfig();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
const app = await createApp(config);
await app.listen({ port: config.PORT, host: config.HOST });
app.getHttpAdapter().getInstance().log.info(`VYBORA API listening on ${config.API_PUBLIC_URL}/v1`);
