import { config } from '@api/config/index.js';
import { emailChangeVerificationPagePath } from '@api/constants/webAuthPagePaths.js';
import { emailTemplate } from '@api/lib/mailer/emailTemplate.js';
import type { MailerSendResult } from '@api/lib/mailer/mailerSendResult.js';
import { logMailerSendFailure, openMailer } from '@api/lib/mailer/mailerSendResult.js';

export const sendEmailChangeVerificationEmail = async (
  pending_email_address: string,
  token: string
): Promise<MailerSendResult> => {
  const opened = await openMailer('email_change');
  if (opened.status === 'skipped' || opened.status === 'failed') {
    return opened.status;
  }

  const emailFields = {
    buttonLink: `${config.web.protocol}://${config.web.domain}${emailChangeVerificationPagePath}${token}`,
    buttonText: 'Verify email change',
    closing: '',
    headerText: 'Verify your change of email',
    paragraphText: `Are you sure you want to change your email address to ${pending_email_address}? Please click the button below to complete your email change.`,
    unsubscribeLink: '',
  };

  try {
    await opened.transporter.sendMail({
      from: `${config.brandName} <${config.mailer.from}>`,
      to: pending_email_address,
      subject: `Verify your change of email with ${config.brandName}`,
      html: emailTemplate(emailFields),
      text: `Verify your email change request by visiting the following: ${emailFields.buttonLink}`,
    });
  } catch (err) {
    logMailerSendFailure('Email change verification email send failed', err);
    return 'failed';
  }

  return 'sent';
};
