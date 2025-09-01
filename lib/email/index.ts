import nodemailer from "nodemailer";
import {
  WelcomeEmailProps,
  getWelcomeEmailTemplate,
} from "./templates/welcome";
import {
  TeamInviteEmailProps,
  getTeamInviteEmailTemplate,
} from "./templates/team-invite";
import {
  ResetPasswordEmailProps,
  getResetPasswordEmailTemplate,
} from "./templates/reset-password";
import {
  TaskAssignmentEmailProps,
  getTaskAssignmentEmailTemplate,
} from "./templates/task-assignment";
import {
  TaskCompletionEmailProps,
  getTaskCompletionEmailTemplate,
} from "./templates/task-completion";
import {
  CheckinNotificationEmailProps,
  getCheckinNotificationEmailTemplate,
} from "./templates/checkin-notification";
import {
  NewTaskEmailProps,
  getNewTaskEmailTemplate,
} from "./templates/new-task";
import { env } from "@/lib/env";

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  name: "Maravian CheckList",
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export class EmailService {
  private static async sendEmail(to: string, subject: string, html: string) {
    try {
      const mailOptions = {
        from: { address: env.SMTP_FROM, name: env.NEXT_PUBLIC_NAME },
        to,
        subject,
        html,
      };

      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }
  }

  public static async sendWelcomeEmail(to: string, props: WelcomeEmailProps) {
    const template = getWelcomeEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }

  public static async sendTeamInviteEmail(
    to: string,
    props: TeamInviteEmailProps
  ) {
    const template = getTeamInviteEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }

  public static async sendPasswordResetEmail(
    to: string,
    props: ResetPasswordEmailProps
  ) {
    const template = getResetPasswordEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }

  public static async sendTaskAssignmentEmail(
    to: string,
    props: TaskAssignmentEmailProps
  ) {
    const template = getTaskAssignmentEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }

  public static async sendTaskCompletionEmail(
    to: string,
    props: TaskCompletionEmailProps
  ) {
    const template = getTaskCompletionEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }

  public static async sendCheckinNotificationEmail(
    to: string,
    props: CheckinNotificationEmailProps
  ) {
    const template = getCheckinNotificationEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }

  public static async sendNewTaskEmail(to: string, props: NewTaskEmailProps) {
    const template = getNewTaskEmailTemplate(props);
    await this.sendEmail(to, template.subject, template.html);
  }
}
