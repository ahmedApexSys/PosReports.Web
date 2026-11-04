export const environment = {
  production: false,
  apiBaseUrl: 'https://ts9api.tryasp.net',
  defaultLanguage: 'ar' as 'en' | 'ar',
  defaultTheme: 'system' as 'light' | 'dark' | 'system',
  defaultBranchId: null as number | null,
  defaultCompareWindowDays: 7,
  /**
   * Who may show these reports inside themselves and hand over a sign-in
   * (core/embed). The till: its site, its dev server, and the desktop build,
   * which loads from file:// and so reports its origin as "file://" or "null".
   */
  embedOrigins: ['https://newposui.premiumasp.net', 'http://localhost:1844', 'file://', 'null'],
};
