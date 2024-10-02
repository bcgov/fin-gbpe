import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import prom from 'prom-client';
import { logger } from './logger';
import { rateLimit } from 'express-rate-limit';
import promBundle from 'express-prom-bundle';
import { utils } from './utils';
import NodeClam from 'clamscan';
import formData from 'express-form-data';
import os from 'os';
import bodyParser from 'body-parser';
import PATH from 'path';
const register = new prom.Registry();
prom.collectDefaultMetrics({ register });
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  metricsPath: '/prom-metrics',
  promRegistry: register,
});
const _getClamAvScanner = async (): Promise<NodeClam> => {
  return new NodeClam().init({
    clamdscan: {
      host: config.get('clamav:host'),
      port: config.get('clamav:port'),
    },
  });
};
const app = express();
const apiRouter = express.Router();
const logStream = {
  write: (message) => {
    logger.info(message);
  },
};

app.use(helmet());

//tells the app to use json as means of transporting data
app.use(bodyParser.json({ limit: `50MB` }));
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: `50MB`,
  })
);

if ('production' === config.get('environment')) {
  app.set('trust proxy', 1);
}

app.use(
  morgan(
    ':method | :url | :status |  :response-time ms | :req[x-correlation-id] | :res[content-length]',
    {
      stream: logStream,
      skip: (req) => {
        return (
          req.baseUrl === '' || req.baseUrl === '/' || req.baseUrl === '/health'
        );
      },
    }
  )
);

if (config.get('server:rateLimit:enabled')) {
  const limiter = rateLimit({
    windowMs: config.get('server:rateLimit:windowMs'),
    limit: config.get('server:rateLimit:limit'),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers,
    skipSuccessfulRequests: true, // Do not count successful responses
  });
  app.use(limiter);
}
app.use(metricsMiddleware);
app.get(
  '/health',
  utils.asyncHandler(async (_req: Request, res: Response) => {
    try {
      res.status(200).send('Health check passed');
    } catch (e) {
      /* istanbul ignore next  */
      logger.error(`Health check failed: ${e}`);
      /* istanbul ignore next  */
      res.status(500).send('Health check failed');
    }
  })
);

app.use(/(\/clamav-api)?/, apiRouter);
apiRouter.get('/', (_req, res) => {
  res.sendStatus(200); // generally for route verification and health check.
});
const validateApiKey =
  (validKey: string) => (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.header('x-api-key');
    if (apiKey) {
      if (validKey === apiKey) {
        next();
      } else {
        logger.error('Invalid API Key');
        res.status(401).send({ message: 'Invalid API Key' });
      }
    } else {
      logger.error('API Key is missing in the request header');
      res.status(400).send({
        message: 'API Key is missing in the request header',
      });
    }
  };
apiRouter.post(
  '',
  validateApiKey(config.get('server:apiKey')),
  formData.parse({
    uploadDir: os.tmpdir(),
    autoClean: true,
  }),
  formData.union(),
  utils.asyncHandler(async (req: Request, res: Response) => {
    logger.info('Scanning file for virus');
    const { path, name } = req.body?.file;
    if (!path) {
      logger.error('File path is missing in the request body');
      res.status(400).send({
        message: 'File path is missing in the request body',
      });
    }

    const filePath = path; // fs.realpathSync(PATH.resolve(os.tmpdir(), path));
    logger.info(`File path: ${filePath}`);
    if (!filePath.startsWith(os.tmpdir())) {
      logger.error('File path is not starting with temp directory.');
      res.statusCode = 403;
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    const ClamAVScanner = await _getClamAvScanner();

    const clamavScanResult = await ClamAVScanner.scanStream(stream);
    if (clamavScanResult.isInfected) {
      logger.error(`File ${name} is infected`);
      res.status(400).send({
        message: `File ${name} is infected`,
        clamavScanResult,
      });
    } else {
      logger.info(`File ${name} is not infected`);
      res.status(200).send({
        message: `File ${name} is not infected`,
        clamavScanResult,
      });
    }
  })
);
app.use((_req: Request, res: Response) => {
  res.sendStatus(404);
});
app.use(
  /* istanbul ignore next  */
  (err: Error, _req: Request, res: Response) => {
    /* istanbul ignore if  */
    if (err?.stack) {
      logger.error(err);
    }
    res.sendStatus(500);
  }
);

export { app };
