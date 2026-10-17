import { loggerService } from '@api/factories/loggerService.js';
import * as transporterModule from '@api/lib/mailer/transporter.js';
import type { Transporter } from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.fn();
const MAIL_PASSWORD = 'secret-mailer-password';

const loggedText = (spy: { mock: { calls: unknown[][] } }): string => {
  return spy.mock.calls
    .map((call) =>
      call
        .map((part) => {
          if (part instanceof Error) {
            return `${part.name} ${part.message} ${part.stack ?? ''}`;
          }
          return JSON.stringify(part);
        })
        .join(' ')
    )
    .join('\n');
};

const fakeTransporter = (): Transporter => {
  const transport: Pick<Transporter, 'sendMail' | 'verify'> = {
    sendMail: sendMailMock,
    verify: async () => true,
  };
  // sendVerificationEmail only calls sendMail. The rest of Transporter is unused here.
  return transport as Transporter;
};

describe('sendVerificationEmail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns failed when sendMail rejects and the log omits the password', async () => {
    vi.spyOn(transporterModule, 'createTransporter').mockImplementation(fakeTransporter);
    const logErrorSpy = vi.spyOn(loggerService, 'logError');
    sendMailMock.mockRejectedValueOnce(
      Object.assign(new Error(`535 Authentication failed ${MAIL_PASSWORD}`), {
        code: 'EAUTH',
        responseCode: 535,
        response: `535 5.7.8 Authentication failed ${MAIL_PASSWORD}`,
      })
    );

    const { sendVerificationEmail } = await vi.importActual<
      typeof import('./sendVerificationEmail.js')
    >('./sendVerificationEmail.js');

    const result = await sendVerificationEmail('person@example.com', 'account-id', 'token');

    expect(result).toBe('failed');
    const logged = loggedText(logErrorSpy);
    expect(logged).not.toContain(MAIL_PASSWORD);
    expect(logged).toContain('EAUTH');
    expect(logged).toContain('535');
  });

  it('returns failed when the transporter cannot be created', async () => {
    vi.spyOn(transporterModule, 'createTransporter').mockImplementation(() => {
      throw Object.assign(new Error(`connect failed ${MAIL_PASSWORD}`), {
        code: 'ECONNECTION',
      });
    });
    sendMailMock.mockClear();

    const { sendVerificationEmail } = await vi.importActual<
      typeof import('./sendVerificationEmail.js')
    >('./sendVerificationEmail.js');

    const result = await sendVerificationEmail('person@example.com', 'account-id', 'token');

    expect(result).toBe('failed');
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
