export const baseURL = process.env.E2E_ADMIN_BASE_URL;

export const PagePaths = {
  LOGIN: `${baseURL}/login`,
  LOGOUT: `${baseURL}/logout`,
  DASHBOARD: `${baseURL}/dashboard`,
  REPORTS: `${baseURL}/reports`,
  ANNOUNCEMENTS: `${baseURL}/announcements`,
  ADD_ANNOUNCEMENTS: `${baseURL}/add-announcement`,
  EDIT_ANNOUNCEMENTS: `${baseURL}/edit-announcement`,
  USER_MANAGEMENT: `${baseURL}/user-management`,
  ANALYTICS: `${baseURL}/analytics`,
};
