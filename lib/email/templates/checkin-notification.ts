export interface CheckinNotificationEmailProps {
  recipientName: string;
  checkedInUserName: string;
  teamName: string;
  teamSlug: string;
  appUrl: string;
  notes?: string;
}

export function getCheckinNotificationEmailTemplate(
  props: CheckinNotificationEmailProps
) {
  const {
    recipientName,
    checkedInUserName,
    teamName,
    teamSlug,
    appUrl,
    notes,
  } = props;

  const subject = `${checkedInUserName} checked in to ${teamName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #17a2b8; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Team Check-in 📋</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName},</p>
          <p><strong>${checkedInUserName}</strong> just checked in to the <strong>${teamName}</strong> team.</p>
          ${
            notes
              ? `
          <blockquote style="padding: 15px; background: #e7f3ff; border-left: 4px solid #17a2b8; margin: 20px 0;">
            <strong>Check-in Notes:</strong><br>
            ${notes}
          </blockquote>
          `
              : ""
          }
          <a href="${appUrl}/team/${teamSlug}" class="button">View Team Activity</a>
          <p>Stay connected with your team's daily progress!</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Maravian CheckList Team</p>
          <p><small>You received this email because you have notifications enabled for check-ins. You can manage your notification preferences in your account settings.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
