import { Translations } from './types';

export const ko: Translations = {
  // Common
  common: {
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    edit: '편집',
    add: '추가',
    search: '검색',
    loading: '로딩 중...',
    error: '오류',
    success: '성공',
    confirm: '확인',
    close: '닫기',
    yes: '예',
    no: '아니오',
    all: '전체',
    none: '없음',
    refresh: '새로고침',
    settings: '설정',
    logout: '로그아웃',
  },

  // Navigation
  nav: {
    home: '홈',
    categories: '카테고리',
    settings: '설정',
    feeds: '피드',
  },

  // Theme
  theme: {
    title: '테마',
    light: '라이트',
    dark: '다크',
    system: '시스템',
    mode: '테마 모드',
    modeDescription: '라이트, 다크 또는 시스템 설정을 따르도록 선택합니다.',
    primaryColor: '주요 색상 (Primary)',
    primaryColorDescription: '버튼, 링크, 액센트에 사용되는 주요 색상입니다.',
    secondaryColor: '보조 색상 (Secondary)',
    secondaryColorDescription: '보조 요소에 사용되는 색상입니다.',
    preset: '프리셋 테마',
    presetDescription: '미리 정의된 색상 조합을 선택하세요.',
    hexValue: 'HEX 값',
    reset: '초기화',
    resetColors: '색상 초기화',
  },

  // Filter
  filter: {
    all: '전체',
    unread: '읽지 않음',
    read: '읽음',
    favorite: '즐겨찾기',
  },

  // View
  view: {
    board: '보드',
    feed: '피드',
    boardView: '보드 보기',
    feedView: '피드 보기',
  },

  // Category
  category: {
    add: '카테고리 추가',
    edit: '카테고리 편집',
    delete: '카테고리 삭제',
    deleteConfirm: '이 카테고리를 삭제하시겠습니까? 포함된 피드도 함께 삭제됩니다.',
    name: '이름',
    description: '설명',
    visible: '표시',
    refresh: '피드 새로고침',
    refreshing: '새로고침 중...',
    empty: '카테고리 없음',
    emptyDescription: '카테고리를 추가하여 피드를 정리하세요.',
    feedCount: '피드 {count}개',
    itemCount: '아이템 {count}개',
  },

  // Feed
  feed: {
    add: '피드 추가',
    edit: '피드 편집',
    delete: '피드 삭제',
    deleteConfirm: '이 피드를 삭제하시겠습니까?',
    url: 'URL',
    title: '제목',
    description: '설명',
    visible: '표시',
    visibleDescription: '끄면 메인/카테고리 화면에서 글이 보이지 않습니다',
    validate: '검증',
    validating: '검증 중',
    validationResult: '검증 결과',
    validationFailed: '피드 검증 실패',
    customHeaders: '커스텀 헤더',
    addHeader: '추가',
    noHeaders: '헤더가 없습니다. 추가 버튼을 눌러 헤더를 추가하세요.',
    faviconUrl: 'Favicon URL',
    refreshInterval: '새로고침 간격',
    refreshIntervalUnit: '분',
    itemCount: '아이템 수',
    latestItemDate: '최신 아이템 날짜',
    enterUrl: 'URL을 입력하세요.',
  },

  // Settings
  settings: {
    title: '설정',
    fontSize: '폰트 크기',
    fontSizeDescription: '피드 아이템의 텍스트 크기를 조절합니다.',
    fontSizeSmall: '작게',
    fontSizeDefault: '기본',
    fontSizeLarge: '크게',
    fontSizeExtraLarge: '매우 크게',
    cruiseSpeed: '크루즈 속도',
    cruiseSpeedDescription: '자동 스크롤 속도를 조절합니다.',
    cruiseSpeedSlow: '느리게',
    cruiseSpeedFast: '빠르게',
    preview: '미리보기',
    previewDescription: '설정이 적용된 모습을 확인할 수 있습니다.',
    language: '언어',
    languageDescription: '인터페이스 언어를 선택합니다.',
  },

  // Auth
  auth: {
    signIn: '로그인',
    signUp: '회원가입',
    signOut: '로그아웃',
    email: '이메일',
    password: '비밀번호',
    confirmPassword: '비밀번호 확인',
    username: '사용자 이름',
    rememberMe: '로그인 유지',
    forgotPassword: '비밀번호 찾기',
    noAccount: '계정이 없으신가요?',
    hasAccount: '이미 계정이 있으신가요?',
  },

  // Errors
  errors: {
    required: '필수 입력 항목입니다.',
    invalidEmail: '올바른 이메일 주소를 입력하세요.',
    passwordMismatch: '비밀번호가 일치하지 않습니다.',
    networkError: '네트워크 오류가 발생했습니다.',
    unknownError: '알 수 없는 오류가 발생했습니다.',
  },
};
