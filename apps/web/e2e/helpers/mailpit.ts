const MAILPIT_MESSAGES_URL = 'http://127.0.0.1:8025/api/v1/messages?limit=50';

type MailpitAddress = {
  Address?: string;
};

type MailpitMessage = {
  To?: MailpitAddress[];
};

type MailpitList = {
  messages?: MailpitMessage[];
};

const isMailpitList = (value: unknown): value is MailpitList => {
  return typeof value === 'object' && value !== null;
};

const messageAddresses = (message: MailpitMessage): string[] => {
  if (!Array.isArray(message.To)) {
    return [];
  }
  return message.To.flatMap((to) =>
    typeof to.Address === 'string' ? [to.Address.toLowerCase()] : []
  );
};

/** Polls the local Mailpit HTTP API until a message is addressed to `email`. */
export const waitForMailpitMessageTo = async (email: string): Promise<void> => {
  const target = email.toLowerCase();
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    const response = await fetch(MAILPIT_MESSAGES_URL);
    if (response.ok) {
      const body: unknown = await response.json();
      if (
        isMailpitList(body) &&
        Array.isArray(body.messages) &&
        body.messages.some((message) => messageAddresses(message).includes(target))
      ) {
        return;
      }
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(`Mailpit did not receive a message for ${email}`);
};
