import { Application } from 'express';
import EventEmitter from 'node:events';

jest.mock('./app', () => ({
  app: {
    set: jest.fn(),
  },
}));

const mock_listen = jest.fn();

const emitter = new EventEmitter();

const mock_callbackHandler = jest.fn();
const mock_getServerAddress = jest.fn();

jest.mock('http', () => {
  return {
    createServer: (app: Application) => {
      return {
        listen: (...args) => mock_listen(...args),
        address: (...args) => mock_getServerAddress(...args),
        on: (event, callback) => {
          emitter.addListener(event, (...args) => {
            try {
              callback(...args);
              mock_callbackHandler(...args);
            } catch (error) {
              mock_callbackHandler.mockImplementation(() => {
                throw error;
              });
            }
          });
        },
      };
    },
  };
});

const mock_initBrowser = jest.fn();
const mock_browserDisconnect = jest.fn();
jest.mock('./v1/services/puppeteer-service', () => ({
  initBrowser: () => mock_initBrowser(),
  browser: {
    disconnect: () => mock_browserDisconnect(),
  },
}));

const mock_loggerInfo = jest.fn();
const mock_loggerError = jest.fn();

jest.mock('./logger', () => ({
  logger: {
    info: (...args) => mock_loggerInfo(...args),
    error: (...args) => mock_loggerError(...args),
  },
}));

let configMap: any;
const mock_getConfig = jest.fn();

// jest.mock('./config', () => ({
//   config: {
//     get: jest.fn((key) => mock_getConfig(key)),
//   },
// }));
jest.mock('./config', () => ({
  config: {
    get: (key) => {
      return configMap[key];
    },
  },
}));
describe('server', () => {
  beforeEach(() => {
    jest.resetModules();
  })

  describe('Start server on specified environment', () => {
    describe('local', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        configMap = {
          'server:apiKey': 'api-key',
          'server:port': 3000,
          environment: 'local',
        };
      });

      it('should start listening on the port', () => {
        require('./server');
        expect(mock_listen).toHaveBeenCalledWith(3000);
      });

      describe('Error handling', () => {
        it('should handle non syscall listen error', () => {
          require('./server');
          emitter.emit('error', { syscall: 'nolisten' });
          expect(mock_callbackHandler).toThrow();
        });

        it('should handle EACCES error code', () => {
          require('./server');
          emitter.emit('error', { syscall: 'listen', code: 'EACCES' });
          expect(mock_loggerError).toHaveBeenCalledWith(
            'Port 3000 requires elevated privileges',
          );
        });
        it('should handle EADDRINUSE error code', () => {
          require('./server');
          emitter.emit('error', { syscall: 'listen', code: 'EADDRINUSE' });
          expect(mock_loggerError).toHaveBeenCalledWith(
            'Port 3000 is already in use',
          );
        });

        it('should rethrow the error if error code is not set', () => {
          require('./server');
          emitter.emit('error', { syscall: 'listen' });
          expect(mock_callbackHandler).toThrow();
        });
      });

      describe('Listener handler', () => {
        it('should log when the server starts a listener', () => {
          mock_getServerAddress.mockImplementation(() => 'testserver');
          require('./server');
          emitter.emit('listening');
          expect(mock_loggerInfo).toHaveBeenCalledWith(
            'Listening on pipe testserver',
          );
        });
      });
    });

    describe('production', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        configMap = {
          'server:apiKey': 'api-key',
          'server:port': 3000,
          'environment': 'prod',
        };
      });
      it('should start listening on the port and use puppeteer', async () => {
        mock_initBrowser.mockImplementation(() => Promise.resolve());
        mock_browserDisconnect.mockImplementation(() => Promise.resolve());
        mock_listen.mockImplementation((port) => {
          expect(port).toBe(3000);
        });
        await require('./server');
        expect(mock_initBrowser).toHaveBeenCalled();
        expect(mock_browserDisconnect).toHaveBeenCalled();
      });
      it('should handle initBrowser catch', async () => {
        mock_initBrowser.mockImplementation(() => Promise.reject());
        mock_browserDisconnect.mockImplementation(() => Promise.resolve());
        jest.spyOn(process, 'exit').mockImplementation()
        await require('./server');
        expect(mock_initBrowser).toHaveBeenCalled();
      });
      it('should handle browser disconnect catch', async () => {
        mock_initBrowser.mockImplementation(() => Promise.resolve());
        mock_browserDisconnect.mockImplementation(() => Promise.reject());
        jest.spyOn(process, 'exit').mockImplementation()
        await require('./server');
      });
    });
  });

  
});
