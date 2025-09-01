export interface TaskCompletionEmailProps {
  recipientName: string;
  completedByName: string;
  taskTitle: string;
  teamName: string;
  teamSlug: string;
  appUrl: string;
}

export function getTaskCompletionEmailTemplate(
  props: TaskCompletionEmailProps
) {
  const {
    recipientName,
    completedByName,
    taskTitle,
    teamName,
    teamSlug,
    appUrl,
  } = props;

  const subject = `Task Completed in ${teamName}`;

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
        .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Task Completed ✅</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName},</p>
          <p><strong>${completedByName}</strong> has completed a task in the <strong>${teamName}</strong> team:</p>
          <blockquote style="padding: 15px; background: #d4edda; border-left: 4px solid #28a745; margin: 20px 0;">
            <strong>${taskTitle}</strong>
          </blockquote>
          <a href="${appUrl}/team/${teamSlug}" class="button">View Team Progress</a>
          <p>Great job on the team progress!</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Maravian CheckList Team</p>
          <p><small>You received this email because you have notifications enabled for task completions. You can manage your notification preferences in your account settings.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
