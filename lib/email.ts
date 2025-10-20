import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTeamInvitationEmail({
  to,
  inviterName,
  teamName,
  invitationUrl,
}: {
  to: string;
  inviterName: string;
  teamName: string;
  invitationUrl: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Alerta <noreply@vibebench.io>',
      to: [to],
      subject: `You've been invited to join ${teamName} on Alerta`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
                You've been invited to join ${teamName}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280;">
                ${inviterName} has invited you to join their team on Alerta.
              </p>
              <a href="${invitationUrl}" style="display: inline-block; background-color: #ff4f00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <div style="font-size: 14px; color: #6b7280;">
              <p style="margin: 0 0 8px 0;">
                This invitation will expire in 7 days.
              </p>
              <p style="margin: 0;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending invitation email:', error);
      return { error };
    }

    return { data };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return { error };
  }
}
