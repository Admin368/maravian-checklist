export interface NewTaskEmailProps {
  recipientName: string;
  createdByName: string;
  taskTitle: string;
  teamName: string;
  teamSlug: string;
  appUrl: string;
  taskType: string;
}

export function getNewTaskEmailTemplate(props: NewTaskEmailProps) {
  const {
    recipientName,
    createdByName,
    taskTitle,
    teamName,
    teamSlug,
    appUrl,
    taskType,
  } = props;

  const subject = `New ${
    taskType === "checklist" ? "Checklist Item" : "Task"
  } in ${teamName}`;

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
        .button { display: inline-block; padding: 12px 24px; background: #6f42c1; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New ${
            taskType === "checklist" ? "Checklist Item" : "Task"
          } ✨</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName},</p>
          <p><strong>${createdByName}</strong> has created a new ${
    taskType === "checklist" ? "checklist item" : "task"
  } in the <strong>${teamName}</strong> team:</p>
          <blockquote style="padding: 15px; background: #f3e5f5; border-left: 4px solid #6f42c1; margin: 20px 0;">
            <strong>${taskTitle}</strong>
          </blockquote>
          <a href="${appUrl}/team/${teamSlug}" class="button">View ${
    taskType === "checklist" ? "Checklist" : "Task"
  }</a>
          <p>Check it out and start collaborating with your team!</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Maravian CheckList Team</p>
          <p><small>You received this email because you have notifications enabled for new tasks. You can manage your notification preferences in your account settings.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
