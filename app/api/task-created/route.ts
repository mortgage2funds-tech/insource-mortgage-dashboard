import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, title, clientName, dueDate, notes } = body || {};

    // 1️⃣ Validate recipient
    if (!to) {
      console.error('API task-created: missing recipient email');
      return NextResponse.json(
        { ok: false, error: 'missing_to' },
        { status: 400 }
      );
    }

    // 2️⃣ Validate email environment (FAIL LOUDLY)
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.TASK_EMAIL_FROM;

    console.log('TASK-CREATED hit:', {
      to,
      title,
      hasResendKey: !!resendKey,
      hasFrom: !!from,
    });

    if (!resendKey || !from) {
      console.error('API task-created: missing email env vars');
      return NextResponse.json(
        { ok: false, error: 'missing_email_env' },
        { status: 500 }
      );
    }

    // 3️⃣ Lazy import to avoid build-time crashes
    const { sendTaskCreatedEmail } = await import('@/lib/email');

    // 4️⃣ Attempt send (catch failures explicitly)
    try {
      await sendTaskCreatedEmail({
        to,
        title,
        clientName,
        dueDate,
        notes,
      });
    } catch (sendErr) {
      console.error('TASK-CREATED send failed:', sendErr);
      return NextResponse.json(
        { ok: false, error: 'send_failed' },
        { status: 500 }
      );
    }

    // 5️⃣ Success
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('task-created API fatal error', err);
    return NextResponse.json(
      { ok: false, error: 'internal_error' },
      { status: 500 }
    );
  }
}

