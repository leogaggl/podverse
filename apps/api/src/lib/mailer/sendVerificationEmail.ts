import { config } from '@api/config/index.js';
import { verifyEmailPagePath } from '@api/constants/webAuthPagePaths.js';
import { emailTemplate } from '@api/lib/mailer/emailTemplate.js';
import type { MailerSendResult } from '@api/lib/mailer/mailerSendResult.js';
import { logMailerSendFailure, openMailer } from '@api/lib/mailer/mailerSendResult.js';

export const sendVerificationEmail = async (
  email: string,
  _name: string,
  token: string
): Promise<MailerSendResult> => {
  const opened = await openMailer('verification');
  if (opened.status === 'skipped' || opened.status === 'failed') {
    return opened.status;
  }

  const emailFields = {
    buttonLink: `${config.web.protocol}://${config.web.domain}${verifyEmailPagePath}${token}`,
    buttonText: 'Verify email',
    closing: '',
    headerText: 'Verify your email',
    paragraphText: 'Please click the button below to finish verification.',
    unsubscribeLink: '',
  };

  try {
    await opened.transporter.sendMail({
      from: `${config.brandName} <${config.mailer.from}>`,
      to: email,
      subject: `Verify your email address with ${config.brandName}`,
      html: emailTemplate(emailFields),
      text: `Verify your email by visiting the following: ${emailFields.buttonLink}`,
    });
  } catch (err) {
    logMailerSendFailure('Verification email send failed', err);
    return 'failed';
  }

  return 'sent';
};

/**
 * Checks that the mailer can accept a message without sending one.
 * A reachable mailer is reported as skipped so signup omits the failure code.
 */
export const probeVerificationMailer = async (): Promise<MailerSendResult> => {
  const opened = await openMailer('verification');
  if (opened.status === 'skipped' || opened.status === 'failed') {
    return opened.status;
  }

  try {
    await opened.transporter.verify();
  } catch (err) {
    logMailerSendFailure('Verification mailer probe failed', err);
    return 'failed';
  }

  return 'skipped';
};
