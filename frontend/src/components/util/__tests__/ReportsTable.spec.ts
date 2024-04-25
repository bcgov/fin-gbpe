import { expect, describe, it, vi, beforeEach } from 'vitest';

import { render, waitFor, fireEvent } from '@testing-library/vue';
import { createTestingPinia } from '@pinia/testing';
import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import ReportsTable from '../ReportsTable.vue';

const vuetify = createVuetify({
  components,
  directives,
});

const pinia = createTestingPinia();
const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: mockRouterPush
    })
}))

global.ResizeObserver = require('resize-observer-polyfill');

const wrappedRender = async () => {
  return render(ReportsTable, {
    global: {
      plugins: [pinia, vuetify]
    },
  });
};

const mockGetReports = vi.fn();
const mockGetReport = vi.fn();
vi.mock('../../../common/apiService', () => ({
  default: {
    getReports: async () => {
      return mockGetReports();
    },
    getReport: (...args) => mockGetReport(...args),
  },
}));

describe('ReportsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should display correct records', async () => {
    mockGetReports.mockReturnValue([
      {
        report_id: 'id1',
        report_start_date: '2023-01-01',
        report_end_date: '2023-02-01',
        reporting_year: 2023,
        create_date: new Date().toISOString(),
      },
    ]);
    const { getByTestId, debug } = await wrappedRender();
    debug();
    await waitFor(() => {
      expect(mockGetReports).toHaveBeenCalled();
    });

    expect(getByTestId('reporting_year-id1')).toHaveTextContent('2023');
    expect(getByTestId('report_published_date-id1')).toHaveTextContent(
      LocalDate.now().format(
        DateTimeFormatter.ofPattern('MMMM d, YYYY').withLocale(Locale.ENGLISH),
      ),
    );
  });
  it('should open report details', async () => {
    mockGetReports.mockReturnValue([
      {
        report_id: 'id1',
        report_start_date: '2023-01-01',
        report_end_date: '2023-02-01',
        create_date: new Date().toISOString(),
      },
    ]);
    const { getByTestId } = await wrappedRender();
    await waitFor(() => {
      expect(mockGetReports).toHaveBeenCalled();
    });

    const viewReportButton = getByTestId('view-report-id1');
    await fireEvent.click(viewReportButton);
  });
  it('should open report in edit mode', async () => {
    mockGetReports.mockReturnValue([
      {
        report_id: 'id1',
        report_start_date: '2023-01-01',
        report_end_date: '2023-02-01',
        create_date: new Date().toISOString(),
        is_unlocked: true,
      },
    ]);
    const { getByTestId } = await wrappedRender();
    await waitFor(() => {
      expect(mockGetReports).toHaveBeenCalled();
    });

    const editReportButton = getByTestId('edit-report-id1');
    await waitFor(() => {
      expect(editReportButton).toBeInTheDocument();
    });
    await fireEvent.click(editReportButton);
    expect(mockRouterPush).toHaveBeenCalledWith({
      path: 'generate-report-form',
    });
  });
});
