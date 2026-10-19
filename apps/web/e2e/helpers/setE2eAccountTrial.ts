import { Client } from 'pg';

import { AccountMembershipEnum } from '@podverse/helpers';

const E2E_USER_EMAIL = 'e2e-user@example.com';

/**
 * The shared e2e account's tier is whatever the last writer left. Buy Membership is the Trial
 * label; Premium uses Extend Membership. Specs that assert Buy Membership set Trial first.
 */
export async function setE2eAccountTrial(email: string = E2E_USER_EMAIL): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5732'),
    user: process.env.SEED_DB_USER ?? 'podverse_app_read_write',
    password: process.env.SEED_DB_PASSWORD ?? 'test',
    database: process.env.DB_APP_NAME ?? 'podverse_app_test',
  });
  await client.connect();
  try {
    const updated = await client.query(
      `UPDATE account_membership_status AS status
       SET account_membership_id = $2
       FROM account_credentials AS credentials
       WHERE credentials.account_id = status.account_id
         AND credentials.email = $1`,
      [email, AccountMembershipEnum.Trial]
    );
    if (updated.rowCount !== 1) {
      throw new Error(`Expected one membership row for ${email}`);
    }
  } finally {
    await client.end();
  }
}
