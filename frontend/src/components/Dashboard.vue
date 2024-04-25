<template>
  <v-row class="mt-3">
    <v-col>
      <h2 data-testid="legal-name">Welcome, {{ userInfo?.legalName }}.</h2>
      <v-divider class="mt-2"></v-divider>
    </v-col>
  </v-row>
  <v-row>
    <v-col>
      <p class="mt-4 mb-4">
        This tool will help you generate a Pay Transparency report in compliance
        with the
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/23018"
          >Pay Transparency Act (gov.bc.ca)</a
        >
        and the
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/225_2023"
          >Pay Transparency Regulation (gov.bc.ca)</a
        >. The report can be saved for posting on your webpage or in your
        workplace.
      </p>
      <p class="mb-6">
        Once your CSV file is ready, click on the button below to upload the
        file and generate a report.
      </p>
      <v-btn class="mb-4 btn-primary" to="generate-report-form">
        Upload your CSV here
      </v-btn>
      <p class="text-caption mb-2">
        This application does not collect, record or publish personal
        information.
      </p>
    </v-col>
    <v-col md="4" cols="12">
      <v-card class="rounded-lg">
        <v-toolbar color="tab">
          <v-toolbar-title>Updates</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="mt-4 mb-4">
          <div class="text-left bluebox-width">
            <strong>
              For more information on Pay Transparency reporting, please visit
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www2.gov.bc.ca/gov/content/gender-equity/preparing-pay-transparency-reports"
              >
                Guidance for preparing pay transparency reports - Province of
                British Columbia (gov.bc.ca)</a
              >.
            </strong>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <v-row class="mt-8 mb-8">
    <v-col>
      <v-card class="rounded-lg" min-height="100%">
        <v-toolbar color="tab">
          <v-toolbar-title>Submitted Reports</v-toolbar-title>
        </v-toolbar>
        <v-card-text>
          <ReportsTable />
        </v-card-text>
      </v-card>
    </v-col>
    <v-col md="4" cols="12">
      <v-card class="rounded-lg">
        <v-toolbar color="tab">
          <v-toolbar-title>Sample CSV</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="mt-4 mb-4">
          <p class="mb-4">
            View a sample comma-separated value (CSV) file showing the required
            format for pay transparency data uploads.
          </p>
          <v-btn class="btn-secondary" href="SampleCsv.csv" download>
            Download sample CSV
          </v-btn>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script lang="ts">
import ReportsTable from './util/ReportsTable.vue';
import { mapState } from 'pinia';
import { authStore } from '../store/modules/auth';

type DashboardData = {
  userInfo?: any;
};

export default {
  components: { ReportsTable },
  data: (): DashboardData => ({}),
  computed: {
    ...mapState(authStore, ['userInfo']),
  }
};
</script>

<style>
.v-card-text.generate-report {
  display: flex;
  justify-content: center;
  align-items: center;
  background: aliceblue;
}

.v-card--variant-elevated.no-box-shadow {
  box-shadow: none;
}
</style>
