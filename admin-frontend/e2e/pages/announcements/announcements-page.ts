import { expect, Locator, Page } from 'playwright/test';
import { PagePaths } from '../../utils';
import { AdminPortalPage } from '../admin-portal-page';
import { DateTimeFormatter, ZonedDateTime, ZoneId } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';
import { AnnouncementStatus } from '../../types';

export class AnnouncementsPage extends AdminPortalPage {
  static path = PagePaths.ANNOUNCEMENTS;
  addAnnouncementButton: Locator;
  searchInput: Locator;
  searchButton: Locator;
  resetButton: Locator;

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
    this.resetButton = await this.page.getByRole('button', { name: 'Reset' });
    await expect(this.searchInput).toBeVisible();
    await expect(this.searchButton).toBeVisible();
    await expect(this.addAnnouncementButton).toBeVisible();
    await expect(this.resetButton).toBeVisible();
  }

  async clickAddAnnouncementButton() {
    await this.addAnnouncementButton.click();
    await this.page.waitForURL(PagePaths.ADD_ANNOUNCEMENTS);
  }

  async expectTitleVisible(title: string) {
    const titleElement = await this.page.getByText(title);
    await expect(titleElement).toBeVisible();
  }

  async expectStatusVisible(status: string) {
    const statusElement = await this.page.getByText(status);
    await expect(statusElement).toBeVisible();
  }

  async expectDatesVisible(activeOn: string, expiresOn: string) {
    if (activeOn) {
      const activeOnElement = await this.page.getByText(
        this.formatDate(activeOn),
      );
      await expect(activeOnElement).toBeVisible();
    }

    if (expiresOn) {
      const expiresOnElement = await this.page.getByText(
        this.formatDate(expiresOn),
      );
      await expect(expiresOnElement).toBeVisible();
    }
  }

  async search(title: string) {
    await this.searchInput.fill(title);
    const searchResponse = this.waitForSearch();
    await this.searchButton.click();
    const response = await searchResponse;
    return response.json();
  }

  async searchAndEdit(title: string) {
    const { items } = await this.search(title);
    expect(items).toHaveLength(1);
    await this.expectTitleVisible(title);
    const actions = await this.page.getByRole('button', { name: 'Actions' });
    const actionsButton = await actions.first();
    
    await actionsButton.click();
    const getAnnouncementResponse = this.waitForGetAnnouncement(
      items[0].announcement_id,
    );
    const editButton = await this.page.getByRole('button', { name: 'Edit' });
    await editButton.click();
    const response = await getAnnouncementResponse;
    await response.json();
    await this.page.waitForURL(PagePaths.EDIT_ANNOUNCEMENTS);
    return items[0];
  }

  async archiveAnnouncement(title: string) {
    await this.search(title);
    await this.expectTitleVisible(title);
    const actions = await (
      await this.page.getByRole('button', { name: 'Actions' })
    ).first();
    await actions.click();
    const archiveButton = await this.page.getByRole('button', {
      name: 'Archive',
      disabled: false,
    });
    await expect(archiveButton).toBeVisible();
    await archiveButton.click();
    const confirmButton = await this.page.getByRole('button', {
      name: 'Confirm',
    });
    const archiveAnnouncementResponse = this.waitForPatchReponse();
    const searchResponse = this.waitForSearch();
    await confirmButton.click();
    const response = await archiveAnnouncementResponse;
    await response.json();
    const searchResponseJson = await searchResponse;
    await searchResponseJson.json();
    await this.page.waitForURL(PagePaths.ANNOUNCEMENTS);
    await this.expectEmptySearchResults();
  }

  async unpublishedAnnouncement(title: string) {
    await this.search(title);
    await this.expectTitleVisible(title);
    await this.expectStatusVisible(AnnouncementStatus.PUBLISHED);
    const actions = await (
      await this.page.getByRole('button', { name: 'Actions' })
    ).first();

    await actions.click();
    const unpublishButton = await this.page.getByRole('button', {
      name: 'Unpublish',
      disabled: false,
    });
    await expect(unpublishButton).toBeVisible();
    await unpublishButton.click();
    const confirmButton = await this.page.getByRole('button', {
      name: 'Confirm',
    });
    const archiveAnnouncementResponse = this.waitForPatchReponse();
    const searchResponse = this.waitForSearch();
    await confirmButton.click();
    const response = await archiveAnnouncementResponse;
    await response.json();
    const searchResponseJson = await searchResponse;
    await searchResponseJson.json();
    await this.page.waitForTimeout(2000);
    await this.expectTitleVisible(title);
    await this.expectStatusVisible(AnnouncementStatus.DRAFT);
    await this.reset();
  }

  private async expectEmptySearchResults() {
    const noResults = await this.page.getByText(
      'No announcements matched the search criteria',
    );
    await expect(noResults).toBeVisible;
  }

  private async reset() {
    const searchResponse = this.waitForSearch();
    await this.resetButton.click();
    const response = await searchResponse;
    await response.json();
    await expect(this.searchInput).toHaveValue('');
    await this.page.waitForURL(PagePaths.ANNOUNCEMENTS);
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

  private async waitForGetAnnouncement(id: string) {
    const getAnnouncementResponse = this.page.waitForResponse((res) => {
      return (
        res.status() === 200 &&
        res.url().includes(`/admin-api/v1/announcements/${id}`) &&
        res.request().method() === 'GET'
      );
    });

    return getAnnouncementResponse;
  }

  private async waitForPatchReponse() {
    const getAnnouncementResponse = this.page.waitForResponse((res) => {
      return (
        res.status() === 201 &&
        res.url().includes(`/admin-api/v1/announcements`) &&
        res.request().method() === 'PATCH'
      );
    });

    return getAnnouncementResponse;
  }

  private formatDate(
    inDateStr: string,
    inFormatter = DateTimeFormatter.ISO_DATE_TIME,
    outFormatter = DateTimeFormatter.ofPattern('MMM d, yyyy').withLocale(
      Locale.CANADA,
    ),
  ) {
    const date = ZonedDateTime.parse(inDateStr, inFormatter);
    const localTz = ZoneId.systemDefault();
    const dateInLocalTz = date.withZoneSameInstant(localTz);
    return outFormatter.format(dateInLocalTz);
  }
}
