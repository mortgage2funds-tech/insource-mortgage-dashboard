import { Resend } from 'resend';

type TaskCreatedEmailArgs = {
  to: string;
  title?: string;
  clientName?: string;
  dueDate?: string;
  notes?: string;
};

export async function sendTaskCreatedEmail({
  to,
  title,
  clientName,
  dueDate,
  notes,
}: TaskCreatedEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TASK_EMAIL_FROM;

  if (!apiKey) throw new Error('RESEND_API_KEY missing');
  if (!from) throw new Error('TASK_EMAIL_FROM missing');
  if (!to) throw new Error('"to" missing');

  const resend = new Resend(apiKey);

  const subject = `New Task${clientName ? ` — ${clientName}` : ''}${title ? ` — ${title}` : ''}`;

  const text = [
    `A new task was created.`,
    ``,
    `Title: ${title || '(No title)'}`,
    `Client: ${clientName || '(No client)'}`,
    `Due: ${dueDate || '(No due date)'}`,
    notes ? `` : undefined,
    notes ? `Notes: ${notes}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await resend.emails.send({
    from,
    to,
    subject,
    text,
  });

  // Resend returns { data, error }
  console.log('RESEND raw result:', result);

  if ((result as any)?.error) {
    throw new Error(`Resend error: ${JSON.stringify((result as any).error)}`);
  }

  console.log('RESEND sent ok:', { to, id: (result as any)?.data?.id });

  return result;
}

