// Supported languages
export type Language = 'ko' | 'en';

// Translation keys structure
export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    close: string;
    yes: string;
    no: string;
    all: string;
    none: string;
    refresh: string;
    settings: string;
    logout: string;
  };

  // Navigation
  nav: {
    home: string;
    categories: string;
    settings: string;
    feeds: string;
  };

  // Theme
  theme: {
    title: string;
    light: string;
    dark: string;
    system: string;
    mode: string;
    modeDescription: string;
    primaryColor: string;
    primaryColorDescription: string;
    secondaryColor: string;
    secondaryColorDescription: string;
    preset: string;
    presetDescription: string;
    hexValue: string;
    reset: string;
    resetColors: string;
  };

  // Filter
  filter: {
    all: string;
    unread: string;
    read: string;
    favorite: string;
  };

  // View
  view: {
    board: string;
    feed: string;
    boardView: string;
    feedView: string;
  };

  // Category
  category: {
    add: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    name: string;
    description: string;
    visible: string;
    refresh: string;
    refreshing: string;
    empty: string;
    emptyDescription: string;
    feedCount: string;
    itemCount: string;
  };

  // Feed
  feed: {
    add: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    url: string;
    title: string;
    description: string;
    visible: string;
    visibleDescription: string;
    validate: string;
    validating: string;
    validationResult: string;
    validationFailed: string;
    customHeaders: string;
    addHeader: string;
    noHeaders: string;
    faviconUrl: string;
    refreshInterval: string;
    refreshIntervalUnit: string;
    itemCount: string;
    latestItemDate: string;
    enterUrl: string;
  };

  // Settings
  settings: {
    title: string;
    fontSize: string;
    fontSizeDescription: string;
    fontSizeSmall: string;
    fontSizeDefault: string;
    fontSizeLarge: string;
    fontSizeExtraLarge: string;
    cruiseSpeed: string;
    cruiseSpeedDescription: string;
    cruiseSpeedSlow: string;
    cruiseSpeedFast: string;
    preview: string;
    previewDescription: string;
    language: string;
    languageDescription: string;
  };

  // Auth
  auth: {
    signIn: string;
    signUp: string;
    signOut: string;
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
    rememberMe: string;
    forgotPassword: string;
    noAccount: string;
    hasAccount: string;
  };

  // Errors
  errors: {
    required: string;
    invalidEmail: string;
    passwordMismatch: string;
    networkError: string;
    unknownError: string;
  };
}
