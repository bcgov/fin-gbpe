import { faker } from '@faker-js/faker';
import bodyParser from 'body-parser';
import express, { Application } from 'express';
import qs from 'qs';
import request from 'supertest';
import router from './employer-routes';

const mockGetEmployer = jest.fn().mockResolvedValue({
  items: [],
  total: 0,
  offset: 0,
  limit: 10,
  totalPages: 0,
});

jest.mock('../services/employer-service', () => ({
  employerService: {
    getEmployer: (...args) => {
      return mockGetEmployer(...args);
    },
  },
}));

let app: Application;
describe('employer-routes', () => {
  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    app.use(router);
  });

  describe('GET /api/employer', () => {
    describe('query parameters', () => {
      describe('invalid parameters should succeed', () => {
        it('all should work and convert strings to numbers', async () => {
          await request(app)
            .get('/')
            .query(
              qs.stringify({
                limit: '50',
                offset: '0',
                sort: [
                  { field: 'create_date', order: 'asc' },
                  { field: 'company_name', order: 'desc' },
                ],
                filter: [
                  { key: 'company_name', operation: 'like', value: 'bc' },
                  {
                    key: 'create_year',
                    operation: 'in',
                    value: ['2023', '2024'],
                  },
                ],
              }),
            )
            .expect(200);
          expect(mockGetEmployer).toHaveBeenCalledWith(
            50,
            0,
            [
              { field: 'create_date', order: 'asc' },
              { field: 'company_name', order: 'desc' },
            ],
            [
              { key: 'company_name', operation: 'like', value: 'bc' },
              {
                key: 'create_year',
                operation: 'in',
                value: [2023, 2024],
              },
            ],
          );
        });
        it('should work with no parameters', async () => {
          await request(app).get('/').expect(200);
          expect(mockGetEmployer).toHaveBeenCalledWith(
            undefined,
            undefined,
            undefined,
            undefined,
          );
        });
      });
      describe('invalid parameters should fail', () => {
        it('sort query parameters are wrong', async () => {
          await request(app)
            .get('/')
            .query(
              qs.stringify({
                limit: '50',
                offset: '0',
                sort: [
                  { field: 'create_date', order: 'asd' }, //asd instead of asc
                ],
              }),
            )
            .expect(500);
        });
        it('filter query parameters are missing', async () => {
          await request(app)
            .get('/')
            .query(
              qs.stringify({
                limit: '50',
                offset: '0',
                filter: [
                  { key: 'company_name', operation: 'like', value: 'bc' },
                  {
                    key: 'create_year',
                    operation: 'of', //missing value
                  },
                ],
              }),
            )
            .expect(500);
        });
      });
    });
  });
});
