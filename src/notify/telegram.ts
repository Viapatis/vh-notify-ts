import axios from 'axios';
import i18next from 'i18next';
import { Notify } from '../app';
import { Config } from '../types/types';

export function createTelegramNotifier(config: Config): Notify {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;

    return async (message: string): Promise<void> => {
        try {
            await axios.post(
                url,
                {
                    chat_id: config.telegramChatID,
                    disable_web_page_preview: 1,
                    text: message,
                },
                { timeout: config.timeout }
            );
            console.log(i18next.t('log.messageSent', { message }));
        } catch (error) {
            console.error(i18next.t('log.sendError', { error }));
        }
    };
}
