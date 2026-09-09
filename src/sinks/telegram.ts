import axios from 'axios';
import i18next from 'i18next';
import { TelegramSinkConfig } from '../types/types';
import { EventSink, GameEventInput } from './types';

/**
 * Sends the notification text of an event to a Telegram chat. Events without a
 * message (service ones like network trouble) never reach the chat.
 *
 * Deliveries are chained, not parallel: the chat should read in the order things
 * happened in the game.
 */
export function createTelegramSink(config: TelegramSinkConfig, timeout: number): EventSink {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    let chain: Promise<void> = Promise.resolve();

    async function send(message: string): Promise<void> {
        try {
            await axios.post(
                url,
                {
                    chat_id: config.chatId,
                    disable_web_page_preview: 1,
                    text: message,
                },
                { timeout }
            );
            console.log(i18next.t('log.messageSent', { message }));
        } catch (error) {
            console.error(i18next.t('log.sendError', { error }));
        }
    }

    return {
        name: 'telegram',
        publish(event: GameEventInput): void {
            const { message } = event;
            if (!message) {
                return;
            }
            chain = chain.then(() => send(message));
        },
        flush: () => chain,
        stop: () => {},
    };
}
