<template>
  <v-row dense class="mt-0 w-100 mb-4">
    <v-col class="py-0">
      <AnnouncementSearchFilters />
    </v-col>
  </v-row>

  <div class="search-results w-100">
<<<<<<< Updated upstream
    <div class="d-flex flex-wrap">
=======
    <div class="d-flex flex-wrap mb-4 align-center">
>>>>>>> Stashed changes
      <h4 v-if="searchResults?.length" class="">
        Displaying {{ searchResults.length }} announcement<span
          v-if="searchResults.length != 1"
          >s</span
        >
      </h4>
      <v-btn class="btn-primary ml-auto" to="/add-announcement">
        Add Announcement
      </v-btn>
    </div>

    <v-data-table-server
      v-model:items-per-page="pageSize"
      :headers="headers"
      :items="searchResults"
      :items-length="totalNum"
      :loading="isSearching"
      :items-per-page-options="itemsPerPageOptions"
      search=""
      :no-data-text="
        hasSearched ? 'No announcements matched the search criteria' : ''
      "
      @update:options="updateSearch"
    >
      <template #header.selection="{ column }">
        <v-checkbox
          v-model="isSelectedAnnouncementsHeaderChecked"
          class="checkbox-no-details"
          aria-label="Toggle all announcements"
          @click="
            toggleSelectAllAnnouncements(!isSelectedAnnouncementsHeaderChecked)
          "
        ></v-checkbox>
      </template>
      <template #item.selection="{ item }">
        <v-checkbox
          v-model="selectedAnnouncements[item.announcement_id]"
          class="checkbox-no-details"
          :aria-label="`Select announcement ${item.title}`"
        >
        </v-checkbox>
      </template>
      <template #item.title="{ item }">
        <v-btn
          variant="text"
          class="btn-link no-min-width"
          color="link"
          @click="showAnnouncement(item)"
        >
          {{ item.title }}
        </v-btn>
      </template>
      <template #item.active_on="{ item }">
        <div v-if="item.active_on">
          <div>{{ formatIsoDateTimeAsLocalDate(item.active_on) }}</div>
          <small class="text-grey-darken-3">{{
            formatIsoDateTimeAsLocalTime(item.active_on)
          }}</small>
        </div>
        <div v-else>-</div>
      </template>
      <template #item.expires_on="{ item }">
        <div v-if="item.expires_on">
          <div>{{ formatIsoDateTimeAsLocalDate(item.expires_on) }}</div>
          <small class="text-grey-darken-3">{{
            formatIsoDateTimeAsLocalTime(item.expires_on)
          }}</small>
        </div>
        <div v-else>-</div>
      </template>
      <template #item.status="{ item }">
        <AnnouncementStatusChip :status="item.status"></AnnouncementStatusChip>
      </template>
      <template #item.actions="{ item }">
        <AnnouncementActions :announcement="item"></AnnouncementActions>
      </template>
      <template #footer.prepend="">
        <v-row class="d-flex justify-start">
          <v-col class="d-flex justify-start">
            <div class="mt-3 d-flex flex-column align-center">
              <v-btn
                class="btn-secondary"
                :disabled="!selectedAnnouncementIds.length || isArchiving"
                :loading="isArchiving"
                prepend-icon="mdi-archive"
                @click="archiveAnnouncements(selectedAnnouncementIds)"
                >Archive</v-btn
              >
              <small v-if="selectedAnnouncementIds.length">
                {{ selectedAnnouncementIds.length }} selected
              </small>
            </div>
          </v-col>
        </v-row>
      </template>
    </v-data-table-server>
  </div>

  <!-- dialogs -->
  <ConfirmationDialog ref="confirmDialog"> </ConfirmationDialog>
  <v-dialog
    v-model="isAnnouncementDialogVisible"
    :close-on-content-click="true"
    max-width="390"
  >
    <v-card>
      <v-card-title>
        {{ announcementInDialog?.title }}
      </v-card-title>

      <v-card-text>
        {{ announcementInDialog?.description }}
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn class="btn-secondary" @click="showAnnouncement(undefined)">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { ref, watch, computed } from 'vue';
import AnnouncementSearchFilters from './announcements/AnnouncementSearchFilters.vue';
import AnnouncementStatusChip from './announcements/AnnouncementStatusChip.vue';
import AnnouncementActions from './announcements/AnnouncementActions.vue';
import { useAnnouncementSearchStore } from '../store/modules/announcementSearchStore';
import {
  formatIsoDateTimeAsLocalDate,
  formatIsoDateTimeAsLocalTime,
} from '../utils/date';
import { AnnouncementKeys } from '../types/announcements';
import ApiService from '../services/apiService';
import ConfirmationDialog from './util/ConfirmationDialog.vue';
import { NotificationService } from '../services/notificationService';

const announcementSearchStore = useAnnouncementSearchStore();
const { searchResults, isSearching, hasSearched, totalNum, pageSize } =
  storeToRefs(announcementSearchStore);

const announcementInDialog = ref<any>(undefined);
const confirmDialog = ref<typeof ConfirmationDialog>();
const isAnnouncementDialogVisible = ref<boolean>(false);
const isSelectedAnnouncementsHeaderChecked = ref<boolean>(false);
const selectedAnnouncements = ref<object>({});
const isArchiving = ref<boolean>(false);
const selectedAnnouncementIds = computed(() =>
  Object.entries(selectedAnnouncements.value)
    .filter(([_, value]) => value)
    .map(([key, _]) => key),
);

watch(searchResults, () => {
  // Don't allow an announcement to be selected if it isn't in the current page
  // of search results
  clearSelectionOfNonSearchResults();
});

const itemsPerPageOptions = ref([
  { value: 10, title: '10' },
  { value: 25, title: '25' },
  {
    value: 50,
    title: '50',
  },
  { value: 100, title: '100' },
  { value: 150, title: '150' },
]);

const headers = ref<any>([
  {
    title: '',
    key: 'selection',
    align: 'start',
    sortable: false,
  },
  {
    title: 'Title',
    align: 'start',
    sortable: true,
    key: AnnouncementKeys.TITLE,
  },
  {
    title: 'Active On',
    align: 'start',
    sortable: true,
    key: AnnouncementKeys.PUBLISH_DATE,
  },
  {
    title: 'Expires On',
    align: 'start',
    sortable: true,
    key: AnnouncementKeys.EXPIRY_DATE,
  },
  {
    title: 'Status',
    align: 'start',
    sortable: true,
    key: AnnouncementKeys.STATUS,
  },
  {
    title: 'Actions',
    key: 'actions',
    align: 'center',
    sortable: false,
  },
]);

function selectAnnouncement(announcement, select: boolean = true) {
  if (!announcement) {
    return;
  }
  if (select) {
    selectedAnnouncements.value[announcement.announcement_id] = true;
  } else {
    delete selectedAnnouncements.value[announcement.announcement_id];
  }
}

function toggleSelectAllAnnouncements(select: boolean) {
  clearSelectionOfNonSearchResults();
  searchResults.value?.forEach((announcement) => {
    selectAnnouncement(announcement, select);
  });
}

/*
Removes from 'selectedAnnouncements' any announcements that are not also
in the current 'searchResults'.
*/
function clearSelectionOfNonSearchResults() {
  Object.keys(selectedAnnouncements.value).forEach((announcementId) => {
    const isInSearchResults = searchResults.value?.filter(
      (announcement) => announcement.announcement_id == announcementId,
    ).length;
    if (!isInSearchResults) {
      delete selectedAnnouncements.value[announcementId];
    }
  });
}

function showAnnouncement(announcement) {
  announcementInDialog.value = announcement;
  isAnnouncementDialogVisible.value = announcement != undefined;
}

async function updateSearch(options) {
  await announcementSearchStore.updateSearch(options);
}

async function repeatSearch() {
  await announcementSearchStore.repeatSearch();
}

async function archiveAnnouncements(announcementIds: string[]) {
  const isConfirmed = await confirmDialog.value?.open(
    'Confirm Archive',
    `Are you sure you want to archive the selected announcement${announcementIds.length != 1 ? 's' : ''}?  This action cannot be undone.`,
    {
      titleBold: true,
      resolveText: `Confirm`,
    },
  );
  if (isConfirmed) {
    isArchiving.value = true;
    try {
      await ApiService.deleteAnnouncements(announcementIds);
      announcementSearchStore.repeatSearch();
      NotificationService.pushNotificationSuccess(
        `Announcement${announcementIds.length != 1 ? 's' : ''} archived successfully.`,
        '',
      );
    } catch (e) {
    } finally {
      isArchiving.value = false;
    }
  }
}
</script>

<style>
.v-chip {
  font-weight: bold !important;
  font-size: 0.8rem !important;
}
.btn-actions {
  opacity: 1 !important;
}
.checkbox-no-details > .v-input__details {
  display: none;
}
.no-min-width {
  min-width: 0px !important;
}
</style>
