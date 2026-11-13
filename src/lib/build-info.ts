export type ClientBuildInfo = {
  version: string;
  commit: string;
  dirty: boolean;
  buildDate: string;
};

const fallback: ClientBuildInfo = {
  version: 'dev',
  commit: 'unknown',
  dirty: false,
  buildDate: new Date().toISOString(),
};

export const buildInfo: ClientBuildInfo =
  typeof __SLEEVE_BUILD__ === 'undefined' ? fallback : __SLEEVE_BUILD__;
