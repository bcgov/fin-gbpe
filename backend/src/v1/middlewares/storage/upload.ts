import fs from 'fs';
import { logger } from '../../../logger';
import {
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import os from 'os';
import retry from 'async-retry';
import { S3_BUCKET, S3_OPTIONS } from '../../../constants/admin';
import PATH from 'path';
import { v4 as uuidv4 } from 'uuid';

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
    const lastDotIndex = name?.lastIndexOf('.') ?? -1;
    const ext = lastDotIndex !== -1 ? name.substring(lastDotIndex + 1) : '';

    if (!path.startsWith(os.tmpdir())) {
      logger.error('File not uploaded to temp directory');
      return res.status(400).json({ message: 'Invalid request' });
    }

    try {
      const s3 = new S3Client(S3_OPTIONS);
      const filePath = fs.realpathSync(PATH.resolve(os.tmpdir(), path));
      if (!filePath.startsWith(os.tmpdir())) {
        logger.error('File path is not starting with temp directory.');
        res.statusCode = 403;
        res.end();
        return;
      }
      const stream = fs.createReadStream(path);
      const uploadParams: PutObjectCommandInput = {
        Bucket: S3_BUCKET,
        Key: `${options.folder}/${data.attachmentId}/${uuidv4()}.${ext}`,
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
