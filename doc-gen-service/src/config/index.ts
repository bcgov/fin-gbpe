import dotenv from 'dotenv';
import config from 'nconf';

dotenv.config();
/* istanbul ignore next  */
const env = process.env.NODE_ENV || 'local';

config.defaults({
  environment: env,
  server: {
    logLevel: process.env.LOG_LEVEL || 'silly',
    apiKey: process.env.DOC_GEN_API_KEY || 'api-key',
    morganFormat: 'dev',
    port: process.env.PORT || 3001, // Port to run the server on, to avoid conflicts with backend
    templatePath: process.env.TEMPLATE_PATH || './src/templates',
    rateLimit: {
      enabled: process.env.IS_RATE_LIMIT_ENABLED || false, // Disable if rate limiting is not required
      windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60000, // 1 minute
      limit: process.env.RATE_LIMIT_LIMIT || 100 // Limit each IP to 100 requests per `window` (here, per 1 minute)
    }
  }

});
export {config} ;

