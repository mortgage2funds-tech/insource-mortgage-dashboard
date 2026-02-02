import { NextRequest, NextResponse } from 'next/server';
import { sendTaskCreatedEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, title, clientName, dueDate, notes } = body || {};

    if (!to) {
      console.error('API task-created: missing recipient email');
      return NextResponse.json(
        { ok: false, error: 'missing_to' },
        { status: 400 }
      );
    }

    await sendTaskCreatedEmail({
      to,
      title,
      clientName,
      dueDate,
      notes,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('task-created API error', err);
    return NextResponse.json(
      { ok: false, error: 'internal_error' },
      { status: 500 }
    );
  }
}

