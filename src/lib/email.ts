import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type TaskCreatedEmailPayload = {
  to: string;
  title: string;
  clientName?: string;
  dueDate?: string;
  notes?: string;
};

export async function sendTaskCreatedEmail(payload: TaskCreatedEmailPayload) {
  const from = process.env.TASK_EMAIL_FROM;

  if (!process.env.RESEND_API_KEY || !from) {
    console.warn('Email config missing; skipping task email.');
    return;
  }

  const { to, title, clientName, dueDate, notes } = payload;

  if (!to) {
    console.warn('No recipient email; skipping task email.');
    return;
  }

  const subject = `New task: ${title || 'Untitled task'}`;

  const html = `
    <div style="font-family: system-ui; font-size:14px;">
      <h2>New task created</h2>
      <p><strong>Title:</strong> ${title}</p>
      ${clientName ? `<p><strong>Client:</strong> ${clientName}</p>` : ''}
      ${dueDate ? `<p><strong>Due date:</strong> ${dueDate}</p>` : ''}
      ${notes ? `<p><strong>Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</p>` : ''}
    </div>
  `;

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}

