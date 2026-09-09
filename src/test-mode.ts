import * as fs from 'fs';
import * as path from 'path';
import i18next from 'i18next';
import { App } from './app';
import { createGameEvent } from './sinks';
import { GameEventInput } from './sinks';
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

function countByType(events: GameEventInput[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const { type } of events) {
        counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
}

/** One line per notification-worthy event: "[type] message" */
function describeMessage(event: GameEventInput): string {
    return `[${event.type}] ${event.message}`;
}

/**
 * Replay a whole log file: events and log lines are collected instead of
 * being sent, then summarised (and optionally saved). Nothing is sent to
 * any sink here.
 */
export async function runTestMode(config: Config): Promise<void> {
    testLog('starting');
    testLog('readingFile', { filename: config.logFile });

    const published: GameEventInput[] = [];
    const logMessages: string[] = [];

    const app: App = {
        config,
        context: new Context(),
        publish: (input) => {
            const event = createGameEvent(input);
            published.push(event);
            if (config.testVerbose) {
                console.log('📤 [EVENT]:', JSON.stringify(event));
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

    const withMessages = published.filter((event) => event.message !== undefined);

    if (config.testSaveOutput) {
        // Artifacts land next to the log copy being replayed
        const outDir = path.dirname(config.logFile);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (published.length > 0) {
            const filename = path.join(outDir, `test-events-${timestamp}.json`);
            fs.writeFileSync(filename, JSON.stringify(published, null, 2), 'utf8');
            testLog('eventsSaved', { filename });
        }
        if (logMessages.length > 0) {
            const filename = path.join(outDir, `test-log-messages-${timestamp}.txt`);
            fs.writeFileSync(filename, logMessages.join('\n'), 'utf8');
            testLog('savedLog', { filename });
        }
    }

    testLog('stats');
    testLog('statsLines', { count: processedLines });
    testLog('statsEvents', { count: published.length });
    testLog('statsMessages', { count: withMessages.length });
    testLog('statsLog', { count: logMessages.length });
    if (published.length > 0) {
        testLog('statsByType');
        for (const [type, count] of Object.entries(countByType(published))) {
            console.log(`      ${type}: ${count}`);
        }
    }

    // Without verbose output the messages are shown once, at the end
    if (!config.testVerbose && (withMessages.length || logMessages.length)) {
        testLog('summary');
        if (withMessages.length > 0) {
            printNumbered('messagesHeader', withMessages.map(describeMessage));
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
