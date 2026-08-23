import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendService } from 'nestjs-resend';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface ResendEmailSender {
  send(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<{
    error: { name: string; message: string } | null;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly resendService: ResendService,
  ) {}

  private async send(message: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const apiKey = this.configService.get<string>('resend.apiKey');

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — logging email instead of sending.\n` +
          `To: ${message.to}\n` +
          `Subject: ${message.subject}\n` +
          `${message.html}`,
      );

      return;
    }

    const fromEmail = this.configService.getOrThrow<string>('resend.fromEmail');

    const resendEmailSender = this
      .resendService as unknown as ResendEmailSender;
    const { error } = await resendEmailSender.send({
      from: fromEmail,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    if (error) {
      this.logger.error(
        `Resend email failed (${error.name}): ${error.message}`,
      );
    }
  }

  async sendVerificationEmail(
    to: string,
    firstName: string,
    verifyUrl: string,
  ): Promise<void> {
    const safeName = escapeHtml(firstName);

    await this.send({
      to,
      subject: 'Verify your email — DailyBasket',
      html: `
        <p>Hi ${safeName},</p>
        <p>Confirm your email to activate your account:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetUrl: string,
  ): Promise<void> {
    const safeName = escapeHtml(firstName);

    await this.send({
      to,
      subject: 'Reset your password — DailyBasket',
      html: `
        <p>Hi ${safeName},</p>
        <p>Reset your password using the link below:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>
          This link expires in 1 hour.
          If you didn't request this, ignore this email.
        </p>
      `,
    });
  }
}
