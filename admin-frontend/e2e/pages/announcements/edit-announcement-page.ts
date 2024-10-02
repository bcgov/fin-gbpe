import { expect } from 'playwright/test';
import { PagePaths } from '../../utils';
import { FormPage } from './form-page';
import { DateTimeFormatter, ZonedDateTime, ZoneId } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';
import { faker } from '@faker-js/faker';

export class EditAnnouncementPage extends FormPage {
  initialData: any;
  static path = PagePaths.EDIT_ANNOUNCEMENTS;

  async setup() {
    await super.setup();
  }

  static async visit(page, initialData) {
    await page.goto(EditAnnouncementPage.path);
    const addAnnouncementPage = new EditAnnouncementPage(page);
    addAnnouncementPage.initialData = initialData;
    await addAnnouncementPage.setup();
    return addAnnouncementPage;
  }

  async verifyLoadedData() {
    await expect(this.titleInput).toHaveValue(this.initialData.title);
    await expect(this.descriptionInput).toHaveValue(
      this.initialData.description,
    );
    await expect(this.activeOnInput).toHaveValue(
      this.initialData.active_on
        ? this.formatInputDate(this.initialData.active_on)
        : '',
    );
    await expect(this.expiresOnInput).toHaveValue(
      this.initialData.expires_on
        ? this.formatInputDate(this.initialData.expires_on)
        : '',
    );

    if (this.initialData.status === 'DRAFT') {
      await expect(this.draftOption).toBeChecked();
    } else {
      await expect(this.publishedOption).toBeChecked();
    }

    const linkResource = this.initialData.announcement_resource.find(
      (x) => x.resource_type === 'LINK',
    );
    const fileResource = this.initialData.announcement_resource.find(
      (x) => x.resource_type === 'ATTACHMENT',
    );
    if (linkResource) {
      const linkDisplay = await this.page.getByRole('link', {
        name: linkResource.display_name,
      });
      await expect(linkDisplay.first()).toBeVisible();
    }

    if (fileResource) {
      const fileDisplay = await this.page.getByRole('link', {
        name: fileResource.display_name,
      });
      await expect(fileDisplay.first()).toBeVisible();
    }
  }

  async editForm() {
    await this.fillTitle(faker.lorem.words(3));
    await this.fillDescription(faker.lorem.words(10));
  }

  async saveChanges() {
    if (this.initialData.status === 'PUBLISHED') {
      return this.save('published');
    } else {
      return this.save('draft');
    }
  }

  formatInputDate(input: string) {
    const date = ZonedDateTime.parse(input, DateTimeFormatter.ISO_DATE_TIME);
    const localTz = ZoneId.systemDefault();
    const dateInLocalTz = date.withZoneSameInstant(localTz);
    return DateTimeFormatter.ofPattern('yyyy-MM-dd hh:mm a')
      .withLocale(Locale.CANADA)
      .format(dateInLocalTz)
      .replace('a.m.', 'AM')
      .replace('p.m.', 'PM');
  }
}
