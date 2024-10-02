import {
  convert,
  DateTimeFormatter,
  LocalDateTime,
  ZonedDateTime,
  ZoneId,
} from '@js-joda/core';
import {
  announcement,
  announcement_resource,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
import isEmpty from 'lodash/isEmpty';
import { logger } from '../../logger';
import prisma from '../prisma/prisma-client';
import { PaginatedResult } from '../types';
import {
  AnnouncementDataType,
  AnnouncementQueryType,
  AnnouncementStatus,
  PatchAnnouncementsType,
} from '../types/announcements';
import { UserInputError } from '../types/errors';
import { utils } from './utils-service';
import { config } from '../../config';
import '@js-joda/timezone';

const saveHistory = async (
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  announcement: announcement & {
    announcement_resource: announcement_resource[];
  },
) => {
  const announcement_history = { ...announcement };
  delete announcement_history.announcement_resource;

  return tx.announcement_history.create({
    data: {
      ...announcement_history,
      announcement_resource_history: {
        createMany: {
          data: announcement.announcement_resource.map((resource) => ({
            ...resource,
          })),
        },
      },
    },
  });
};

const buildAnnouncementWhereInput = (query: AnnouncementQueryType) => {
  const allFilters = [];

  if (query.filters) {
    query.filters.forEach((filter) => {
      const attrFilter = {};
      switch (filter.key) {
        case 'active_on':
          if (filter.operation === 'between') {
            attrFilter[filter.key] = {
              gte: filter.value[0],
              lt: filter.value[1],
            };
          } else if (filter.operation === 'lte') {
            attrFilter[filter.key] = { lte: filter.value };
          } else if (filter.operation === 'gt') {
            attrFilter[filter.key] = { gt: filter.value };
          }
          break;
        case 'expires_on':
          if (filter.operation === 'between') {
            attrFilter[filter.key] = {
              gte: filter.value[0],
              lt: filter.value[1],
            };
          } else if (filter.operation === 'lte') {
            attrFilter[filter.key] = { lte: filter.value };
          } else if (filter.operation === 'gt') {
            //For 'expires_on' filters with operation='gt', assume we also want
            //to return records with a null values (null means never expires)
            const lteFilter = {};
            lteFilter[filter.key] = { gt: filter.value };
            const nullFilter = {};
            nullFilter[filter.key] = null;
            attrFilter['OR'] = [lteFilter, nullFilter];
          }
          break;
        case 'status':
          attrFilter[filter.key] =
            filter.operation === 'in'
              ? { in: filter.value }
              : { not: { in: filter.value } };
          break;
        case 'title':
          attrFilter[filter.key] = {
            contains: filter.value,
            mode: 'insensitive',
          };
          break;
      }
      allFilters.push(attrFilter);
    });
  }

  const where: Prisma.announcementWhereInput = { AND: allFilters };
  return where;
};

const buildAnnouncementSortInput = (query: AnnouncementQueryType) => {
  const sort: Prisma.announcementOrderByWithRelationInput[] = [];
  if (query.sort) {
    (query.sort as any[]).forEach((sortField) => {
      sort.push({ [sortField.field]: sortField.order });
    });
  }
  return sort;
};

const DEFAULT_PAGE_SIZE = 10;

export const announcementService = {
  /**
   * Get announcements based on query parameters
   * @param query
   * @returns
   */
  async getAnnouncements(
    query: AnnouncementQueryType = {},
  ): Promise<PaginatedResult<announcement>> {
    const where = buildAnnouncementWhereInput(query);
    const orderBy = buildAnnouncementSortInput(query);
    const items = await prisma.announcement.findMany({
      where,
      orderBy,
      take: query.limit || DEFAULT_PAGE_SIZE,
      skip: query.offset || 0,
      include: {
        announcement_resource: true,
      },
    });
    const total = await prisma.announcement.count({ where });

    return {
      items,
      total,
      limit: query.limit || DEFAULT_PAGE_SIZE,
      offset: query.offset || 0,
      totalPages: Math.ceil(total / (query.limit || DEFAULT_PAGE_SIZE)),
    };
  },
  /**
   * Get announcement by id
   * @param id
   * @returns
   */
  async getAnnouncementById(id: string): Promise<announcement> {
    return prisma.announcement.findUniqueOrThrow({
      where: {
        announcement_id: id,
      },
      include: {
        announcement_resource: true,
      },
    });
  },

  /**
   * Patch announcements by ids.
   * This method also copies the original record into the announcement history table.
   * @param data - array of objects with format:
   * { id: announcement_id, status: status}
   * Currently the 'status' attribute is the only attribute that supports patching,
   * and the only status values that are supported are ['DELETED', 'DRAFT', 'EXPIRED']
   * @param userId - user id who is patching the announcements, or undefined
   * if no 'updated_by' user should be recorded
   * @param tx - an optional Prisma transaction.  if specified, performs the work within
   * the given existing transaction.  if omitted, performs the workin within a new
   * transaction
   */
  async patchAnnouncements(
    data: PatchAnnouncementsType,
    userId: string | null = null,
    tx?: any,
  ) {
    const supportedStatuses = [
      AnnouncementStatus.Deleted,
      AnnouncementStatus.Draft,
      AnnouncementStatus.Expired,
    ];
    const hasUnsupportedUpdates = data.filter(
      (item) => supportedStatuses.indexOf(item.status as any) < 0,
    ).length;
    if (hasUnsupportedUpdates) {
      throw new UserInputError(
        `Invalid status. Only the following statuses are supported: ${supportedStatuses}`,
      );
    }

    //An inner function which performs the database updates associated with
    //this patch operation.
    const applyPatch = async (tx) => {
      const announcements = await tx.announcement.findMany({
        where: { announcement_id: { in: data.map((item) => item.id) } },
        include: { announcement_resource: true },
      });

      for (const announcement of announcements) {
        await saveHistory(tx, announcement);
      }
      const updateDate = ZonedDateTime.now(ZoneId.UTC);

      const updates = data
        .filter((item) => supportedStatuses.indexOf(item.status as any) >= 0)
        .map((item) => ({
          announcement_id: item.id,
          status: item.status,
          updated_by: userId,
          updated_date: convert(updateDate).toDate(),
        }));

      const typeHints = {
        updated_by: 'UUID',
      };
      //None of the data passed to this method is directly from user input.
      //The input 'data' object is validated and then translated into another form
      //(the 'updates' object).  For these reasons it is considerer safe to
      //run a database statement ('updateManyUnsafe') that does not internally
      //perform data safety checks.
      await utils.updateManyUnsafe(
        tx,
        updates,
        typeHints,
        'announcement',
        'announcement_id',
      );
    };

    //If there is an existing transaction, apply the patch within it, otherwise
    //create a new transaction and apply the patch within that.
    const enterTransaction = tx
      ? applyPatch(tx)
      : prisma.$transaction(applyPatch);

    return enterTransaction;
  },

  /**
   * Create announcement
   * @param data - announcement data
   */
  async createAnnouncement(input: AnnouncementDataType, currentUserId: string) {
    const resources: Prisma.announcement_resourceCreateManyAnnouncementInput[] =
      [];
    if (input.attachmentId && input.fileDisplayName) {
      resources.push({
        display_name: input.fileDisplayName,
        attachment_file_id: input.attachmentId,
        resource_type: 'ATTACHMENT',
        created_by: currentUserId,
        updated_by: currentUserId,
      });
    }

    if (input.linkUrl) {
      resources.push({
        display_name: input.linkDisplayName,
        resource_url: input.linkUrl,
        resource_type: 'LINK',
        created_by: currentUserId,
        updated_by: currentUserId,
      });
    }

    if (
      !isEmpty(input.active_on) &&
      ZonedDateTime.parse(input.active_on).isBefore(ZonedDateTime.now())
    ) {
      input.active_on = ZonedDateTime.now().format(
        DateTimeFormatter.ISO_INSTANT,
      );
    }

    const data: Prisma.announcementCreateInput = {
      title: input.title,
      description: input.description,
      announcement_status: {
        connect: { code: input.status },
      },
      active_on: !isEmpty(input.active_on) ? input.active_on : undefined,
      expires_on: !isEmpty(input.expires_on) ? input.expires_on : undefined,
      admin_user_announcement_created_byToadmin_user: {
        connect: { admin_user_id: currentUserId },
      },
      admin_user_announcement_updated_byToadmin_user: {
        connect: { admin_user_id: currentUserId },
      },
      announcement_resource:
        resources.length > 0 ? { createMany: { data: resources } } : undefined,
    };

    return prisma.announcement.create({
      data,
    });
  },

  /**
   * Update announcement
   * @param id - announcement id
   * @param data - announcement data
   */
  async updateAnnouncement(
    id: string,
    input: AnnouncementDataType,
    currentUserId: string,
  ) {
    const updateDate = convert(LocalDateTime.now(ZoneId.UTC)).toDate();
    await prisma.$transaction(async (tx) => {
      const announcementData = await tx.announcement.findUniqueOrThrow({
        where: {
          announcement_id: id,
        },
        include: {
          announcement_resource: true,
        },
      });

      await saveHistory(tx, announcementData);

      const currentLink = announcementData?.announcement_resource.find(
        (x) => x.resource_type === 'LINK',
      );

      if (input.linkUrl) {
        if (currentLink) {
          await tx.announcement_resource.update({
            where: {
              announcement_resource_id: currentLink.announcement_resource_id,
            },
            data: {
              display_name: input.linkDisplayName,
              resource_url: input.linkUrl,
              updated_by: currentUserId,
              update_date: updateDate,
            },
          });
        } else {
          await tx.announcement_resource.create({
            data: {
              display_name: input.linkDisplayName,
              resource_url: input.linkUrl,
              announcement_resource_type: {
                connect: { code: 'LINK' },
              },
              admin_user_announcement_resource_created_byToadmin_user: {
                connect: { admin_user_id: currentUserId },
              },
              admin_user_announcement_resource_updated_byToadmin_user: {
                connect: { admin_user_id: currentUserId },
              },
              announcement: {
                connect: {
                  announcement_id: id,
                },
              },
            },
          });
        }
      } else if (currentLink) {
        await tx.announcement_resource.delete({
          where: {
            announcement_resource_id: currentLink.announcement_resource_id,
          },
        });
      }

      const currentAttachment = announcementData?.announcement_resource.find(
        (x) => x.resource_type === 'ATTACHMENT',
      );
      if (input.attachmentId) {
        if (currentAttachment) {
          await tx.announcement_resource.update({
            where: {
              announcement_resource_id:
                currentAttachment.announcement_resource_id,
            },
            data: {
              display_name: input.fileDisplayName,
              attachment_file_id: input.attachmentId,
              updated_by: currentUserId,
              update_date: updateDate,
            },
          });
        } else {
          await tx.announcement_resource.create({
            data: {
              display_name: input.fileDisplayName,
              attachment_file_id: input.attachmentId,
              announcement_resource_type: {
                connect: { code: 'ATTACHMENT' },
              },
              admin_user_announcement_resource_created_byToadmin_user: {
                connect: { admin_user_id: currentUserId },
              },
              admin_user_announcement_resource_updated_byToadmin_user: {
                connect: { admin_user_id: currentUserId },
              },
              announcement: {
                connect: {
                  announcement_id: id,
                },
              },
            },
          });
        }
      } else if (currentAttachment && !input.attachmentId) {
        await tx.announcement_resource.update({
          where: {
            announcement_resource_id:
              currentAttachment.announcement_resource_id,
          },
          data: {
            attachment_file_id: null,
            updated_by: currentUserId,
            update_date: updateDate,
          },
        });
      }

      if (
        input.status != AnnouncementStatus.Published && // If announcement is already published, don't change the active_on
        !isEmpty(input.active_on) &&
        ZonedDateTime.parse(input.active_on).isBefore(ZonedDateTime.now())
      ) {
        input.active_on = ZonedDateTime.now().format(
          DateTimeFormatter.ISO_INSTANT,
        );
      }

      const data: Prisma.announcementUpdateInput = {
        title: input.title,
        description: input.description,
        updated_date: updateDate,
        announcement_status: {
          connect: { code: input.status },
        },
        active_on: !isEmpty(input.active_on) ? input.active_on : null,
        expires_on: !isEmpty(input.expires_on) ? input.expires_on : null,
        admin_user_announcement_updated_byToadmin_user: {
          connect: { admin_user_id: currentUserId },
        },
      };

      return tx.announcement.update({
        where: { announcement_id: id },
        data,
      });
    });

    return this.getAnnouncementById(id);
  },

  /* Identifies announcements that should be expired.  If any such announcements
are found, marks them as expired */
  async expireAnnouncements() {
    const nowUtc = convert(ZonedDateTime.now(ZoneId.UTC)).toDate();
    await prisma.$transaction(async (tx) => {
      const announcements = await prisma.announcement.findMany({
        select: {
          announcement_id: true,
        },
        where: {
          status: AnnouncementStatus.Published,
          expires_on: {
            not: null,
            lte: nowUtc,
          },
        },
      });
      const patchData = announcements.map((a) => {
        return {
          id: a.announcement_id,
          status: AnnouncementStatus.Expired as any,
        };
      });
      if (patchData.length) {
        logger.info(
          `Marking ${patchData.length} announcement(s) as ${AnnouncementStatus.Expired}`,
        );
        await this.patchAnnouncements(patchData, undefined, tx);
      } else {
        logger.info(`Found no announcements that need to be expired`);
      }
    });
  },

  /** Get announcements that are 10 days away from expiring */
  async getExpiringAnnouncements(): Promise<announcement[]> {
    const zone = ZoneId.of(config.get('server:schedulerTimeZone'));
    const targetDate = ZonedDateTime.now(zone)
      .plusDays(14)
      .withHour(0)
      .withMinute(0)
      .withSecond(0)
      .withNano(0);

    const items = await prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.Published,
        expires_on: {
          gte: convert(targetDate).toDate(),
          lt: convert(targetDate.plusDays(1)).toDate(),
        },
      },
    });

    logger.info(
      `Found ${items.length} expiring announcements between ${targetDate.toString()} and ${targetDate.plusDays(1).toString()}`,
    );
    return items;
  },

  /**
   * Get announcement metrics
   * @param param0
   * @returns
   */
  async getAnnouncementMetrics() {
    const announcementsData = await prisma.announcement.groupBy({
      where: { status: { in: ['PUBLISHED', 'DRAFT'] } },
      by: ['status'],
      _count: true,
    });

    const announcementsMetrics = announcementsData.reduce((acc, curr) => {
      const key = curr.status.toLowerCase();
      return { ...acc, [key]: { count: curr._count } };
    }, {});

    return {
      ...announcementsMetrics,
    };
  },
};
