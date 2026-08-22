import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(to: string, firstName: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your email — DailyBasket',
      html: `<p>Hi ${firstName},</p><p>Confirm your email to activate your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
    });
  }

  async sendPasswordResetEmail(to: string, firstName: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your password — DailyBasket',
      html: `<p>Hi ${firstName},</p><p>Reset your password using the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`
    });
  }

  private async send(message: { to: string; subject: string; html: string }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(`RESEND_API_KEY not set — logging email instead of sending.\nTo: ${message.to}\nSubject: ${message.subject}\n${message.html}`);
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'DailyBasket <onboarding@resend.dev>',
        to: message.to,
        subject: message.subject,
        html: message.html
      })
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Resend email failed (${response.status}): ${body}`);
    }
  }
}
