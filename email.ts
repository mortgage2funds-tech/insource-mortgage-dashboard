import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type TaskCreatedEmailPayload = {
  title: string;
  clientName?: string;
  dueDate?: string;
  notes?: string;
};

export async function sendTaskCreatedEmail(payload: TaskCreatedEmailPayload) {
  const to = process.env.TASK_EMAIL_TO;
  const from = process.env.TASK_EMAIL_FROM;

  if (!process.env.RESEND_API_KEY || !to || !from) {
    console.warn('Email config missing; skipping task email.');
    return;
  }

  const { title, clientName, dueDate, notes } = payload;

  const subject = `New task: ${title || 'Untitled task'}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; line-height:1.4;">
      <h2>New task created</h2>
      <p><strong>Title:</strong> ${title || '(no title)'}</p>
      ${
        clientName
          ? `<p><strong>Client:</strong> ${clientName}</p>`
          : ''
      }
      ${
        dueDate
          ? `<p><strong>Due date:</strong> ${dueDate}</p>`
          : ''
      }
      ${
        notes
          ? `<p><strong>Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</p>`
          : ''
      }
      <p style="margin-top:16px; font-size:12px; color:#666;">
        This email was sent automatically from the Insource dashboard when a new task was created.
      </p>
    </div>
  `;

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}

