import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'canary-wharf-3d',
    compatibilityDate: '2026-09-21',
    observability: {
      enabled: true
    },
    assets: {
      notFoundHandling: 'single-page-application'
    }
  }
});
