import { expect, Locator } from 'playwright/test';
import { AdminPortalPage } from '../admin-portal-page';
import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';

export enum FormMode {
  ADD,
  EDIT,
}

export class FormPage extends AdminPortalPage {
  titleInput: Locator;
  descriptionInput: Locator;
  draftOption: Locator;
  publishedOption: Locator;
  cancelButton: Locator;
  saveButton: Locator;
  activeOnInput: Locator;
  expiresOnInput: Locator;
  linkUrlInput: Locator;
  linkTextInput: Locator;

  async setup() {
    await super.setup();
    this.titleInput = await this.page.getByLabel('Title');
    this.descriptionInput = await this.page.getByLabel('Description');
    this.cancelButton = await this.page.getByRole('button', { name: 'Cancel' });
    this.draftOption = await this.page.getByLabel('Draft');
    this.publishedOption = await this.page.getByLabel('Publish');
    this.saveButton = await this.page.getByRole('button', { name: 'Save' });
    this.activeOnInput = await this.page.getByLabel('Active On');
    this.expiresOnInput = await this.page.getByLabel('Expires On');
    this.linkUrlInput = await this.page.getByLabel('Link URL');
    this.linkTextInput = await this.page.getByLabel('Display URL As');

    await expect(this.titleInput).toBeVisible();
    await expect(this.descriptionInput).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
    await expect(this.draftOption).toBeVisible();
    await expect(this.publishedOption).toBeVisible();
    await expect(this.saveButton).toBeVisible();
    await expect(this.activeOnInput).toBeVisible();
    await expect(this.expiresOnInput).toBeVisible();
    await expect(this.linkUrlInput).toBeVisible();
    await expect(this.linkTextInput).toBeVisible();
  }

  async selectDraftOption() {
    await this.draftOption.click();
  }

  async selectPublishedOption() {
    await this.publishedOption.click();
  }

  async fillTitle(title: string) {
    await this.titleInput.fill(title);
  }

  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }

  async fillLinkUrl(url: string) {
    await this.linkUrlInput.fill(url);
  }

  async fillLinkTextInput(text: string) {
    await this.linkTextInput.fill(text);
  }

  async clickSaveButton() {
    await this.saveButton.click();
  }

  async clickCancelButton() {
    await this.cancelButton.click();
  }

  async save(status: 'draft' | 'published') {
    if (status === 'draft') {
      await this.selectDraftOption();
    } else {
      await this.selectPublishedOption();
    }
    await this.clickSaveButton();
    const saveResponse = this.waitForSave();
    const confirmButton = await this.page.getByRole('button', {
      name: 'Confirm',
    });
    await confirmButton.click();
    const response = await saveResponse;
    const announcement = await response.json();
    await this.page.waitForURL('/announcements');
    return announcement;
  }

  async fillActiveOn(date: LocalDate) {
    const dateCellLabel = date.format(
      DateTimeFormatter.ofPattern('EEEE d MMMM yyyy').withLocale(Locale.CANADA),
    );
    await this.activeOnInput.click();
    const dateCell = await this.page.getByLabel(dateCellLabel);
    await expect(dateCell).toBeVisible();
    await dateCell.click();
  }

  async fillExpiresOn(date: LocalDate) {
    const dateCellLabel = date.format(
      DateTimeFormatter.ofPattern('EEEE d MMMM yyyy').withLocale(Locale.CANADA),
    );
    await this.expiresOnInput.click();
    let dateCell = await this.page.getByLabel(dateCellLabel,);
    
    while (!((await dateCell.all()).length > 0)) {
      const nextButton = await this.page.getByRole('button', {
        name: 'Next month',
      });
      await nextButton.click();
      dateCell = await this.page.getByLabel(dateCellLabel);
    }
    await expect(dateCell.first()).toBeVisible();
    await dateCell.first().click();
  }

  private async waitForSave() {
    const saveResponse = this.page.waitForResponse((res) => {
      return (
        [200, 201].includes(res.status()) &&
        res.url().includes('/admin-api/v1/announcements') &&
        ['POST', 'PUT'].includes(res.request().method())
      );
    });

    return saveResponse;
  }
}
