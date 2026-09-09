import * as fs from 'fs';
import i18next from 'i18next';
import { App } from './app';
import { Config } from './types/types';
import { Context } from './domain/context';
import { processLine } from './events';
import { loadUserNames } from './users';

function testLog(key: string, options?: Record<string, unknown>): void {
    console.log(i18next.t(`test.${key}`, options));
}

function printNumbered(headerKey: string, messages: string[]): void {
    testLog(headerKey);
    console.log('='.repeat(51));
    messages.forEach((msg, index) => console.log(`${index + 1}. ${msg}`));
}

/**
 * Replay a whole log file: notifications and log lines are collected
 * instead of being sent, then summarised (and optionally saved).
 */
export async function runTestMode(config: Config): Promise<void> {
    testLog('starting');
    testLog('readingFile', { filename: config.logFile });

    const telegramMessages: string[] = [];
    const logMessages: string[] = [];

    const app: App = {
        config,
        context: new Context(),
        notify: async (message) => {
            telegramMessages.push(message);
            if (config.testVerbose) {
                console.log('📤 [TELEGRAM TEST]:', message);
            }
        },
        log: (message) => {
            logMessages.push(message);
            if (config.testVerbose) {
                console.log('💬 [LOG]:', message);
            }
        },
    };
    loadUserNames(app);

    const lines = fs
        .readFileSync(config.logFile, 'utf8')
        .split('\n')
        .filter((line) => line.trim());

    let processedLines = 0;
    for (const line of lines) {
        await processLine(app, line);
        processedLines++;
        if (processedLines % 100 === 0) {
            testLog('progress', { count: processedLines });
        }
    }

    if (config.testSaveOutput) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (telegramMessages.length > 0) {
            const filename = `test-telegram-messages-${timestamp}.txt`;
            fs.writeFileSync(filename, telegramMessages.join('\n\n'), 'utf8');
            testLog('savedTelegram', { filename });
        }
        if (logMessages.length > 0) {
            const filename = `test-log-messages-${timestamp}.txt`;
            fs.writeFileSync(filename, logMessages.join('\n'), 'utf8');
            testLog('savedLog', { filename });
        }
    }

    testLog('stats');
    testLog('statsLines', { count: processedLines });
    testLog('statsTelegram', { count: telegramMessages.length });
    testLog('statsLog', { count: logMessages.length });

    // Without verbose output the messages are shown once, at the end
    if (!config.testVerbose && (telegramMessages.length || logMessages.length)) {
        testLog('summary');
        if (telegramMessages.length > 0) {
            printNumbered('telegramHeader', telegramMessages);
        }
        if (logMessages.length > 0) {
            printNumbered('logHeader', logMessages);
        }
    }

    testLog('done');
}

export function showTestModeHelp(): void {
    console.log(`
${i18next.t('help.title')}

${i18next.t('help.usage')}

${i18next.t('help.options')}

${i18next.t('help.examples')}

${i18next.t('help.info')}
`);
}
