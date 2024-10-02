import { expect, Locator } from 'playwright/test';
import { AdminPortalPage } from '../admin-portal-page';
import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';
import path from 'path';
import { faker } from '@faker-js/faker';

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
  chooseFileButton: Locator;
  fileDisplayNameInput: Locator;

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
    this.chooseFileButton = await this.page.getByRole('button', {
      name: 'Choose file',
    });
    this.fileDisplayNameInput = await this.page.getByLabel(
      'Display File Link As',
    );

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
    await expect(this.chooseFileButton).toBeVisible();
    await expect(this.fileDisplayNameInput).toBeVisible();
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

  async fillFileDisplayName(displayName: string) {
    await this.fileDisplayNameInput.fill(displayName);
  }

  async fillExpiresOn(date: LocalDate) {
    const dateCellLabel = date.format(
      DateTimeFormatter.ofPattern('EEEE d MMMM yyyy').withLocale(Locale.CANADA),
    );
    await this.expiresOnInput.click();
    let dateCell = await this.page.getByLabel(dateCellLabel);

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

  async chooseFile(valid: boolean = true) {

    await this.fileDisplayNameInput.fill(faker.lorem.word(1));
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    
    const scanResponse = this.waitForClamavScan();
    await this.chooseFileButton.click();
    const fileChooser = await fileChooserPromise;
    const fileName = valid ? 'valid.pdf' : 'invalid.com';
    await fileChooser.setFiles(
      path.resolve('e2e', 'assets', 'announcements', fileName),
    );
    const response = await scanResponse;
    await response.json();
  }

  async expectFileInvalidError() {
    const error = await this.page.getByText('File is invalid.');
    await expect(error).toBeVisible();
  }

  private waitForSave() {
    const saveResponse = this.page.waitForResponse((res) => {
      return (
        [200, 201].includes(res.status()) &&
        res.url().includes('/admin-api/v1/announcements') &&
        ['POST', 'PUT'].includes(res.request().method())
      );
    });

    return saveResponse;
  }

  private waitForClamavScan() {
    return this.page.waitForResponse((res) => {
      return res.url().includes('/clamav-api');
    });
  }
}
