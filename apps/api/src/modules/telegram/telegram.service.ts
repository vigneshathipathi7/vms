import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;

  async sendMessage(message: string) {
    if (!this.token || !this.chatId) {
      this.logger.warn('Telegram config missing');
      return;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
        },
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      this.logger.error(
        'Telegram message failed',
        err?.response?.data || err?.message,
      );
    }
  }

  async sendAccessRequestAlert(data: {
    fullName: string;
    phone: string;
    email: string;
    electionType: string;
    district: string;
    constituency?: string | null;
    taluk?: string | null;
    partyName: string;
  }) {
    const message = `
<b>🚀 New VMS Signup Request</b>

<b>Name:</b> ${data.fullName}
<b>Phone:</b> ${data.phone}
<b>Email:</b> ${data.email}
<b>Election Type:</b> ${data.electionType}
<b>District:</b> ${data.district}
<b>Constituency/Taluk:</b> ${data.constituency || data.taluk || '-'}
<b>Party:</b> ${data.partyName}

⚠ Please review in Admin Panel.
`;

    await this.sendMessage(message);
  }
}
