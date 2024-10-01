import { expect, test } from '@playwright/test';
import { AnnouncementsPage } from './pages/announcements/announcements-page';
import { AddAnnouncementPage } from './pages/announcements/add-announcement-page';

test.describe('Announcements', () => {
  test.describe('add announcement', () => {
    test.skip('save as draft', async ({ page }) => {
      const announcementsPage = await AnnouncementsPage.visit(page);
      await announcementsPage.clickAddAnnouncementButton();
      const addAnnouncementPage = await AddAnnouncementPage.visit(page);
      await addAnnouncementPage.fillDraftForm();
      const announcement = await addAnnouncementPage.save('draft');
      await expect(announcement.status).toBe('DRAFT');
      await expect(announcement.title).toBeDefined();
      await expect(announcement.description).toBeDefined();
      await expect(announcement.active_on).toBeNull();
      await expect(announcement.expires_on).toBeNull();
      await announcementsPage.search(announcement.title);
      await announcementsPage.expectTitleVisible(announcement.title);
    });

    test.skip('save as published', async ({ page }) => {
      const announcementsPage = await AnnouncementsPage.visit(page);
      await announcementsPage.clickAddAnnouncementButton();
      const addAnnouncementPage = await AddAnnouncementPage.visit(page);
      await addAnnouncementPage.fillPublishedForm();
      const announcement = await addAnnouncementPage.save('published');
      await expect(announcement.status).toBe('PUBLISHED');
      await expect(announcement.title).toBeDefined();
      await expect(announcement.description).toBeDefined();
      await expect(announcement.active_on).toBeDefined();
      await expect(announcement.expires_on).toBeDefined();
      await announcementsPage.search(announcement.title);
      await announcementsPage.expectTitleVisible(announcement.title);
    });

    test('save announcement with file attachment', async ({ page }) => {
      const announcementsPage = await AnnouncementsPage.visit(page);
      await announcementsPage.clickAddAnnouncementButton();
      const addAnnouncementPage = await AddAnnouncementPage.visit(page);

      await addAnnouncementPage.fillDraftForm();
    });
  });
});
