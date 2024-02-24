import { Browser } from 'puppeteer';
import {
  REPORT_FORMAT,
  ReportData,
  SubmittedReportData,
  docGenServicePrivate,
  generateReport,
} from './doc-gen-service';
import { getBrowser } from './puppeteer-service';

const TEST_TIMEOUT_MS = 10000;

const submittedReportData: SubmittedReportData = {
  companyName: 'Test company',
  companyAddress: 'Test',
  reportStartDate: 'January 1, 2023',
  reportEndDate: 'January 31, 2024',
  naicsCode: '11',
  naicsLabel: 'Agriculture, forestry, fishing and hunting',
  employeeCountRange: '50-299',
  comments: '',
  dataConstraints: '',
  referenceGenderCategory: 'Men',
  chartSuppressedError: '',
  tableData: {
    meanOvertimeHoursGap: [],
    medianOvertimeHoursGap: [],
  },
  chartData: {
    meanHourlyPayGap: [],
    medianHourlyPayGap: [],
    meanOvertimePayGap: [],
    medianOvertimePayGap: [],
    percentReceivingOvertimePay: [],
    meanBonusPayGap: [],
    medianBonusPayGap: [],
    percentReceivingBonusPay: [],
    hourlyPayQuartile1: [],
    hourlyPayQuartile2: [],
    hourlyPayQuartile3: [],
    hourlyPayQuartile4: [],
    hourlyPayQuartilesLegend: [],
  },
  chartSummaryText: {
    meanHourlyPayGap: '',
    medianHourlyPayGap: '',
    meanOvertimePayGap: '',
    medianOvertimePayGap: '',
    meanBonusPayGap: null,
    medianBonusPayGap: null,
    meanOvertimeHoursGap: '',
    medianOvertimeHoursGap: '',
    hourlyPayQuartiles: '',
  },
  explanatoryNotes: {
    meanHourlyPayDiff: { num: 1 },
    medianHourlyPayDiff: { num: 2 },
    meanOvertimePayDiff: { num: 3 },
    medianOvertimePayDiff: { num: 4 },
    meanOvertimeHoursDiff: { num: 5 },
    medianOvertimeHoursDiff: { num: 6 },
    meanBonusPayDiff: { num: 7 },
    medianBonusPayDiff: { num: 8 },
    payQuartiles: { num: 9 },
  },
  isAllCalculatedDataSuppressed: false,
  genderCodes: ['M', 'W', 'X', 'U'],
  isDraft: true,
};
const reportData =
  docGenServicePrivate.addSupplementaryReportData(submittedReportData);

beforeEach(() => {
  //extend from the default 5000 because many tests use puppeteer, which can
  //be slow if the host container isn't allocated sufficient resources
  jest.setTimeout(TEST_TIMEOUT_MS);

  jest.clearAllMocks();
});

describe('generateReport', () => {
  describe('when at least some calculated data are suppressed', () => {
    it(
      'should generate a report',
      async () => {
        const report = await generateReport(
          REPORT_FORMAT.HTML,
          submittedReportData as any,
        );
        expect(report).toBeDefined();
      },
      TEST_TIMEOUT_MS,
    );
  });
  describe('when all calculated data are suppressed', () => {
    it(
      'should generate a report',
      async () => {
        const mockSubmittedReportData = {
          ...submittedReportData,
          tableData: null,
          chartData: null,
          chartSummaryText: null,
          explanatoryNotes: null,
          isAllCalculatedDataSuppressed: true,
        };
        const report = await generateReport(
          REPORT_FORMAT.HTML,
          mockSubmittedReportData as any,
        );
        expect(report).toBeDefined();
      },
      TEST_TIMEOUT_MS,
    );
  });
});

describe('buildEjsTemplate', () => {
  describe('when the report data indicate that all calculations have been suppressed', () => {
    it('returns a template with a simplified report', async () => {
      const reportDataAllCalcsSuppressed = {
        ...reportData,
        isAllCalculatedDataSuppressed: true,
      };
      const template = await docGenServicePrivate.buildEjsTemplate(
        reportDataAllCalcsSuppressed,
      );
      expect(template).toContain('block-insufficient-data');
      expect(template).not.toContain('block-hourly-pay');
    });
  });
  describe("when the report data indicate that some calculations weren't suppressed", () => {
    it('returns a template that includes all the chart content blocks', async () => {
      const template = await docGenServicePrivate.buildEjsTemplate(reportData);
      expect(template).toContain('block-hourly-pay');
      expect(template).toContain('block-overtime');
      expect(template).toContain('block-bonus-pay');
      expect(template).toContain('block-hourly-pay-quartiles');
      expect(template).not.toContain('block-insufficient-data');
    });
  });
});

describe('addSupplementaryReportData', () => {
  it('returns a new object with props from the input object, plus some additional props', () => {
    const reportData: ReportData =
      docGenServicePrivate.addSupplementaryReportData(submittedReportData);

    //Properties copied from the input object
    expect(reportData.companyName).toBe(submittedReportData.companyName);

    //Newly added properties
    expect(reportData).toHaveProperty('footnoteSymbols');
    expect(reportData).toHaveProperty('isGeneralSuppressedDataFootnoteVisible');
  });
});

describe('isGeneralSuppressedDataFootnoteVisible', () => {
  describe('when there is only one visible chart and it has no suppressed gender categories', () => {
    it('returns false', () => {
      const data = {
        ...submittedReportData,
        chartData: {
          ...submittedReportData.chartData,
          meanHourlyPayGap: submittedReportData.genderCodes.map((c) => {}),
        },
      };
      const result: boolean =
        docGenServicePrivate.isGeneralSuppressedDataFootnoteVisible(data);
      expect(result).toBeFalsy();
    });
  });
  describe('when there is only one visible chart and it has no suppressed gender categories', () => {
    it('returns true', () => {
      const data = {
        ...submittedReportData,
        chartData: {
          ...submittedReportData.chartData,
          meanHourlyPayGap: [{}], //fewer elements here than genderCodes means suppression
        },
      };
      const result: boolean =
        docGenServicePrivate.isGeneralSuppressedDataFootnoteVisible(data);
      expect(result).toBeTruthy();
    });
  });
});

describe('moveElementInto', () => {
  describe("when 'elemToMove' is null", () => {
    it('throws an error', async () => {
      const elemToMove = null;
      await expect(
        docGenServicePrivate.moveElementInto({} as any, elemToMove, {} as any),
      ).rejects.toThrow();
    });
  });
  describe("when 'elemToBeParent' is null", () => {
    it('throws an error', async () => {
      const elemToBeParent = null;
      await expect(
        docGenServicePrivate.moveElementInto(
          {} as any,
          {} as any,
          elemToBeParent,
        ),
      ).rejects.toThrow();
    });
  });
  describe('when valid params are passed', () => {
    it('modifies the DOM', async () => {
      const id1 = 'one';
      const id2 = 'two';
      const id3 = 'three';
      const mockHtml = `
    <html><body>
      <div id='${id1}'>
        <div id='${id3}'></div>
      </div>
      <div id='${id2}'></div>
    </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();
      await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });

      // Move id3 from a child of id1 to be a child of id2
      const elemToMove = await puppeteerPage.$(`#${id3}`);
      const elemToBeParent = await puppeteerPage.$(`#${id2}`);

      await docGenServicePrivate.moveElementInto(
        puppeteerPage,
        elemToMove,
        elemToBeParent,
      );

      const childrenOf1: any[] = await puppeteerPage.$$(`#${id1} > *`);
      const childrenOf2: any[] = await puppeteerPage.$$(`#${id2} > *`);

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(childrenOf1.length).toBe(0);
      expect(childrenOf2.length).toBe(1);
    });
  });
});

describe('addReportPage', () => {
  describe('when the report is not a draft', () => {
    it(`injects a new DOM element representing a 'page' as a child of the given parent`, async () => {
      const isDraft = false;
      const parent = 'parent';
      const mockHtml = `
    <html><body>
      <div id='${parent}'></div>      
    </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();
      await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });
      const elemToBeParent = await puppeteerPage.$(`#${parent}`);

      await docGenServicePrivate.addReportPage(elemToBeParent, isDraft);

      const pageChild = await puppeteerPage.$(
        `#${parent} > .${docGenServicePrivate.STYLE_CLASSES.PAGE}`,
      );
      const watermark = await pageChild.$(
        `.${docGenServicePrivate.STYLE_CLASSES.WATERMARK}`,
      );

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(pageChild).not.toBeNull();
      expect(watermark).toBeNull();
    });
  });
  describe('when the report is a draft', () => {
    it(`injects a new DOM element representing a 'page' as a child of the given parent`, async () => {
      const isDraft = true;
      const parent = 'parent';
      const mockHtml = `
    <html><body>
      <div id='${parent}'></div>      
    </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();
      await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });
      const elemToBeParent = await puppeteerPage.$(`#${parent}`);

      await docGenServicePrivate.addReportPage(elemToBeParent, isDraft);

      const pageChild = await puppeteerPage.$(
        `#${parent} > .${docGenServicePrivate.STYLE_CLASSES.PAGE}`,
      );
      const watermark = await pageChild.$(
        `.${docGenServicePrivate.STYLE_CLASSES.WATERMARK}`,
      );

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(pageChild).not.toBeNull();
      expect(watermark).not.toBeNull();
    });
  });
});

describe('getContentHeight', () => {
  it(`gets the rendered height of the element in the dom`, async () => {
    const id1 = 'one';
    const mockHtml = `
    <html><body>
      <div id='${id1}' style='height: 100px'></div>      
    </body></html>`;
    const browser: Browser = await getBrowser();
    const puppeteerPage = await browser.newPage();
    await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });
    const elemToTest = await puppeteerPage.$(`#${id1}`);

    const heightPx = await docGenServicePrivate.getContentHeight(
      puppeteerPage,
      elemToTest,
    );

    if (puppeteerPage) {
      await puppeteerPage.close();
    }

    expect(heightPx).toBe(100);
  });
});

describe('clearEmptyNotes', () => {
  it(`removes empty 'explanatory notes' and 'footnotes' sections`, async () => {
    const id1 = 'one';
    const mockHtml = `
    <html><body>
      <div class='${docGenServicePrivate.STYLE_CLASSES.REPORT}'>
        <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT}'>
          <div class='${docGenServicePrivate.STYLE_CLASSES.EXPLANATORY_NOTES}'>
            Explanatory Notes
            <!-- this element will be deleted -->
          </div>
          <div class='${docGenServicePrivate.STYLE_CLASSES.EXPLANATORY_NOTES}'>
            Explanatory Notes
            <div class='${docGenServicePrivate.STYLE_CLASSES.BLOCK_EXPLANATORY_NOTES}'></div>
            <!-- this element will be kept -->
          </div>
          <div class='${docGenServicePrivate.STYLE_CLASSES.FOOTNOTES}'>
            <!-- this element will be deleted -->
          </div>
          <div class='${docGenServicePrivate.STYLE_CLASSES.FOOTNOTES}'>
            <div class='${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}'></div>
            <!-- this element will be kept -->
          </div>
        </div>     
      </div> 
    </body></html>`;
    const browser: Browser = await getBrowser();
    const puppeteerPage = await browser.newPage();
    await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });
    const payTransparencyReport = await puppeteerPage.$(
      `.${docGenServicePrivate.STYLE_CLASSES.REPORT}`,
    );

    await docGenServicePrivate.clearEmptyNotes(
      puppeteerPage,
      payTransparencyReport,
    );

    const explanatoryNotes = await payTransparencyReport.$$(
      `.${docGenServicePrivate.STYLE_CLASSES.EXPLANATORY_NOTES}`,
    );

    const footnotes = await payTransparencyReport.$$(
      `.${docGenServicePrivate.STYLE_CLASSES.FOOTNOTES}`,
    );

    if (puppeteerPage) {
      await puppeteerPage.close();
    }

    expect(explanatoryNotes?.length).toBe(1);
    expect(footnotes?.length).toBe(1);
  });
});

describe('attemptToPlaceElementOnPage', () => {
  describe("when 'elementToPlace' is null", () => {
    it('throws an error', async () => {
      const elementToPlace = null;
      await expect(
        docGenServicePrivate.attemptToPlaceElementOnPage(
          {} as any,
          elementToPlace,
          {} as any,
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow();
    });
  });
  describe("when 'reportPage' is null", () => {
    it('throws an error', async () => {
      const reportPage = null;
      await expect(
        docGenServicePrivate.attemptToPlaceElementOnPage(
          {} as any,
          {} as any,
          {} as any,
          reportPage,
          {} as any,
        ),
      ).rejects.toThrow();
    });
  });
  describe('when the page has room for the element', () => {
    it(`the element is added to the DOM as a child of the page`, async () => {
      const reportPageOptions = {
        margin: {
          top: 0,
          bottom: 0,
        },
        height: 100,
      };
      const mockHtml = `
      <html><body>
        <div class="${docGenServicePrivate.STYLE_CLASSES.BLOCK}" style='height: ${reportPageOptions.height / 10}px'></div>    
        <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE}'>
          <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT}'>
            <div class='${docGenServicePrivate.STYLE_CLASSES.BLOCK_GROUP}'></div>
          </div> 
        </div>      
      </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();

      await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });

      const blockOutsidePage = await puppeteerPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.BLOCK}`,
      );

      const reportPage = await puppeteerPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.PAGE}`,
      );

      const wasSuccessful =
        await docGenServicePrivate.attemptToPlaceElementOnPage(
          puppeteerPage,
          blockOutsidePage,
          `.${docGenServicePrivate.STYLE_CLASSES.BLOCK_GROUP}`,
          reportPage,
          reportPageOptions,
        );

      const blockOnPage = await reportPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT} > .${docGenServicePrivate.STYLE_CLASSES.BLOCK_GROUP} > .${docGenServicePrivate.STYLE_CLASSES.BLOCK}`,
      );

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(wasSuccessful).toBeTruthy();
      expect(blockOnPage).not.toBeNull();
    });
  });
  describe("when the page doesn't have room for the element", () => {
    it(`the element is not added to the page`, async () => {
      const reportPageOptions = {
        margin: {
          top: 0,
          bottom: 0,
        },
        height: 100,
      };
      const mockHtml = `
        <html><body>
          <div class="${docGenServicePrivate.STYLE_CLASSES.BLOCK}" style='height: ${reportPageOptions.height + 1}px'></div>    
          <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE}'>
            <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT}'>
              <div class='${docGenServicePrivate.STYLE_CLASSES.BLOCK_GROUP}'></div>
            </div> 
          </div>      
        </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();

      await puppeteerPage.setContent(mockHtml, { waitUntil: 'networkidle0' });

      const blockOutsidePage = await puppeteerPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.BLOCK}`,
      );

      const reportPage = await puppeteerPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.PAGE}`,
      );

      const wasSuccessful =
        await docGenServicePrivate.attemptToPlaceElementOnPage(
          puppeteerPage,
          blockOutsidePage,
          `.${docGenServicePrivate.STYLE_CLASSES.BLOCK_GROUP}`,
          reportPage,
          reportPageOptions,
        );

      const blockOnPage = await reportPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT} > .${docGenServicePrivate.STYLE_CLASSES.BLOCK_GROUP} > .${docGenServicePrivate.STYLE_CLASSES.BLOCK}`,
      );

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(wasSuccessful).not.toBeTruthy();
      expect(blockOnPage).toBeNull();
    });
  });
});

describe('placeFootnotes', () => {
  describe('when the footnoteGroup is null', () => {
    it('return false', async () => {
      const footnoteGroup = null;
      const success = await docGenServicePrivate.placeFootnotes(
        {} as any,
        footnoteGroup,
        {} as any,
        {} as any,
      );
      expect(success).toBeFalsy();
    });
  });

  describe('when the current page has room for the footnotes', () => {
    it(`the footnotes are added to the current page`, async () => {
      const mockReportData = {
        ...reportData,
        pageSize: {
          margin: {
            top: 0,
            bottom: 0,
          },
          height: 100,
        },
      };

      const mockHtml = `
        <html><body>
          <div class="${docGenServicePrivate.STYLE_CLASSES.REPORT}">
            <div class="${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}" style='height: ${mockReportData.pageSize.height / 10}px'></div>    
            <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE}'>
              <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT}'>
                <div class='${docGenServicePrivate.STYLE_CLASSES.FOOTNOTES}'></div>
              </div> 
            </div>
          </div>     
        </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();

      await puppeteerPage.setContent(mockHtml, {
        waitUntil: 'networkidle0',
      });

      const payTransparencyReport = await puppeteerPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.REPORT}`,
      );
      const footnoteGroupOutsidePage = await payTransparencyReport.$(
        `.${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}`,
      );

      const wasSuccessfullyAdded = await docGenServicePrivate.placeFootnotes(
        puppeteerPage,
        footnoteGroupOutsidePage,
        payTransparencyReport,
        mockReportData,
      );

      const footnoteGroupOnPage = await payTransparencyReport.$(
        `.${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT} .${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}`,
      );

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(wasSuccessfullyAdded).toBeTruthy();
      expect(footnoteGroupOnPage).not.toBeNull();
    });
  });
  describe("when the current page doesn't have room for the footnotes", () => {
    it(`the footnotes are not added`, async () => {
      const mockReportData = {
        ...reportData,
        pageSize: {
          margin: {
            top: 0,
            bottom: 0,
          },
          height: 100,
        },
      };

      const mockHtml = `
        <html><body>
          <div class="${docGenServicePrivate.STYLE_CLASSES.REPORT}">
            <div class="${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}" style='height: ${mockReportData.pageSize.height + 1}px'></div>    
            <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE}'>
              <div class='${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT}'>
                <div class='${docGenServicePrivate.STYLE_CLASSES.FOOTNOTES}'></div>
              </div> 
            </div>
          </div>     
        </body></html>`;
      const browser: Browser = await getBrowser();
      const puppeteerPage = await browser.newPage();

      await puppeteerPage.setContent(mockHtml, {
        waitUntil: 'networkidle0',
      });

      const payTransparencyReport = await puppeteerPage.$(
        `.${docGenServicePrivate.STYLE_CLASSES.REPORT}`,
      );
      const footnoteGroupOutsidePage = await payTransparencyReport.$(
        `.${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}`,
      );

      const wasSuccessfullyAdded = await docGenServicePrivate.placeFootnotes(
        puppeteerPage,
        footnoteGroupOutsidePage,
        payTransparencyReport,
        mockReportData,
      );

      const footnoteGroupOnPage = await payTransparencyReport.$(
        `.${docGenServicePrivate.STYLE_CLASSES.PAGE_CONTENT} .${docGenServicePrivate.STYLE_CLASSES.FOOTNOTE_GROUP}`,
      );

      if (puppeteerPage) {
        await puppeteerPage.close();
      }

      expect(wasSuccessfullyAdded).toBeFalsy();
      expect(footnoteGroupOnPage).toBeNull();
    });
  });
});
