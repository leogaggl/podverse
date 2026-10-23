import { vi } from 'vitest';

vi.mock('@management-api/lib/auth/adminSessionStore.js', async () => {
  const { adminSessionStoreStub } = await import('@management-api/test/adminSessionStoreStub.js');
  return adminSessionStoreStub;
});
