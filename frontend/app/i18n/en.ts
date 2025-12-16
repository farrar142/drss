import { Translations } from './types';

export const en: Translations = {
  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    all: 'All',
    none: 'None',
    refresh: 'Refresh',
    settings: 'Settings',
    logout: 'Logout',
  },

  // Navigation
  nav: {
    home: 'Home',
    categories: 'Categories',
    settings: 'Settings',
    feeds: 'Feeds',
  },

  // Theme
  theme: {
    title: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    mode: 'Theme Mode',
    modeDescription: 'Choose light, dark, or follow system settings.',
    primaryColor: 'Primary Color',
    primaryColorDescription: 'The main color used for buttons, links, and accents.',
    secondaryColor: 'Secondary Color',
    secondaryColorDescription: 'The color used for secondary elements.',
    preset: 'Preset Themes',
    presetDescription: 'Choose from predefined color combinations.',
    hexValue: 'HEX Value',
    reset: 'Reset',
    resetColors: 'Reset Colors',
  },

  // Filter
  filter: {
    all: 'All',
    unread: 'Unread',
    read: 'Read',
    favorite: 'Favorites',
  },

  // View
  view: {
    board: 'Board',
    feed: 'Feed',
    boardView: 'Board View',
    feedView: 'Feed View',
  },

  // Category
  category: {
    add: 'Add Category',
    edit: 'Edit Category',
    delete: 'Delete Category',
    deleteConfirm: 'Delete this category? All included feeds will also be deleted.',
    name: 'Name',
    description: 'Description',
    visible: 'Visible',
    refresh: 'Refresh Feeds',
    refreshing: 'Refreshing...',
    empty: 'No Categories',
    emptyDescription: 'Add a category to organize your feeds.',
    feedCount: '{count} feeds',
    itemCount: '{count} items',
  },

  // Feed
  feed: {
    add: 'Add Feed',
    edit: 'Edit Feed',
    delete: 'Delete Feed',
    deleteConfirm: 'Delete this feed?',
    url: 'URL',
    title: 'Title',
    description: 'Description',
    visible: 'Visible',
    visibleDescription: 'If off, items will not appear on main/category screens',
    validate: 'Validate',
    validating: 'Validating',
    validationResult: 'Validation Result',
    validationFailed: 'Feed validation failed',
    customHeaders: 'Custom Headers',
    addHeader: 'Add',
    noHeaders: 'No headers. Click Add to add a header.',
    faviconUrl: 'Favicon URL',
    refreshInterval: 'Refresh Interval',
    refreshIntervalUnit: 'minutes',
    itemCount: 'Item Count',
    latestItemDate: 'Latest Item Date',
    enterUrl: 'Please enter a URL.',
  },

  // Settings
  settings: {
    title: 'Settings',
    fontSize: 'Font Size',
    fontSizeDescription: 'Adjust the text size of feed items.',
    fontSizeSmall: 'Small',
    fontSizeDefault: 'Default',
    fontSizeLarge: 'Large',
    fontSizeExtraLarge: 'Extra Large',
    cruiseSpeed: 'Cruise Speed',
    cruiseSpeedDescription: 'Adjust the auto-scroll speed.',
    cruiseSpeedSlow: 'Slow',
    cruiseSpeedFast: 'Fast',
    preview: 'Preview',
    previewDescription: 'See how the settings will look.',
    language: 'Language',
    languageDescription: 'Select interface language.',
  },

  // Auth
  auth: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    signOut: 'Sign Out',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    username: 'Username',
    rememberMe: 'Remember Me',
    forgotPassword: 'Forgot Password',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
  },

  // Errors
  errors: {
    required: 'This field is required.',
    invalidEmail: 'Please enter a valid email address.',
    passwordMismatch: 'Passwords do not match.',
    networkError: 'A network error occurred.',
    unknownError: 'An unknown error occurred.',
  },
};
