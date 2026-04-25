import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured() {
    const provider = this.provider;
    if (provider === 'SMTP') {
      return Boolean(
        this.config.get<string>('SMTP_HOST') &&
          this.config.get<string>('SMTP_PORT') &&
          this.config.get<string>('SMTP_USER') &&
          this.config.get<string>('SMTP_PASS') &&
          this.config.get<string>('MAIL_FROM_ADDRESS'),
      );
    }

    if (provider === 'RESEND') {
      return Boolean(
        this.config.get<string>('RESEND_API_KEY') &&
          this.config.get<string>('MAIL_FROM_ADDRESS'),
      );
    }

    return false;
  }

  private get provider() {
    return (this.config.get<string>('MAIL_PROVIDER') ?? 'RESEND').toUpperCase();
  }

  async sendMail(payload: MailPayload) {
    if (!this.isConfigured) {
      this.logger.warn(
        `Email delivery skipped for ${payload.to}. Configure MAIL_PROVIDER plus the selected provider credentials.`,
      );
      return { delivered: false, reason: 'MAIL_NOT_CONFIGURED' };
    }

    if (this.provider === 'SMTP') {
      return this.sendWithSmtp(payload);
    }

    return this.sendWithResend(payload);
  }

  private async sendWithResend(payload: MailPayload) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get<string>('MAIL_FROM_ADDRESS'),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      this.logger.error(`Resend email delivery failed: ${details}`);
      return { delivered: false, reason: 'MAIL_REQUEST_FAILED', details };
    }

    return { delivered: true, provider: 'RESEND' };
  }

  private async sendWithSmtp(payload: MailPayload) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT')),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      await transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM_ADDRESS'),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      return { delivered: true, provider: 'SMTP' };
    } catch (error) {
      this.logger.error(`SMTP email delivery failed: ${String(error)}`);
      return { delivered: false, reason: 'SMTP_DELIVERY_FAILED' };
    }
  }
}
