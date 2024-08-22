import fs from 'fs';
import { logger } from '../../../logger';
import { config } from '../../../config';
import {
  PutObjectCommand,
  PutObjectCommandInput,
  S3,
  S3Client,
} from '@aws-sdk/client-s3';
import os from 'os';
import retry from 'async-retry';
import { bucket, S3_OPTIONS } from '../../../external/services/s3-api';


interface Options {
  folder: string;
}

export const useUpload = (options: Options) => {
  return async (req, res, next) => {
    const { file, ...data } = req.body;
    if (!file || !data.attachmentId) {
      return next();
    }
    logger.log('info', 'Uploading file to S3');

    const { path, name, type, size } = file;

    if (!path.startsWith(os.tmpdir())) {
      logger.error('File not uploaded to temp directory');
      return res.status(400).json({ message: 'Invalid request' });
    }

    try {
      const s3 = new S3Client(S3_OPTIONS);
      const stream = fs.createReadStream(path);
      const uploadParams: PutObjectCommandInput = {
        Bucket: bucket,
        Key: `${options.folder}/${data.attachmentId}/${name}`,
        Body: stream,
        ContentType: type,
        ContentLength: size,
      };

      const command = new PutObjectCommand(uploadParams);
      await retry(
        async () => {
          const results = await s3.send(command);
          return results;
        },
        { retries: 3 },
      );
      next();
    } catch (error) {
      logger.error(error);
      res.status(400).json({ message: 'Invalid request', error });
    }
  };
};
