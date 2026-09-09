#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as readline from 'readline';
import * as child_process from 'child_process';
import i18next from 'i18next';
import { App } from './app';
import { createPublisher, createSinks } from './sinks';
import { applyCliFlags, isHelpRequested, loadConfig } from './cli';
import { Context } from './domain/context';
import { processLine } from './events';
import { setLanguage } from './i18n/i18n';
import { runTestMode, showTestModeHelp } from './test-mode';
import { loadUserNames } from './users';
import { Config } from './types/types';

/** How long a shutdown waits for the queued events to reach their sinks */
const SHUTDOWN_FLUSH_MS = 5000;

/** Follow the server log with `tail -F` and feed every new line to the event handlers. */
function watchLog(config: Config): void {
    const sinks = createSinks(config);
    console.log(i18next.t('log.sinksReady', { sinks: sinks.map((s) => s.name).join(', ') }));
    const publisher = createPublisher(sinks);
    const app: App = {
        config,
        context: new Context(),
        publish: publisher.publish,
        log: (message) => console.log(message),
    };
    loadUserNames(app);

    const tail = child_process.spawn('tail', ['-F', '-n', '0', config.logFile]);

    const rl = readline.createInterface({
        input: tail.stdout,
        crlfDelay: Infinity,
    });
    rl.on('line', (line: string) => {
        processLine(app, line).catch((error) => {
            console.error(i18next.t('log.unexpectedError', { error }));
        });
    });

    tail.stderr.on('data', (data: unknown) => {
        console.error(i18next.t('log.tailError', { data: String(data) }));
    });
    tail.on('close', (code: number) => {
        console.log(i18next.t('log.tailClosed', { code }));
    });

    let shuttingDown = false;
    const shutdown = async () => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.log(i18next.t('log.shuttingDown'));
        tail.kill();
        publisher.stop();
        // Give the queued events one last chance, but never hang the exit
        await Promise.race([
            publisher.flush(),
            new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_FLUSH_MS)),
        ]);
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
    if (isHelpRequested(process.argv)) {
        showTestModeHelp();
        process.exit(0);
    }

    const config = loadConfig();
    if (!config) {
        console.error(
            i18next.t('log.criticalError', { error: 'Configuration not loaded' })
        );
        process.exit(1);
    }
    applyCliFlags(config, process.argv);
    setLanguage(config);

    console.log(
        config.testMode
            ? i18next.t('log.startingAppTest')
            : i18next.t('log.startingApp')
    );

    if (!fs.existsSync(config.logFile)) {
        console.error(i18next.t('log.logFileError', { filename: config.logFile }));
        return;
    }

    if (config.testMode) {
        await runTestMode(config);
        return;
    }
    watchLog(config);
}

main().catch((err) => {
    console.error(i18next.t('log.unexpectedError', { error: err }));
    process.exit(1);
});
