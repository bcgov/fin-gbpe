import puppeteer from 'puppeteer';
import { docGenServicePrivate } from '../v1/services/doc-gen-service';

let browser = null;
beforeAll(async () => {
  browser = await puppeteer.launch({
    args: [
      '--enable-logging',
      '--v=1',
      '--allow-file-access-from-files',
      '--no-sandbox', // --no-sandbox should only be used if there are absolutely no remote
      // connections made and the source is fully trusted. In this case, the 'user data'
      // is created by our test cases which will be safe, and this application doesn't make
      // any remote connections to any other web service.
    ],
    headless: 'new',
    dumpio: true,
  });
});

afterAll(async () => {
  if (browser) {
    await browser.close();
  }
});

const setupPage = async () => {
  const page = await browser.newPage();

  // Inject into the page the script that contains the horizontalBarChart
  // function, and also inject the d3.js library (which horitontalBarChart
  // depends on)
  await page.addScriptTag({ path: './node_modules/d3/dist/d3.min.js' });
  await page.addScriptTag({
    path: docGenServicePrivate.REPORT_TEMPLATE_SCRIPT,
  });
  return page;
};

describe('percentFilledHorizBarChart', () => {
  it('generates a horizontal bar chart with the expected visual elements.', async () => {
    const page = await setupPage();
    // Set the page content to be a very simple HTML document with one
    // <div></div> tag.  (In one of the steps below we inject a chart into
    // this tag.)
    await page.setContent(
      `<!doctype html>
      <html>    
      <body><div id="chart"></div></body >
      </html>`,
      { waitUntil: 'networkidle0' },
    );

    //Define the data and colors that we'll show in the bar chart
    const params = {
      chartData: [
        { value: 50, genderChartInfo: { label: 'Male', color: '#1c3664' } },
        { value: 40, genderChartInfo: { label: 'Female', color: '#1b75bb' } },
        {
          value: 5,
          genderChartInfo: { label: 'Non-binary', color: '#00a54f' },
        },
        {
          value: 20,
          genderChartInfo: { label: 'Unknown', color: '#444444' },
        },
      ],
    };

    // Draw a bar chart in the page.
    await page.evaluate((params) => {
      document.getElementById('chart').appendChild(
        // @ts-ignore
        percentFilledHorizBarChart(params.chartData),
      );
    }, params);

    // Inspect the DOM of the page, and fetch some elements
    // of the SVG chart so we can verify they are as expected.

    // Fetch the color of each 'rect' element (the rect elements
    // represent the horizontal bars in the bar chart)
    const barColors = await page.$$eval(
      '#chart svg > g > g > rect:first-child',
      (el) => el.map((x) => x.getAttribute('fill')),
    );
    // Fetch the text labels for the gender categetories
    const genderCategoryLabels = await page.$$eval(
      '#chart svg > g > g text',
      (el) => el.map((x) => x.textContent),
    );
    // Fetch the text labels showing the percentages
    const percentLabels = await page.$$eval('#chart svg > g > text', (el) =>
      el.map((x) => x.textContent),
    );

    expect(barColors).toEqual(
      params.chartData.map((d) => d.genderChartInfo.color),
    );
    expect(genderCategoryLabels).toEqual(
      params.chartData.map((d) => d.genderChartInfo.label),
    );
    expect(percentLabels).toEqual(
      params.chartData.map((d) => `${Math.round(d.value)}%`),
    );
  });
});

describe('horizontalBarChart', () => {
  it('generates a horizontal bar chart with the expected visual elements.', async () => {
    const page = await setupPage();
    // Set the page content to be a very simple HTML document with one
    // <div></div> tag.  (In one of the steps below we inject a chart into
    // this tag.)
    await page.setContent(
      `<!doctype html>
      <html>    
      <body><div id="chart"></div></body >
      </html>`,
      { waitUntil: 'networkidle0' },
    );

    //Define the data and colors that we'll show in the bar chart
    const params = {
      chartData: [
        { value: 1.0, genderChartInfo: { label: 'Male', color: '#1c3664' } },
        { value: 0.92, genderChartInfo: { label: 'Female', color: '#1b75bb' } },
        {
          value: 0.97,
          genderChartInfo: { label: 'Non-binary', color: '#00a54f' },
        },
        {
          value: 1.01,
          genderChartInfo: { label: 'Unknown', color: '#444444' },
        },
      ],
    };

    // Draw a bar chart in the page.
    await page.evaluate((params) => {
      const numberFormat = '0.2f'; //don't apply formatting to numbers
      document.getElementById('chart').appendChild(
        // @ts-ignore
        horizontalBarChart(params.chartData, numberFormat),
      );
    }, params);

    // Inspect the DOM of the page, and fetch some elements
    // of the SVG chart so we can verify they are as expected.

    // Fetch the color of each 'rect' element (the rect elements
    // represent the horizontal bars in the bar chart)
    const barColors = await page.$$eval('#chart svg g rect', (el) =>
      el.map((x) => x.getAttribute('fill')),
    );
    // Fetch the text labels for the gender categetories
    const genderCategoryLabels = await page.$$eval(
      '#chart svg g g text tspan',
      (el) => el.map((x) => x.textContent),
    );
    // Fetch the text labels showing gender pay gap values
    const payGapLabels = await page.$$eval('#chart svg > g > text', (el) =>
      el.map((x) => x.textContent),
    );

    expect(barColors).toEqual(
      params.chartData.map((d) => d.genderChartInfo.color),
    );
    expect(genderCategoryLabels).toEqual(
      params.chartData.map((d) => d.genderChartInfo.label),
    );
    expect(payGapLabels.map((d) => parseFloat(d))).toEqual(
      params.chartData.map((d) => d.value),
    );
  });
});

describe('horizontalStackedBarChart', () => {
  it('generates a horizontal stacked bar chart with the expected visual elements.', async () => {
    const page = await setupPage();
    // Set the page content to be a very simple HTML document with one
    // <div></div> tag.  (In one of the steps below we inject a chart into
    // this tag.)
    await page.setContent(
      `<!doctype html>
      <html>    
      <body><div id="chart"></div></body >
      </html>`,
      { waitUntil: 'networkidle0' },
    );

    //Define the data and colors that we'll show in the bar chart
    const mockChartData = [
      {
        genderChartInfo: {
          code: 'A',
          label: 'AAAA',
          extendedLabel: 'AAAA AAAA',
          color: '#1c3664',
        },
        value: 60,
      },
      {
        genderChartInfo: {
          code: 'B',
          label: 'BBBB',
          extendedLabel: 'BBBB BBBB',
          color: '#1b75bb',
        },
        value: 39.9,
      },
      {
        genderChartInfo: {
          code: 'C',
          label: 'CCCC',
          extendedLabel: 'CCCC CCCC',
          color: '#444444',
        },
        value: 0.1,
      },
    ];

    // Draw a bar chart in the page.
    await page.evaluate((mockChartData) => {
      const numberFormat = '1.0f';
      document.getElementById('chart').appendChild(
        // @ts-ignore
        horizontalStackedBarChart(mockChartData, numberFormat),
      );
    }, mockChartData);

    // Inspect the DOM of the page, and fetch some elements
    // of the SVG chart so we can verify they are as expected.

    // Fetch the color of each 'rect' element (the rect elements
    // represent the horizontal bars in the bar chart)
    const barColors = await page.$$eval('#chart > svg > g > g > g', (el) =>
      el.map((x) => x.getAttribute('fill')),
    );
    // Fetch the text labels shown on the stacked bar
    const primaryLabels = await page.$$eval(
      '#chart > svg > g > g > g > g > text',
      (el) => el.map((x) => x.textContent),
    );
    // Fetch the text labels shown below the stacked bar
    const secondaryLabels = await page.$$eval(
      '#chart > svg > g > g > text',
      (el) => el.map((x) => x.textContent),
    );

    const barLabel = (d) =>
      `${d.genderChartInfo.label} (${Math.round(d.value)}%)`;

    expect(barColors).toEqual(
      mockChartData.map((d) => d.genderChartInfo.color),
    );
    expect(primaryLabels).toEqual(
      mockChartData.map((d) => (d.value >= 1 ? barLabel(d) : '')),
    );
    expect(secondaryLabels).toEqual(
      mockChartData.filter((d) => d.value < 1).map((d) => barLabel(d)),
    );
  });
});

describe('createLegend', () => {
  it('generates a legend.', async () => {
    const page = await setupPage();
    // Set the page content to be a very simple HTML document with one
    // <div></div> tag.  (In one of the steps below we inject a chart into
    // this tag.)
    await page.setContent(
      `<!doctype html>
      <html>    
      <body><div id="legend"></div></body >
      </html>`,
      { waitUntil: 'networkidle0' },
    );

    //Define the data and colors that we'll show in the bar chart
    const mockLegendData = [
      { label: 'A', color: '#ff0000' },
      { label: 'B', color: '#ffff00' },
      { label: 'C', color: '#ff00ff' },
      { label: 'D', color: '#00ff00' },
    ];

    // Draw a bar chart in the page.
    await page.evaluate((mockLegendData) => {
      document.getElementById('legend').appendChild(
        // @ts-ignore
        createLegend(mockLegendData),
      );
    }, mockLegendData);

    // Inspect the DOM of the page, and fetch some elements
    // of the SVG chart so we can verify they are as expected.

    // Fetch the color of each 'rect' element (the rect elements
    // represent the color swatches in the legend)
    const swatchColors = await page.$$eval('#legend > svg > g > rect', (el) =>
      el.map((x) => x.getAttribute('fill')),
    );
    // Fetch the text labels shown beside each swatch
    const labels = await page.$$eval('#legend > svg > g > text', (el) =>
      el.map((x) => x.textContent),
    );

    expect(swatchColors).toEqual(mockLegendData.map((d) => d.color));
    expect(labels).toEqual(mockLegendData.map((d) => d.label));
  });
});

describe('getTextSize', () => {
  it('returns the predicted width and height of the text (if it was to be rendered)', async () => {
    const page = await setupPage();

    await page.setContent(
      `<!doctype html>
      <html>    
      <body>
      <div id="text-width"></div>
      <div id="text-height"></div>
      </body >
      </html>`,
      { waitUntil: 'networkidle0' },
    );

    // Predict the text size with a given font, and inject the predicted width
    // and height into text nodes of the HTML page
    await page.evaluate(() => {
      const textSize = getTextSize('sample text', '12px sans-serif');
      document.getElementById('text-width').innerHTML = textSize.width;
      document.getElementById('text-height').innerHTML = textSize.height;
    });

    // Extract the predicted width and height from the DOM.
    const width = parseFloat(
      await page.$eval('#text-width', (el) => el.innerText),
    );
    const height = parseFloat(
      await page.$eval('#text-height', (el) => el.innerText),
    );

    // Check that the predicted width and height are reasonable
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(height);
  });
});
