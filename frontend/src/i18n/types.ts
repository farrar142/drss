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
    back: string;
    next: string;
    select: string;
    test: string;
    copy: string;
    copySuccess: string;
    copyFailed: string;
    countUnit: string;
  };

  // Navigation
  nav: {
    home: string;
    categories: string;
    settings: string;
    feeds: string;
    mainstream: string;
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
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
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
    deleteTitle: string;
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
    validationFailedMessage: string;
    customHeaders: string;
    addHeader: string;
    noHeaders: string;
    faviconUrl: string;
    refreshInterval: string;
    refreshIntervalUnit: string;
    itemCount: string;
    latestItemDate: string;
    enterUrl: string;
    // Dropdown menu
    hide: string;
    show: string;
    refresh: string;
    refreshScheduled: string;
    markAllRead: string;
    markAllReadSuccess: string;
    // Feed edit page
    notFound: string;
    loadFailed: string;
    updated: string;
    saveFailed: string;
    saveFirst: string;
    editDescription: string;
    createDescription: string;
    // Source
    sourceDelete: string;
    sourceDeleteConfirm: string;
    sourceDeleteFailed: string;
    sourceRefreshScheduled: string;
    sourceRefreshFailed: string;
    // Source type
    sourceTypeRss: string;
    sourceTypeRssDesc: string;
    sourceTypePageScraping: string;
    sourceTypePageScrapingDesc: string;
    sourceTypeDetailScraping: string;
    sourceTypeDetailScrapingDesc: string;
    pageUrl: string;
    waitSelector: string;
    waitSelectorPlaceholder: string;
  };

  // Settings
  settings: {
    title: string;
    fontSize: string;
    fontSizeDescription: string;
    fontSizeSmall: string;
    fontSizeDefault: string;
    // Font size labels
    fontSizeExtraSmall: string;
    fontSizeNormal: string;
    // Preview buttons
    previewPrimary: string;
    previewSecondary: string;
    previewOutline: string;
    previewGhost: string;
    previewDestructive: string;
    previewAccentArea: string;
    previewMutedArea: string;
    fontSizeLarge: string;
    fontSizeExtraLarge: string;
    cruiseSpeed: string;
    cruiseSpeedDescription: string;
    cruiseSpeedSlow: string;
    cruiseSpeedFast: string;
    preview: string;
    previewDescription: string;
    previewSampleTitle: string;
    previewSampleDescription: string;
    language: string;
    languageDescription: string;
    // Task related
    taskResults: string;
    taskResultsDescription: string;
    periodicTasks: string;
    periodicTasksDescription: string;
    // Admin
    admin: string;
    adminDescription: string;
    userManagement: string;
    userManagementDescription: string;
    allowSignup: string;
    allowSignupDescription: string;
    siteSettings: string;
    siteSettingsDescription: string;
    siteName: string;
    siteNameDescription: string;
    feedSettings: string;
    feedSettingsDescription: string;
    maxFeedsPerUser: string;
    maxFeedsPerUserDescription: string;
    defaultRefreshInterval: string;
    defaultRefreshIntervalDescription: string;
  };

  // Tasks
  tasks: {
    // Status
    statusAll: string;
    statusPending: string;
    statusRunning: string;
    statusSuccess: string;
    statusFailure: string;
    // Task Results
    resultsTitle: string;
    resultsDescription: string;
    executionHistory: string;
    totalRecords: string;
    noRecords: string;
    deleteResults: string;
    deleteFailedResults: string;
    deleteAllResults: string;
    deleteConfirm: string;
    deleteConfirmWithStatus: string;
    page: string;
    itemsCreated: string;
    // Periodic Tasks
    periodicTitle: string;
    periodicDescription: string;
    scheduleList: string;
    totalTasks: string;
    noTasks: string;
    deleteTask: string;
    deleteTaskConfirm: string;
    enabled: string;
    disabled: string;
    total: string;
    runCount: string;
    lastRun: string;
    interval: string;
    enterValidInterval: string;
    enable: string;
    disable: string;
    minutes: string;
    // Time units
    timeSeconds: string;
    timeMinutes: string;
    timeHours: string;
    timeDays: string;
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
    signupDisabled: string;
    signupDisabledMessage: string;
  };

  // Errors
  errors: {
    required: string;
    invalidEmail: string;
    passwordMismatch: string;
    networkError: string;
    unknownError: string;
  };

  // RSS Everything
  rssEverything: {
    title: string;
    description: string;
    // Steps
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
    step6: string;
    reset: string;
    resetConfirm: string;
    // URL Step
    urlLabel: string;
    urlPlaceholder: string;
    fetchPage: string;
    fetching: string;
    useBrowser: string;
    useBrowserDesc: string;
    browserService: string;
    browserServiceDesc: string;
    browserServiceRealbrowser: string;
    browserServiceRealbrowserDesc: string;
    browserServiceBrowserless: string;
    browserServiceBrowserlessDesc: string;
    customHeaders: string;
    addHeader: string;
    headerName: string;
    headerValue: string;
    parseMode: string;
    parseModeList: string;
    parseModeListDesc: string;
    parseModeDetail: string;
    parseModeDetailDesc: string;
    // Selector Step
    listSelectors: string;
    listSelectorsDesc: string;
    detailSelectors: string;
    detailSelectorsDesc: string;
    detailSelectorsNote: string;
    selectElement: string;
    clearSelector: string;
    itemSelector: string;
    itemSelectorDesc: string;
    titleSelector: string;
    linkSelector: string;
    descriptionSelector: string;
    dateSelector: string;
    imageSelector: string;
    contentSelector: string;
    authorSelector: string;
    categoriesSelector: string;
    // Preview Step
    preview: string;
    previewItems: string;
    loadingPreview: string;
    previewError: string;
    noItemsFound: string;
    previewEmpty: string;
    // Save Step
    saveFeed: string;
    addSource: string;
    addSourceDescription: string;
    feedName: string;
    feedNamePlaceholder: string;
    feedInfo: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    autoDetected: string;
    selectCategory: string;
    refreshInterval: string;
    refreshIntervalUnit: string;
    saving: string;
    createSuccess: string;
    createError: string;
    // Source Type Step
    selectSourceType: string;
    selectSourceTypeDesc: string;
    sourceTypeRss: string;
    sourceTypeRssDesc: string;
    sourceTypePageScraping: string;
    sourceTypePageScrapingDesc: string;
    sourceTypeDetailScraping: string;
    sourceTypeDetailScrapingDesc: string;
    rssUrlInput: string;
    rssUrlInputDesc: string;
    feedUrl: string;
    // Validation
    urlRequired: string;
    itemSelectorRequired: string;
    feedNameRequired: string;
    categoryRequired: string;
    // Selector validation
    validating: string;
    validationResult: string;
    itemsFound: string;
    itemsWithLinks: string;
    noLinksWarning: string;
    selectorMismatchWarning: string;
    detailSelectorWorks: string;
    detailSelectorNotFound: string;
    validate: string;
    customHeadersDescription: string;
    // Mobile toggle
    selectorSettings: string;
    htmlPreview: string;
    clickToExclude: string;
    // Additional
    editSourceDescription: string;
    jsonParseError: string;
    invalidJsonObject: string;
    sourceUpdated: string;
    sourceLoadFailed: string;
    // RssSaveStep
    rssSourceSettings: string;
    rssFeedUrl: string;
    verify: string;
    rssFeedVerifySuccess: string;
    rssFeedVerifyFailed: string;
    itemCountLabel: string;
    titleLabel: string;
    descriptionLabelShort: string;
    editSource: string;
    // StepHeader
    listSelectorStep: string;
  };

  // UI
  ui: {
    // Tabs
    closeAllTabs: string;
    newTab: string;
    columnCount: string;
    // AppBar
    showAppBar: string;
    hideAppBar: string;
    // Cruising
    showCruiseButtons: string;
    hideCruiseButtons: string;
    scrollToTop: string;
    cruiseSettings: string;
    startCruise: string;
    stopCruise: string;
    // Media
    viewSingle: string;
    viewDual: string;
    centerAlign: string;
    spreadAlign: string;
    readLtr: string;
    readRtl: string;
    downloadImage: string;
    downloadVideo: string;
    previous: string;
    toFirst: string;
    toLast: string;
    // New posts
    newPosts: string;
  };

  // Selector
  selector: {
    // List page
    listPageSelectors: string;
    listPageSelectorsDesc: string;
    detailPageSelectors: string;
    detailPageSelectorsDesc: string;
    // Selector fields
    itemSelector: string;
    itemSelectorDesc: string;
    titleSelector: string;
    titleSelectorDesc: string;
    linkSelector: string;
    linkSelectorDesc: string;
    descriptionSelector: string;
    descriptionSelectorDesc: string;
    dateSelector: string;
    dateSelectorDesc: string;
    imageSelector: string;
    imageSelectorDesc: string;
    // Detail page
    detailTitleSelector: string;
    detailTitleSelectorDesc: string;
    detailDescriptionSelector: string;
    detailDescriptionSelectorDesc: string;
    contentSelector: string;
    contentSelectorDesc: string;
    detailDateSelector: string;
    detailDateSelectorDesc: string;
    detailImageSelector: string;
    detailImageSelectorDesc: string;
    // Test and results
    testSelector: string;
    foundCount: string;
    sample: string;
    step2: string;
    step3: string;
    selectPlaceholder: string;
  };

  // Admin
  admin: {
    selectPlaceholder: string;
  };

  // Source list
  sourceList: {
    title: string;
    addSource: string;
    noSources: string;
    noSourcesHint: string;
    lastCrawled: string;
    copyConfig: string;
    configCopied: string;
    copyFailedNoClipboard: string;
    paginationCrawl: string;
    paginationCrawlDescription: string;
    urlTemplate: string;
    urlTemplatePlaceholder: string;
    urlTemplateHint: string;
    variables: string;
    variableName: string;
    variableStart: string;
    variableEnd: string;
    variableStep: string;
    addVariable: string;
    removeVariable: string;
    delayMs: string;
    delayMsUnit: string;
    startCrawl: string;
    crawling: string;
    crawlScheduled: string;
    crawlSuccess: string;
    crawlFailed: string;
    crawlErrors: string;
    noVariables: string;
  };
}
