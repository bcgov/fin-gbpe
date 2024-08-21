import { create } from 'lodash';
import { useUpload } from './upload';
import path from 'path';
import os from 'os';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
}));

jest.mock('fs', () => ({
  __esModule: true,
  ...jest.requireActual('fs'),
  default: {
    createReadStream: jest.fn(),
  },
}));
describe('upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('should upload a file', async () => {
    const req = {
      body: {
        attachmentId: '123',
        file: {
          path: path.join(os.tmpdir(), 'test.jpg'),
          name: 'test.jpg',
          size: 100,
          type: 'image/jpeg',
        },
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();
    await useUpload({ folder: 'app' })(req, res, next);
    expect(mockSend).toHaveBeenCalled();
  });

  it('should not upload a file', async () => {
    const req = {
      body: {},
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();
    await useUpload({ folder: 'app' })(req, res, next);
    expect(mockSend).not.toHaveBeenCalled();
  });

  describe('file not uploaded to temp directory', () => {
    it('should return 400', async () => {
      const req = {
        body: {
          attachmentId: '123',
          file: {
            path: '/invalid/test.jpg',
          },
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      await useUpload({ folder: 'app' })(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);

    });
  });

  it('should handle error', async () => {
    const req = {
      body: {
        attachmentId: '123',
        file: {
          path: path.join(os.tmpdir(), 'test.jpg'),
          name: 'test.jpg',
          size: 100,
          type: 'image/jpeg',
        },
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();
    mockSend.mockRejectedValue(new Error('Invalid request'));
    await useUpload({ folder: 'app' })(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid request',
      error: new Error('Invalid request'),
    });
  });
});
