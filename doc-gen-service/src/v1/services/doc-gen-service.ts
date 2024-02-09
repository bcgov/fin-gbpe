import ejs from 'ejs';
import fs from 'node:fs/promises';
import { resolve } from 'path';
import { Browser, Page } from 'puppeteer';
import { config } from '../../config';
import { logger } from '../../logger';
import { getBrowser } from './puppeteer-service';

const DEFAULT_FOOTNOTE_SYMBOLS = {
  genderCategorySuppressed: '*',
  quartileGenderCategorySuppressed: '†',
};

/*
Defines properties that must be submitted with any 
request to generate a report.
*/
export type SubmittedReportData = {
  companyName: string;
  companyAddress: string;
  reportStartDate: string;
  reportEndDate: string;
  naicsCode: string;
  naicsLabel: string;
  employeeCountRange: string;
  comments: string;
  referenceGenderCategory: string;
  explanatoryNotes: unknown;
  chartData: {
    meanHourlyPayGap: unknown[];
    medianHourlyPayGap: unknown[];
    meanOvertimePayGap: unknown[];
    medianOvertimePayGap: unknown[];
    meanBonusPayGap: unknown[];
    medianBonusPayGap: unknown[];
    hourlyPayQuartile1: unknown[];
    hourlyPayQuartile2: unknown[];
    hourlyPayQuartile3: unknown[];
    hourlyPayQuartile4: unknown[];
    percentReceivingOvertimePay: unknown[];
    percentReceivingBonusPay: unknown[];
    hourlyPayQuartilesLegend: unknown[];
  };
  tableData: {
    meanOvertimeHoursGap: unknown;
    medianOvertimeHoursGap: unknown;
  };
  chartSummaryText: unknown;
  chartSuppressedError: string;
  isAllCalculatedDataSuppressed: boolean;
  genderCodes: string[];
};

/*
Defines properties that are not explicitly
inlcuded in SubmittedReportData, but which are also needed
to generate a report.  For example: properties
derived from those in SubmittedReportData.
*/
type SupplementaryReportData = {
  footnoteSymbols: {
    genderCategorySuppressed: string;
    quartileGenderCategorySuppressed: string;
  };
  isGeneralSuppressedDataFootnoteVisible: boolean;
};

/* Includes everything from SubmittedReportData and SupplementaryReportData */
export type ReportData = SubmittedReportData & SupplementaryReportData;

const docGenServicePrivate = {
  REPORT_TEMPLATE_HEADER: resolve(
    /* istanbul ignore next */
    config.get('server:templatePath') || '',
    'report-template-header.html',
  ),
  REPORT_TEMPLATE_EMPLOYEE_DATA_SUMMARY: resolve(
    /* istanbul ignore next */
    config.get('server:templatePath') || '',
    'report-template-emp-data-summary.html',
  ),
  REPORT_TEMPLATE_INSUFFICIENT_DATA: resolve(
    /* istanbul ignore next */
    config.get('server:templatePath') || '',
    'report-template-insufficient-data.html',
  ),
  REPORT_TEMPLATE_FOOTER: resolve(
    /* istanbul ignore next */
    config.get('server:templatePath') || '',
    'report-template-footer.html',
  ),
  REPORT_TEMPLATE_SCRIPT: resolve(
    /* istanbul ignore next */
    config.get('server:templatePath') || '',
    'report.script.js',
  ),

  /**
   * Builds an ejs template suitable for creating a report from
   * the given report data.
   * Not all reports will use the same template.  For example, a report
   * in which all calculations are suppressed will use a template
   * that excludes the charts.
   */
  async buildEjsTemplate(reportData: ReportData): Promise<string> {
    // Build a template by combining multiple ejs template fragments
    // (each defined in a separate file).

    const header = await fs.readFile(
      docGenServicePrivate.REPORT_TEMPLATE_HEADER,
      { encoding: 'utf8' },
    );
    const fragments = [header];

    // The template should include an area for the main body of the content.
    // This section will look different depending on whether
    // *all* calculations have been suppressed or whether at least
    // some calculations weren't suppressed.
    if (reportData.isAllCalculatedDataSuppressed) {
      const insufficientData = await fs.readFile(
        docGenServicePrivate.REPORT_TEMPLATE_INSUFFICIENT_DATA,
        { encoding: 'utf8' },
      );
      fragments.push(insufficientData);
    } else {
      const employeeDataSummary = await fs.readFile(
        docGenServicePrivate.REPORT_TEMPLATE_EMPLOYEE_DATA_SUMMARY,
        { encoding: 'utf8' },
      );
      fragments.push(employeeDataSummary);
    }

    const footer = await fs.readFile(
      docGenServicePrivate.REPORT_TEMPLATE_FOOTER,
      { encoding: 'utf8' },
    );
    fragments.push(footer);

    return fragments.join('\n');
  },

  /**
   * Determines whether any of the included charts or tables in the given
   * SubmittedReportData had one or more gender categories suppressed.
   */
  isGeneralSuppressedDataFootnoteVisible(
    submittedReportData: SubmittedReportData,
  ) {
    const chartsToConsider = [
      'meanHourlyPayGap',
      'medianHourlyPayGap',
      'meanOvertimePayGap',
      'medianOvertimePayGap',
      'meanBonusPayGap',
      'medianBonusPayGap',
    ];
    const tablesToConsider = ['meanOvertimeHoursGap', 'medianOvertimeHoursGap'];
    const numGenderCategories = submittedReportData.genderCodes.length;
    const hasAtLeastOneIncludedChartWithSuppression =
      chartsToConsider
        .map((chartName) => submittedReportData.chartData[chartName])
        .filter((c) => c.length && c.length < numGenderCategories).length > 0;

    // Note: (numGenderCategories - 1) because because the reference gender
    // category isn't displayed in the tables
    const hasAtLeastOneIncludedTableWithSuppression =
      tablesToConsider
        .map((tableName) => submittedReportData.tableData[tableName])
        .filter((c) => c.length && c.length < numGenderCategories - 1).length >
      0;
    return (
      hasAtLeastOneIncludedChartWithSuppression ||
      hasAtLeastOneIncludedTableWithSuppression
    );
  },

  /**
   * Creates a new ReportData object which includes
   * everything from the given SubmittedReportData, plus
   * some additional derived or default properties needed
   * to generate the report.
   */
  addSupplementaryReportData(
    submittedReportData: SubmittedReportData,
  ): ReportData {
    const numGenders = submittedReportData.genderCodes.length;
    const chartData = submittedReportData.chartData;

    const supplementaryReportData: SupplementaryReportData = {
      footnoteSymbols: DEFAULT_FOOTNOTE_SYMBOLS,
      isGeneralSuppressedDataFootnoteVisible:
        docGenServicePrivate.isGeneralSuppressedDataFootnoteVisible(
          submittedReportData,
        ),
    };
    const reportData: ReportData = {
      ...submittedReportData,
      ...supplementaryReportData,
    };
    return reportData;
  },
};

/**
 * Generates a report of the specified type, using the specified data
 * @param reportType The type of report to generate (e.g. 'pdf', 'html')
 * @param reportData The data to use when generating the report
 */
async function generateReport(
  reportType: string,
  submittedReportData: SubmittedReportData,
) {
  const reportData =
    docGenServicePrivate.addSupplementaryReportData(submittedReportData);

  try {
    const ejsTemplate = await docGenServicePrivate.buildEjsTemplate(reportData);
    const workingHtml: string = ejs.render(ejsTemplate, reportData);
    const browser: Browser = await getBrowser();
    const page: Page = await browser.newPage();
    await page.addScriptTag({ path: './node_modules/d3/dist/d3.min.js' });
    await page.addScriptTag({
      path: docGenServicePrivate.REPORT_TEMPLATE_SCRIPT,
    });

    await page.setContent(workingHtml, { waitUntil: 'networkidle0' });

    // Generate charts as SVG, and inject the charts into the DOM of the
    // current page
    await page.evaluate(
      /* istanbul ignore next */
      (reportData) => {
        const chartData = reportData.chartData;
        document.getElementById('mean-hourly-pay-gap-chart')?.appendChild(
          // @ts-ignore
          horizontalBarChart(chartData.meanHourlyPayGap),
        );
        document.getElementById('median-hourly-pay-gap-chart')?.appendChild(
          // @ts-ignore
          horizontalBarChart(chartData.medianHourlyPayGap),
        );
        document.getElementById('mean-overtime-pay-gap-chart')?.appendChild(
          // @ts-ignore
          horizontalBarChart(chartData.meanOvertimePayGap),
        );
        document.getElementById('median-overtime-pay-gap-chart')?.appendChild(
          // @ts-ignore
          horizontalBarChart(chartData.medianOvertimePayGap),
        );
        document
          .getElementById('percent-receiving-overtime-pay-chart')
          ?.appendChild(
            // @ts-ignore
            percentFilledHorizBarChart(chartData.percentReceivingOvertimePay),
          );
        document.getElementById('mean-bonus-pay-gap-chart')?.appendChild(
          // @ts-ignore
          horizontalBarChart(chartData.meanBonusPayGap),
        );
        document.getElementById('median-bonus-pay-gap-chart')?.appendChild(
          // @ts-ignore
          horizontalBarChart(chartData.medianBonusPayGap),
        );
        document
          .getElementById('percent-receiving-bonus-pay-chart')
          ?.appendChild(
            // @ts-ignore
            percentFilledHorizBarChart(chartData.percentReceivingBonusPay),
          );
        document.getElementById('hourly-pay-quartile-4-chart')?.appendChild(
          // @ts-ignore
          horizontalStackedBarChart(chartData.hourlyPayQuartile4),
        );
        document.getElementById('hourly-pay-quartile-3-chart')?.appendChild(
          // @ts-ignore
          horizontalStackedBarChart(chartData.hourlyPayQuartile3),
        );
        document.getElementById('hourly-pay-quartile-2-chart')?.appendChild(
          // @ts-ignore
          horizontalStackedBarChart(chartData.hourlyPayQuartile2),
        );
        document.getElementById('hourly-pay-quartile-1-chart')?.appendChild(
          // @ts-ignore
          horizontalStackedBarChart(chartData.hourlyPayQuartile1),
        );
        document.getElementById('hourly-pay-quartiles-legend')?.appendChild(
          // @ts-ignore
          createLegend(chartData.hourlyPayQuartilesLegend),
        );
      },
      reportData,
    );

    // Extract the HTML of the active DOM, which includes the injected charts
    const renderedHtml = await page.content();
    await page.close();
    return renderedHtml;
  } catch (e) {
    /* istanbul ignore next */
    logger.error(e);
  }
}

export { docGenServicePrivate, generateReport };
