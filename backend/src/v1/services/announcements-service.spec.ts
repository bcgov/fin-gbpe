import { faker } from '@faker-js/faker';
import {
  DateTimeFormatter,
  LocalDateTime,
  ZonedDateTime,
  ZoneId,
} from '@js-joda/core';
import omit from 'lodash/omit';
import {
  AnnouncementDataType,
  AnnouncementStatus,
} from '../types/announcements';
import { UserInputError } from '../types/errors';
import { announcementService } from './announcements-service';
import { utils } from './utils-service';

const mockFindMany = jest.fn().mockResolvedValue([
  {
    id: 1,
    title: 'Announcement 1',
    description: 'Description 1',
    active_on: new Date(),
    expires_on: new Date(),
    status: 'active',
  },
  {
    id: 2,
    title: 'Announcement 2',
    description: 'Description 2',
    active_on: new Date(),
    expires_on: new Date(),
    status: 'active',
  },
]);

const mockUpdateMany = jest.fn();
const mockCreateAnnouncement = jest.fn();
const mockFindUniqueOrThrow = jest.fn();
const mockUpdate = jest.fn();
const mockDeleteMany = jest.fn();

const mockHistoryCreate = jest.fn();
const mockFindManyResource = jest.fn();
const mockDeleteManyHistory = jest.fn();

const mockCreateResource = jest.fn();
const mockDeleteResource = jest.fn();
const mockUpdateResource = jest.fn();
const mockDeleteManyResource = jest.fn();

const mockDeleteManyResourceHistory = jest.fn();

jest.mock('../prisma/prisma-client', () => ({
  __esModule: true,
  default: {
    announcement: {
      findMany: (...args) => mockFindMany(...args),
      updateMany: (...args) => mockUpdateMany(...args),
      create: (...args) => mockCreateAnnouncement(...args),
      findUniqueOrThrow: (...args) => mockFindUniqueOrThrow(...args),
      count: jest.fn().mockResolvedValue(2),
      groupBy: jest.fn().mockResolvedValueOnce([
        { status: 'PUBLISHED', _count: 1 },
        { status: 'DRAFT', _count: 2 },
      ]),
    },
    announcement_history: {
      create: (...args) => mockHistoryCreate(...args),
    },
    announcement_resource: {
      findMany: (...args) => mockFindManyResource(...args),
    },
    $transaction: jest.fn().mockImplementation((cb) =>
      cb({
        announcement: {
          findMany: (...args) => mockFindMany(...args),
          updateMany: (...args) => mockUpdateMany(...args),
          findUniqueOrThrow: (...args) => mockFindUniqueOrThrow(...args),
          update: (...args) => mockUpdate(...args),
          deleteMany: (...args) => mockDeleteMany(...args),
        },
        announcement_resource: {
          create: (...args) => mockCreateResource(...args),
          update: (...args) => mockUpdateResource(...args),
          delete: (...args) => mockDeleteResource(...args),
          deleteMany: (...args) => mockDeleteManyResource(...args),
        },
        announcement_history: {
          create: (...args) => mockHistoryCreate(...args),
          update: (...args) => mockUpdateResource(...args),
          deleteMany: (...args) => mockDeleteManyHistory(...args),
        },
        announcement_resource_history: {
          deleteMany: (...args) => mockDeleteManyResourceHistory(...args),
        },
        $executeRawUnsafe: jest.fn(),
      }),
    ),
  },
}));

const mockS3ApiDeleteFiles = jest.fn();
jest.mock('../../external/services/s3-api', () => ({
  deleteFiles: (...args) => mockS3ApiDeleteFiles(...args),
}));

jest.mock('../../config', () => ({
  config: {
    get: (key: string) => {
      const settings = {
        'server:schedulerTimeZone': 'America/Vancouver',
        'server:deleteAnnouncementsDurationInDays': '90',
      };
      return settings[key];
    },
  },
}));

describe('AnnouncementsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAnnouncements', () => {
    describe('when no query is provided', () => {
      it('should return announcements', async () => {
        const announcements = await announcementService.getAnnouncements();
        expect(announcements.items).toHaveLength(2);
        expect(announcements.total).toBe(2);
        expect(announcements.offset).toBe(0);
        expect(announcements.limit).toBe(10);
        expect(announcements.totalPages).toBe(1);
        expect(mockFindMany).toHaveBeenCalledTimes(1);
        expect(mockFindMany).toHaveBeenCalledWith({
          where: {
            AND: [],
          },
          orderBy: [],
          include: { announcement_resource: true },
          take: 10,
          skip: 0,
        });
      });
    });

    describe('when query is provided', () => {
      describe('when filters are provided', () => {
        describe('when there are dates in the filter', () => {
          it('dates in the filters are converted to UTC', async () => {
            await announcementService.getAnnouncements({
              filters: [
                {
                  key: 'active_on',
                  operation: 'between',
                  value: [
                    '2024-10-02T00:00:00-07:00', //time in Pacific daylight time (PDT)
                    '2024-10-02T23:59:59-07:00',
                  ],
                },
              ],
            });
            expect(mockFindMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  AND: [
                    {
                      active_on: {
                        gte: '2024-10-02T07:00:00Z', //time in UTC
                        lt: '2024-10-03T06:59:59Z',
                      },
                    },
                  ],
                }),
              }),
            );
          });
        });
        describe('when title is provided', () => {
          it('should return announcements', async () => {
            await announcementService.getAnnouncements({
              filters: [
                { key: 'title', operation: 'like', value: 'Announcement 1' },
              ],
            });
            expect(mockFindMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  AND: [
                    {
                      title: {
                        contains: 'Announcement 1',
                        mode: 'insensitive',
                      },
                    },
                  ],
                }),
              }),
            );
          });
        });
        describe('when active_on filter is provided', () => {
          describe('when operation is "between"', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'active_on',
                    operation: 'between',
                    value: ['2022-01-01', '2022-12-31'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [
                      { active_on: { gte: '2022-01-01', lt: '2022-12-31' } },
                    ],
                  }),
                }),
              );
            });
          });
          describe('when operation is "lte"', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'active_on',
                    operation: 'lte',
                    value: ['2022-01-01'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [{ active_on: { lte: ['2022-01-01'] } }],
                  }),
                }),
              );
            });
          });
          describe('when operation is "gt"', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'active_on',
                    operation: 'gt',
                    value: ['2022-01-01'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [{ active_on: { gt: ['2022-01-01'] } }],
                  }),
                }),
              );
            });
          });
        });
        describe('when expires_on filter is provided', () => {
          describe('when operation is "between"', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'expires_on',
                    operation: 'between',
                    value: ['2022-01-01', '2022-12-31'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [
                      { expires_on: { gte: '2022-01-01', lt: '2022-12-31' } },
                    ],
                  }),
                }),
              );
            });
          });
          describe('when operation is "lte"', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'expires_on',
                    operation: 'lte',
                    value: ['2022-01-01'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [{ expires_on: { lte: ['2022-01-01'] } }],
                  }),
                }),
              );
            });
          });
          describe('when operation is "gt"', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'expires_on',
                    operation: 'gt',
                    value: ['2022-01-01'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [
                      {
                        OR: [
                          { expires_on: { gt: ['2022-01-01'] } },
                          { expires_on: null },
                        ],
                      },
                    ],
                  }),
                }),
              );
            });
          });
        });

        describe('when status filter is provided', () => {
          describe('in operation', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'status',
                    operation: 'in',
                    value: ['DRAFT'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [{ status: { in: ['DRAFT'] } }],
                  }),
                }),
              );
            });
          });

          describe('notin operation', () => {
            it('should return announcements', async () => {
              await announcementService.getAnnouncements({
                filters: [
                  {
                    key: 'status',
                    operation: 'notin',
                    value: ['DRAFT'],
                  },
                ],
              });
              expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  where: expect.objectContaining({
                    AND: [{ status: { not: { in: ['DRAFT'] } } }],
                  }),
                }),
              );
            });
          });
        });
      });

      describe('when sort is provided', () => {
        it('should return announcements', async () => {
          await announcementService.getAnnouncements({
            sort: [{ field: 'title', order: 'asc' }],
          });
          expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
              orderBy: [{ title: 'asc' }],
            }),
          );
        });
      });

      describe('when limit is provided', () => {
        it('should return announcements', async () => {
          await announcementService.getAnnouncements({ limit: 5 });
          expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
              take: 5,
            }),
          );
        });
      });

      describe('when offset is provided', () => {
        it('should return announcements', async () => {
          await announcementService.getAnnouncements({ offset: 5 });
          expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
              skip: 5,
            }),
          );
        });
      });
    });
  });

  describe('patchAnnouncements', () => {
    describe('when provided a list of objects and at least one requests an invalid status change', () => {
      it('throws a UserInputError', async () => {
        const data: any = [
          { id: '1', status: AnnouncementStatus.Archived }, //is supported
          { id: '2', status: AnnouncementStatus.Published }, //isn't supported
        ];
        const mockUserId = 'user-id';
        await expect(
          announcementService.patchAnnouncements(data, mockUserId),
        ).rejects.toThrow(UserInputError);
      });
    });
    describe('when provided a list of objects with valid status changes', () => {
      it("should change status and update the 'updated_by' and 'updated_date' cols", async () => {
        const mockUserId = 'user-id';
        const mockUpdateManyUnsafe = jest
          .spyOn(utils, 'updateManyUnsafe')
          .mockResolvedValue(null);
        mockFindMany.mockResolvedValue([
          {
            announcement_id: 4,
            title: 'Announcement 4',
            announcement_resource: [],
          },
          {
            announcement_id: 5,
            title: 'Announcement 5',
            announcement_resource: [],
          },
        ]);
        await announcementService.patchAnnouncements(
          [
            { id: '1', status: AnnouncementStatus.Archived },
            { id: '2', status: AnnouncementStatus.Draft },
            { id: '3', status: AnnouncementStatus.Expired },
          ],
          mockUserId,
        );
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              announcement_id: {
                in: ['1', '2', '3'],
              },
            },
          }),
        );
        expect(mockHistoryCreate).toHaveBeenCalledTimes(2);
        const updates = mockUpdateManyUnsafe.mock.calls[0][1];
        expect(updates).toStrictEqual([
          {
            announcement_id: '1',
            status: AnnouncementStatus.Archived,
            updated_by: mockUserId,
            updated_date: expect.any(Date),
          },
          {
            announcement_id: '2',
            status: AnnouncementStatus.Draft,
            updated_by: mockUserId,
            updated_date: expect.any(Date),
          },
          {
            announcement_id: '3',
            status: AnnouncementStatus.Expired,
            updated_by: mockUserId,
            updated_date: expect.any(Date),
          },
        ]);
      });
    });
  });

  describe('createAnnouncement', () => {
    it('should create announcement', async () => {
      const announcementInput: AnnouncementDataType = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        expires_on: faker.date.future().toISOString(),
        active_on: faker.date.recent().toISOString(),
        status: AnnouncementStatus.Published,
        linkDisplayName: faker.lorem.words(3),
        linkUrl: faker.internet.url(),
        attachmentId: 'attachment-id',
        fileDisplayName: faker.lorem.words(3),
      };
      await announcementService.createAnnouncement(
        announcementInput,
        'user-id',
      );
      expect(mockCreateAnnouncement).toHaveBeenCalledWith({
        data: {
          ...omit(
            announcementInput,
            'status',
            'linkDisplayName',
            'linkUrl',
            'attachmentId',
            'fileDisplayName',
          ),
          announcement_status: {
            connect: { code: AnnouncementStatus.Published },
          },
          announcement_resource: {
            createMany: {
              data: [
                {
                  display_name: announcementInput.fileDisplayName,
                  attachment_file_id: 'attachment-id',
                  resource_type: 'ATTACHMENT',
                  created_by: 'user-id',
                  updated_by: 'user-id',
                },
                {
                  display_name: announcementInput.linkDisplayName,
                  resource_url: announcementInput.linkUrl,
                  resource_type: 'LINK',
                  created_by: 'user-id',
                  updated_by: 'user-id',
                },
              ],
            },
          },
          admin_user_announcement_created_byToadmin_user: {
            connect: { admin_user_id: 'user-id' },
          },
          admin_user_announcement_updated_byToadmin_user: {
            connect: { admin_user_id: 'user-id' },
          },
        },
      });
    });
    it('should default to undefined dates', async () => {
      const announcementInput: AnnouncementDataType = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        expires_on: '',
        active_on: '',
        status: 'DRAFT',
        linkDisplayName: '',
        linkUrl: '',
      };
      await announcementService.createAnnouncement(
        announcementInput,
        'user-id',
      );
      expect(mockCreateAnnouncement).toHaveBeenCalledWith({
        data: {
          ...omit(announcementInput, 'status', 'linkDisplayName', 'linkUrl'),
          expires_on: undefined,
          active_on: undefined,
          announcement_status: {
            connect: { code: 'DRAFT' },
          },
          admin_user_announcement_created_byToadmin_user: {
            connect: { admin_user_id: 'user-id' },
          },
          admin_user_announcement_updated_byToadmin_user: {
            connect: { admin_user_id: 'user-id' },
          },
        },
      });
    });
  });

  describe('updateAnnouncement', () => {
    describe('with existing link resource', () => {
      it('should update announcement and resource', async () => {
        mockFindUniqueOrThrow.mockResolvedValue({
          id: 'announcement-id',
          announcement_resource: [
            { announcement_resource_id: 1, resource_type: 'LINK' },
          ],
        });
        const announcementInput: AnnouncementDataType = {
          title: faker.lorem.words(3),
          description: faker.lorem.words(10),
          expires_on: faker.date.future().toISOString(),
          active_on: faker.date.recent().toISOString(),
          status: AnnouncementStatus.Published,
          linkDisplayName: faker.lorem.words(3),
          linkUrl: faker.internet.url(),
        };
        await announcementService.updateAnnouncement(
          'announcement-id',
          announcementInput,
          'user-id',
        );
        expect(mockHistoryCreate).toHaveBeenCalled();
        expect(mockUpdateResource).toHaveBeenCalledWith({
          where: { announcement_resource_id: 1 },
          data: {
            display_name: announcementInput.linkDisplayName,
            resource_url: announcementInput.linkUrl,
            updated_by: 'user-id',
            update_date: expect.any(Date),
          },
        });
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { announcement_id: 'announcement-id' },
            data: expect.objectContaining({
              title: announcementInput.title,
              description: announcementInput.description,
              expires_on: announcementInput.expires_on,
              active_on: announcementInput.active_on,
              updated_date: expect.any(Date),
              announcement_status: {
                connect: { code: AnnouncementStatus.Published },
              },
              admin_user_announcement_updated_byToadmin_user: {
                connect: { admin_user_id: 'user-id' },
              },
            }),
          }),
        );
      });

      it('should delete resource', async () => {
        mockFindUniqueOrThrow.mockResolvedValue({
          id: 'announcement-id',
          announcement_resource: [
            { announcement_resource_id: 1, resource_type: 'LINK' },
          ],
        });
        const announcementInput: AnnouncementDataType = {
          title: faker.lorem.words(3),
          description: faker.lorem.words(10),
          expires_on: faker.date.recent().toISOString(),
          active_on: faker.date.future().toISOString(),
          status: AnnouncementStatus.Published,
        };
        await announcementService.updateAnnouncement(
          'announcement-id',
          announcementInput,
          'user-id',
        );
        expect(mockHistoryCreate).toHaveBeenCalled();
        expect(mockDeleteResource).toHaveBeenCalledWith({
          where: { announcement_resource_id: 1 },
        });
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { announcement_id: 'announcement-id' },
            data: expect.objectContaining({
              title: announcementInput.title,
              description: announcementInput.description,
              expires_on: announcementInput.expires_on,
              active_on: announcementInput.active_on,
              updated_date: expect.any(Date),
              announcement_status: {
                connect: { code: AnnouncementStatus.Published },
              },
              admin_user_announcement_updated_byToadmin_user: {
                connect: { admin_user_id: 'user-id' },
              },
            }),
          }),
        );
      });
    });

    describe('without existing link resource', () => {
      it('should update announcement and create resource', async () => {
        mockFindUniqueOrThrow.mockResolvedValue({
          id: 'announcement-id',
          announcement_resource: [],
        });
        const announcementInput: AnnouncementDataType = {
          title: faker.lorem.words(3),
          description: faker.lorem.words(10),
          expires_on: faker.date.recent().toISOString(),
          active_on: faker.date.future().toISOString(),
          status: AnnouncementStatus.Published,
          linkDisplayName: faker.lorem.words(3),
          linkUrl: faker.internet.url(),
        };
        const now = new Date();
        await announcementService.updateAnnouncement(
          'announcement-id',
          announcementInput,
          'user-id',
        );
        expect(mockHistoryCreate).toHaveBeenCalled();
        expect(mockCreateResource).toHaveBeenCalledWith({
          data: {
            display_name: announcementInput.linkDisplayName,
            resource_url: announcementInput.linkUrl,
            admin_user_announcement_resource_created_byToadmin_user: {
              connect: { admin_user_id: 'user-id' },
            },
            admin_user_announcement_resource_updated_byToadmin_user: {
              connect: { admin_user_id: 'user-id' },
            },
            announcement: {
              connect: {
                announcement_id: 'announcement-id',
              },
            },
            announcement_resource_type: {
              connect: { code: 'LINK' },
            },
          },
        });
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { announcement_id: 'announcement-id' },
            data: expect.objectContaining({
              title: announcementInput.title,
              description: announcementInput.description,
              expires_on: announcementInput.expires_on,
              active_on: announcementInput.active_on,
              updated_date: expect.any(Date),
              announcement_status: {
                connect: { code: AnnouncementStatus.Published },
              },
              admin_user_announcement_updated_byToadmin_user: {
                connect: { admin_user_id: 'user-id' },
              },
            }),
          }),
        );

        //Ensure the update date saved to the database is approximately now
        //(within 5 seconds of now)
        const updateObj = mockUpdate.mock.calls[0][0];
        const updatedDate = updateObj.data.updated_date;
        const expectedUpdateDate = now;
        const updateDateDiffMs =
          updatedDate.getTime() - expectedUpdateDate.getTime();
        expect(updateDateDiffMs).toBeGreaterThanOrEqual(0);
        expect(updateDateDiffMs).toBeLessThan(5000);
      });
    });
    describe('with existing attachment resource', () => {
      it('should update announcement and resource', async () => {
        const attachmentId = faker.string.uuid();
        mockFindUniqueOrThrow.mockResolvedValue({
          id: 'announcement-id',
          announcement_resource: [
            {
              announcement_resource_id: attachmentId,
              resource_type: 'ATTACHMENT',
            },
          ],
        });
        const announcementInput: AnnouncementDataType = {
          title: faker.lorem.words(3),
          description: faker.lorem.words(10),
          expires_on: faker.date.recent().toISOString(),
          active_on: faker.date.future().toISOString(),
          status: AnnouncementStatus.Published,
          attachmentId: attachmentId,
          fileDisplayName: faker.lorem.words(3),
        };
        await announcementService.updateAnnouncement(
          'announcement-id',
          announcementInput,
          'user-id',
        );
        expect(mockHistoryCreate).toHaveBeenCalled();
        expect(mockUpdateResource).toHaveBeenCalledWith({
          where: { announcement_resource_id: attachmentId },
          data: {
            display_name: announcementInput.fileDisplayName,
            attachment_file_id: announcementInput.attachmentId,
            updated_by: 'user-id',
            update_date: expect.any(Date),
          },
        });
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { announcement_id: 'announcement-id' },
            data: expect.objectContaining({
              title: announcementInput.title,
              description: announcementInput.description,
              expires_on: announcementInput.expires_on,
              active_on: announcementInput.active_on,
              updated_date: expect.any(Date),
              announcement_status: {
                connect: { code: AnnouncementStatus.Published },
              },
              admin_user_announcement_updated_byToadmin_user: {
                connect: { admin_user_id: 'user-id' },
              },
            }),
          }),
        );
      });

      describe('and attachmentId is not provided in the input', () => {
        it('should set attachment id to null', async () => {
          const attachmentId = faker.string.uuid();
          mockFindUniqueOrThrow.mockResolvedValue({
            id: 'announcement-id',
            announcement_resource: [
              {
                announcement_resource_id: attachmentId,
                resource_type: 'ATTACHMENT',
              },
            ],
          });
          const announcementInput: AnnouncementDataType = {
            title: faker.lorem.words(3),
            description: faker.lorem.words(10),
            expires_on: faker.date.recent().toISOString(),
            active_on: faker.date.future().toISOString(),
            status: 'PUBLISHED',
          };
          await announcementService.updateAnnouncement(
            'announcement-id',
            announcementInput,
            'user-id',
          );
          expect(mockHistoryCreate).toHaveBeenCalled();
          expect(mockUpdateResource).toHaveBeenCalledWith({
            where: { announcement_resource_id: attachmentId },
            data: {
              attachment_file_id: null,
              updated_by: 'user-id',
              update_date: expect.any(Date),
            },
          });
        });
      });
    });

    describe('without existing attachment resource', () => {
      it('should update announcement and create resource', async () => {
        mockFindUniqueOrThrow.mockResolvedValue({
          id: 'announcement-id',
          announcement_resource: [],
        });
        const announcementInput: AnnouncementDataType = {
          title: faker.lorem.words(3),
          description: faker.lorem.words(10),
          expires_on: faker.date.recent().toISOString(),
          active_on: faker.date.future().toISOString(),
          status: AnnouncementStatus.Published,
          attachmentId: faker.string.uuid(),
          fileDisplayName: faker.lorem.word(),
        };
        await announcementService.updateAnnouncement(
          'announcement-id',
          announcementInput,
          'user-id',
        );
        expect(mockHistoryCreate).toHaveBeenCalled();
        expect(mockCreateResource).toHaveBeenCalledWith({
          data: {
            display_name: announcementInput.fileDisplayName,
            attachment_file_id: announcementInput.attachmentId,
            admin_user_announcement_resource_created_byToadmin_user: {
              connect: { admin_user_id: 'user-id' },
            },
            admin_user_announcement_resource_updated_byToadmin_user: {
              connect: { admin_user_id: 'user-id' },
            },
            announcement: {
              connect: {
                announcement_id: 'announcement-id',
              },
            },
            announcement_resource_type: {
              connect: { code: 'ATTACHMENT' },
            },
          },
        });
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { announcement_id: 'announcement-id' },
            data: expect.objectContaining({
              title: announcementInput.title,
              description: announcementInput.description,
              expires_on: announcementInput.expires_on,
              active_on: announcementInput.active_on,
              updated_date: expect.any(Date),
              announcement_status: {
                connect: { code: AnnouncementStatus.Published },
              },
              admin_user_announcement_updated_byToadmin_user: {
                connect: { admin_user_id: 'user-id' },
              },
            }),
          }),
        );
      });
    });

    it('should default to null dates', async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        id: 'announcement-id',
        announcement_resource: [],
      });
      const announcementInput: AnnouncementDataType = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        expires_on: '',
        active_on: '',
        status: 'DRAFT',
        linkDisplayName: '',
        linkUrl: '',
      };
      await announcementService.updateAnnouncement(
        'announcement-id',
        announcementInput,
        'user-id',
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { announcement_id: 'announcement-id' },
          data: expect.objectContaining({
            expires_on: null,
            active_on: null,
          }),
        }),
      );
    });
    it('should change the active_on date if the announcement becomes published', async () => {
      // If a draft announcement was created an hour ago with the current time as the active_on time, then when
      // saving as published with the time an hour ago, the active_on time should be changed to now().
      const draftActiveDate = ZonedDateTime.now()
        .minusHours(1)
        .format(DateTimeFormatter.ISO_DATE_TIME);
      mockFindUniqueOrThrow.mockResolvedValue({
        id: 'announcement-id',
        active_on: draftActiveDate,
        status: 'DRAFT',
        announcement_resource: [],
      });
      const announcementInput: AnnouncementDataType = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        expires_on: '',
        active_on: draftActiveDate,
        status: 'PUBLISHED',
        linkDisplayName: '',
        linkUrl: '',
      };
      await announcementService.updateAnnouncement(
        'announcement-id',
        announcementInput,
        'user-id',
      );
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            active_on: draftActiveDate,
          }),
        }),
      );
    });
    it("shouldn't change the active_on date if the announcement is already published", async () => {
      // If a published announcement was created an hour ago with the current time as the
      // active_on time, then don't change the active_on time. It needs to remain as it was.
      const draftActiveDate = ZonedDateTime.now()
        .minusHours(1)
        .format(DateTimeFormatter.ISO_DATE_TIME);
      mockFindUniqueOrThrow.mockResolvedValue({
        id: 'announcement-id',
        active_on: draftActiveDate,
        status: 'PUBLISHED',
        announcement_resource: [],
      });
      const announcementInput: AnnouncementDataType = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        expires_on: '',
        active_on: draftActiveDate,
        status: 'PUBLISHED',
        linkDisplayName: '',
        linkUrl: '',
      };
      await announcementService.updateAnnouncement(
        'announcement-id',
        announcementInput,
        'user-id',
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            active_on: draftActiveDate,
          }),
        }),
      );
    });
    it("shouldn't change the active_on date if the date is in the future", async () => {
      // If an announcement was created to have an active_on time in the future, then
      // don't change the active_on time. It needs to remain as it is.
      const draftActiveDate = ZonedDateTime.now()
        .plusHours(1)
        .format(DateTimeFormatter.ISO_DATE_TIME);
      mockFindUniqueOrThrow.mockResolvedValue({
        id: 'announcement-id',
        active_on: draftActiveDate,
        status: 'DRAFT',
        announcement_resource: [],
      });
      const announcementInput: AnnouncementDataType = {
        title: faker.lorem.words(3),
        description: faker.lorem.words(10),
        expires_on: '',
        active_on: draftActiveDate,
        status: 'PUBLISHED',
        linkDisplayName: '',
        linkUrl: '',
      };
      await announcementService.updateAnnouncement(
        'announcement-id',
        announcementInput,
        'user-id',
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            active_on: draftActiveDate,
          }),
        }),
      );
    });
  });

  describe('expireAnnouncement', () => {
    describe('when there are no announcements to expire', () => {
      it('exits without updating any announcements', async () => {
        mockFindMany.mockResolvedValue([]);
        const patchAnnouncementsMock = jest
          .spyOn(announcementService, 'patchAnnouncements')
          .mockImplementation();
        await announcementService.expireAnnouncements();
        expect(mockFindMany).toHaveBeenCalled();
        expect(patchAnnouncementsMock).not.toHaveBeenCalled();
      });
    });
    describe('when there are some announcements to expire', () => {
      it('updates the announcements', async () => {
        mockFindMany.mockResolvedValue([{ announcement_id: '123' }]);
        const patchAnnouncementsMock = jest.spyOn(
          announcementService,
          'patchAnnouncements',
        );
        await announcementService.expireAnnouncements();
        expect(mockFindMany).toHaveBeenCalled();
        expect(patchAnnouncementsMock).toHaveBeenCalled();
      });
    });
  });

  describe('getExpiringAnnouncements', () => {
    it('should return only announcements that will expire', async () => {
      jest
        .spyOn(ZonedDateTime, 'now')
        .mockImplementationOnce((zone: ZoneId) =>
          ZonedDateTime.of(
            LocalDateTime.parse('2024-08-26T11:38:23.561'),
            zone,
          ),
        );
      await announcementService.getExpiringAnnouncements();

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          expires_on: {
            gte: new Date('2024-09-09T07:00:00.000Z'),
            lt: new Date('2024-09-10T07:00:00.000Z'),
          },
          status: AnnouncementStatus.Published,
        },
      });
    });
  });

  describe('getAnnouncementById', () => {
    it('should return announcement by id', async () => {
      await announcementService.getAnnouncementById('1');
      expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
        where: { announcement_id: '1' },
        include: { announcement_resource: true },
      });
    });
  });

  describe('getAnnouncementMetrics', () => {
    it('should return the announcement metrics', async () => {
      // Act
      const result = await announcementService.getAnnouncementMetrics();

      // Assert
      expect(result).toEqual({
        published: { count: 1 },
        draft: { count: 2 },
      });
    });
  });

  describe('deleteAnnouncementsSchedule', () => {
    it('should delete announcements and associated resources successfully', async () => {
      mockFindMany.mockResolvedValueOnce([
        { announcement_id: 1, title: 'Announcement 1' },
        { announcement_id: 2, title: 'Announcement 2' },
      ]);
      mockFindManyResource.mockResolvedValueOnce([
        { announcement_id: 1, attachment_file_id: 'file1' },
        { announcement_id: 2, attachment_file_id: 'file2' },
      ]);

      mockS3ApiDeleteFiles.mockResolvedValue(new Set(['file1', 'file2'])); // files deleted

      mockDeleteManyResourceHistory.mockResolvedValue({});
      mockDeleteManyResource.mockResolvedValue({});
      mockDeleteManyHistory.mockResolvedValue({});
      mockDeleteMany.mockResolvedValue({});

      await announcementService.deleteAnnouncementsSchedule();

      expect(mockS3ApiDeleteFiles).toHaveBeenCalledWith(['file1', 'file2']);

      // Two files, so each of these are called twice
      expect(mockDeleteManyResourceHistory).toHaveBeenCalledTimes(2);
      expect(mockDeleteManyResource).toHaveBeenCalledTimes(2);
      expect(mockDeleteManyHistory).toHaveBeenCalledTimes(2);
      expect(mockDeleteMany).toHaveBeenCalledTimes(2);
    });

    it("shouldn't delete from the database when s3 fails to delete files", async () => {
      mockFindMany.mockResolvedValueOnce([
        { announcement_id: 1, title: 'Announcement 1' },
        { announcement_id: 2, title: 'Announcement 2' },
      ]);
      mockFindManyResource.mockResolvedValueOnce([
        { announcement_id: 1, attachment_file_id: 'file1' },
        { announcement_id: 2, attachment_file_id: 'file2' },
      ]);

      mockS3ApiDeleteFiles.mockResolvedValue(new Set(['file2'])); // only deleted one file

      await announcementService.deleteAnnouncementsSchedule();

      // Even though there are two files, only one of them was deleted
      expect(mockDeleteManyResourceHistory).toHaveBeenCalledTimes(1);
      expect(mockDeleteManyResource).toHaveBeenCalledTimes(1);
      expect(mockDeleteManyHistory).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { announcement_id: 2 },
      });
    });

    it("shouldn't do anything if there's nothing to delete", async () => {
      //test that no announcements were found
      mockFindMany.mockResolvedValueOnce([]);
      await announcementService.deleteAnnouncementsSchedule();
      expect(mockFindManyResource).toHaveBeenCalledTimes(0); //should return before this function is called
    });

    it("shouldn't do anything if nothing is safe to delete", async () => {
      //test that if the resources that were found couldn't be deleted from s3, then nothing happens
      mockFindMany.mockResolvedValueOnce([
        { announcement_id: 1, title: 'Announcement 1' },
        { announcement_id: 2, title: 'Announcement 2' },
      ]);
      mockFindManyResource.mockResolvedValueOnce([
        { announcement_id: 1, attachment_file_id: 'file1' },
        { announcement_id: 2, attachment_file_id: 'file2' },
      ]);
      mockS3ApiDeleteFiles.mockResolvedValue(new Set([])); // didn't delete anything

      await announcementService.deleteAnnouncementsSchedule();
      expect(mockDeleteManyHistory).toHaveBeenCalledTimes(0); //should return before this function is called
    });

    it('should log if database failed to delete', async () => {
      //test that if the resources that were found couldn't be deleted from s3, then nothing happens
      mockFindMany.mockResolvedValueOnce([
        { announcement_id: 1, title: 'Announcement 1' },
        { announcement_id: 2, title: 'Announcement 2' },
      ]);
      mockFindManyResource.mockResolvedValueOnce([
        { announcement_id: 1, attachment_file_id: 'file1' },
        { announcement_id: 2, attachment_file_id: 'file2' },
      ]);
      mockS3ApiDeleteFiles.mockResolvedValue(new Set(['file1'])); // didn't delete anything
      mockDeleteManyResourceHistory.mockRejectedValue(new Error('err'));

      await announcementService.deleteAnnouncementsSchedule();
      expect(mockDeleteManyResourceHistory).toHaveBeenCalledTimes(1);
      expect(mockDeleteManyHistory).toHaveBeenCalledTimes(0); //should error before this function is called
    });
  });
});
