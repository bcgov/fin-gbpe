import { expect, Locator, Page } from 'playwright/test';
import { PagePaths } from '../../utils';
import { AdminPortalPage } from '../admin-portal-page';

export class AnnouncementsPage extends AdminPortalPage {
  static path = PagePaths.ANNOUNCEMENTS;
  addAnnouncementButton: Locator;
  searchInput: Locator;
  searchButton: Locator;

  static async visit(page: Page) {
    await page.goto(PagePaths.ANNOUNCEMENTS);
    const announcementsPage = new AnnouncementsPage(page);
    await announcementsPage.setup();
    return announcementsPage;
  }

  async setup() {
    await super.setup();
    this.addAnnouncementButton = await this.page.getByRole('link', {
      name: 'Add Announcement',
    });
    this.searchInput = await this.page.getByLabel('Search by title');
    this.searchButton = await this.page.getByRole('button', { name: 'Search' });
    await expect(this.searchInput).toBeVisible();
    await expect(this.searchButton).toBeVisible();
    await expect(this.addAnnouncementButton).toBeVisible();
  }

  async clickAddAnnouncementButton() {
    await this.addAnnouncementButton.click();
    await this.page.waitForURL(PagePaths.ADD_ANNOUNCEMENTS);
  }

  async expectTitleVisible(title: string) {
    const titleElement = await this.page.getByText(title);
    await expect(titleElement).toBeVisible();
  }

  async search(title: string) {
    await this.searchInput.fill(title);
    const searchResponse = this.waitForSearch();
    await this.searchButton.click();
    const response = await searchResponse;
    return response.json();
  }

  private async waitForSearch() {
    const searchResponse = this.page.waitForResponse((res) => {
      return (
        res.status() === 200 &&
        res.url().includes('/admin-api/v1/announcements') &&
        res.request().method() === 'GET'
      );
    });

    return searchResponse;
  }
}
