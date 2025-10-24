import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getUser } from '@/lib/db/queries';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, problem, satisfaction, improvement, nps } = body;

    if (!problem || satisfaction === null || !improvement || nps === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const feedbackEmail = process.env.FEEDBACK_EMAIL || process.env.SUPPORT_EMAIL || 'feedback@yourdomain.com';

    // Determine NPS category
    let npsCategory = 'Detractor';
    if (nps >= 9) npsCategory = 'Promoter';
    else if (nps >= 7) npsCategory = 'Passive';

    // Send email to feedback address
    const { data, error } = await resend.emails.send({
      from: 'Alerta Feedback <onboarding@resend.dev>',
      to: feedbackEmail,
      replyTo: email,
      subject: `[Feedback] NPS: ${nps} - ${npsCategory}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Feedback Received</h2>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>From:</strong> ${email}</p>
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 10px;">What problem were you trying to solve?</h3>
            <p style="white-space: pre-wrap; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">${problem}</p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 10px;">How well did Alerta solve that problem?</h3>
            <p style="font-size: 24px; font-weight: bold; color: ${satisfaction >= 4 ? '#22c55e' : satisfaction >= 3 ? '#eab308' : '#ef4444'};">
              ${satisfaction} / 5
            </p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 10px;">What's the ONE thing we should improve first?</h3>
            <p style="white-space: pre-wrap; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">${improvement}</p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 10px;">Net Promoter Score (NPS)</h3>
            <p style="font-size: 24px; font-weight: bold; color: ${nps >= 9 ? '#22c55e' : nps >= 7 ? '#eab308' : '#ef4444'};">
              ${nps} / 10 - ${npsCategory}
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 14px;">
            This feedback was submitted via the Alerta feedback form.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
