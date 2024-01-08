import http from 'http';
import { config } from './config/index';

import { logger } from './logger';

import { app } from './app';
import { browser, initBrowser } from './v1/services/puppeteer-service';

// run inside `async` function

const port = config.get('server:port');
const server = http.createServer(app);
const env = config.get('environment');
if (env === 'local') {
  logger.info('Running in local environment');
  app.set('port', port);
  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);
} else {
  logger.info(`Running in ${env} environment`);
  initBrowser()
    .then(() => {
      browser
        .disconnect()
        .then(() => {
          app.set('port', port);
          server.listen(port);
          server.on('error', onError);
          server.on('listening', onListening);
        })
        .catch((e) => {
          logger.error(e);
          process.exit(1);
        });
    })
    .catch((error) => {
      logger.error(error);
      process.exit(1);
    });
}


/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: { syscall: string; code: any }) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(bind + ' requires elevated privileges');
      break;
    case 'EADDRINUSE':
      logger.error(bind + ' is already in use');
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  logger.info('Listening on ' + bind);
}

process.on('SIGINT', () => {
  server.close();
  logger.info('process terminated by SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.close();
  logger.info('process terminated by SIGTERM');
  process.exit(0);
});
// Prevent unhandled promise errors from crashing application
process.on('unhandledRejection', (err: Error) => {
  if (err?.stack) {
    logger.error(err);
  }
});
