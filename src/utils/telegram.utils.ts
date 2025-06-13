import axios from 'axios';
import { Config } from '../types/types';
import i18next from 'i18next';
/**
 * Send message via Telegram
 */
export async function send({
    message,
    config,
}: {
    message: string;
    config: Config;
}): Promise<void> {
    if (config.testMode) {
        // In test mode we only log what would be sent to Telegram
        console.log('📤 [TELEGRAM TEST]:', message);
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
        await axios.post(
            url,
            {
                chat_id: config.telegramChatID,
                disable_web_page_preview: 1,
                text: message,
            },
            {
                timeout: config.timeout,
            }
        );
        console.log(i18next.t('log.messageSent', { message }));
    } catch (error) {
        console.error(i18next.t('log.sendError', { error }));
    }
}
