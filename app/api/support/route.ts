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
    const { email, title, message, context, attachments = [] } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    interface Attachment {
      name: string;
      base64: string;
    }

    // Build attachments array for Resend
    const emailAttachments = (attachments as Attachment[]).map((file) => ({
      filename: file.name,
      content: file.base64.split(',')[1], // Remove data:image/xxx;base64, prefix
    }));

    // Build HTML with inline images
    let attachmentsHtml = '';
    if (attachments.length > 0) {
      attachmentsHtml = `
        <hr>
        <h3>Attachments:</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${(attachments as Attachment[]).map((file) => `
            <div style="border: 1px solid #ddd; padding: 10px; border-radius: 8px;">
              <img src="${file.base64}" alt="${file.name}" style="max-width: 200px; max-height: 200px; display: block; margin-bottom: 5px;" />
              <p style="margin: 0; font-size: 12px; color: #666;">${file.name}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    const supportEmail = process.env.SUPPORT_EMAIL || 'support@yourdomain.com';

    // 1. Send email to support team with full details
    const { data: supportData, error: supportError } = await resend.emails.send({
      from: 'Alerta Support <onboarding@resend.dev>',
      to: supportEmail,
      replyTo: email,
      subject: `[Support] ${title}`,
      html: `
        <h2>New Support Request</h2>
        <p><strong>From:</strong> ${email}</p>
        <p><strong>User ID:</strong> ${user.id}</p>
        <p><strong>Title:</strong> ${title}</p>
        
        <h3>Message:</h3>
        <p>${message.replace(/\n/g, '<br>')}</p>
        
        ${attachmentsHtml}
        
        <hr>
        <h3>Context:</h3>
        <ul>
          <li><strong>URL:</strong> ${context.url}</li>
          <li><strong>User Agent:</strong> ${context.userAgent}</li>
          <li><strong>Timestamp:</strong> ${context.timestamp}</li>
        </ul>
      `,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    if (supportError) {
      console.error('Failed to send support email:', supportError);
      return NextResponse.json({ error: 'Failed to send support email' }, { status: 500 });
    }

    // 2. Send confirmation email to user
    const ticketId = supportData?.id || `TICKET-${Date.now()}`;
    const { error: confirmError } = await resend.emails.send({
      from: 'Alerta Support <onboarding@resend.dev>',
      to: email,
      subject: `Support Request Received: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Support Request Received</h2>
          
          <p>Hi there,</p>
          
          <p>We've received your support request and our team will get back to you as soon as possible.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #666;">Ticket Summary</h3>
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
            <p><strong>Subject:</strong> ${title}</p>
            <p><strong>Submitted:</strong> ${new Date(context.timestamp).toLocaleString()}</p>
            
            <h4 style="color: #666; margin-bottom: 10px;">Your Message:</h4>
            <p style="white-space: pre-wrap;">${message}</p>
            
            ${attachments.length > 0 ? `
              <p style="margin-top: 15px;"><strong>Attachments:</strong> ${attachments.length} image(s)</p>
            ` : ''}
          </div>
          
          <p>We typically respond within 24 hours during business days. If your issue is urgent, please reply to this email with "URGENT" in the subject line.</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Best regards,<br>
            The Alerta Support Team
          </p>
        </div>
      `,
    });

    if (confirmError) {
      console.error('Failed to send confirmation email:', confirmError);
      // Don't fail the request if confirmation email fails
    }

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    console.error('Support request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
