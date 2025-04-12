import i18next from 'i18next';

export function formatEventMessage(event: string): string {
    const unknown = i18next.t('events.unknown');

    return i18next.t(`events.${event}`, { unknown });
}
