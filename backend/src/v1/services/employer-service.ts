import prismaReadOnlyReplica from '../prisma/prisma-client-readonly-replica';
import {
  EmployerFilterType,
  EmployerKeyEnum,
  EmployerMetrics,
  EmployerSortType,
  IEmployerSearchResult,
} from '../types/employers';
import { Prisma } from '@prisma/client';
import { convert, ZonedDateTime, ZoneId } from '@js-joda/core';

export const employerService = {
  /**
   * Get employer metrics
   * @returns EmployerMetrics
   */
  async getEmployerMetrics(): Promise<EmployerMetrics> {
    const numEmployers =
      await prismaReadOnlyReplica.pay_transparency_company.count();
    return {
      num_employers_logged_on_to_date: numEmployers,
    };
  },

  /**   */
  async getEmployer(
    limit: number = 1000,
    offset: number = 0,
    sort: EmployerSortType = [{ field: 'company_name', order: 'asc' }],
    query: EmployerFilterType = [],
  ): Promise<IEmployerSearchResult> {
    const where: Prisma.pay_transparency_companyWhereInput = {};
    for (const q of query) {
      if (q.key == EmployerKeyEnum.Year) {
        const dates: Prisma.pay_transparency_companyWhereInput[] = [];
        for (const year of q.value) {
          const date = ZonedDateTime.of(year, 1, 1, 0, 0, 0, 0, ZoneId.UTC);
          dates.push({
            create_date: {
              gte: convert(date).toDate(),
              lt: convert(date.plusYears(1)).toDate(),
            },
          });
        }
        where['OR'] = dates;
      } else if (q.key == EmployerKeyEnum.Name) {
        where['company_name'] = { contains: q.value, mode: 'insensitive' };
      }
    }

    const orderBy: Prisma.pay_transparency_companyOrderByWithRelationInput[] =
      [];
    for (const s of sort) {
      if (s.field == 'create_date') orderBy.push({ create_date: s.order });
      else orderBy.push({ company_name: s.order });
    }

    const result =
      await prismaReadOnlyReplica.pay_transparency_company.findMany({
        select: {
          company_id: true,
          company_name: true,
          create_date: true,
        },
        where: where,
        orderBy: orderBy,
        take: limit,
        skip: offset,
      });

    const count = await prismaReadOnlyReplica.pay_transparency_company.count({
      where,
    });

    return {
      employers: result,
      total: count,
      totalPages: Math.ceil(count / limit),
      limit,
      offset,
    };
  },
};
