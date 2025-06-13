#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as child_process from 'child_process';
import { getEvents } from './events';
import { Config, Context } from './types/types';
import { loadNames } from './utils/user.utils';
import { runTestMode, showTestModeHelp } from './utils/test.utils';
import i18next from 'i18next';
import { setLanguage } from './i18n/i18n';

// Loading config from file
function loadConfig(): Config | null {
    try {
        // Try to find configuration in several possible locations
        const scriptDir = path.dirname(require.main?.filename || __dirname);

        if (!scriptDir) {
            throw new Error('Could not determine script directory.');
        }

        const configPath = path.join(scriptDir, 'config.json');

        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }

        const configData = fs.readFileSync(configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        return loadedConfig as Config;
    } catch (error) {
        console.error('Error loading configuration:', error);
        return null;
    }
}

function initContext(config: Config): Context {
    const context: Context = {
        userNamesBySteamID: {},
        ZDOIDBySteamID: {},
        charNamesByZDOID: {},
        playerConnectionIDBySteamID: {},
        playerStates: {},
        connectionIDsWithNetworkTrouble: new Set<string>(),
        valheimVersion: 'Not set',
        connectFlag: false,
        disconnectEvent: false,
        disconnectingChar: null,
        disconnectingZdoId: null,
        currentSteamId: null,
    };

    loadNames({ context, config });

    return context;
}

/**
 * Process log line
 */
async function processLine(
    line: string,
    context: Context,
    config: Config
): Promise<void> {
    const events = getEvents(line);
    if (!events.length) {
        return;
    }

    for(const event of events){
       await event.process({
            context,
            line,
            config,
        })
    }
    
}

/**
 * Main function
 */
async function main(): Promise<void> {
    // Check for help request
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showTestModeHelp();
        process.exit(0);
    }

    const config = loadConfig();
    if (!config) {
        console.error(
            i18next.t('log.criticalError', {
                error: 'Configuration not loaded',
            })
        );
        process.exit(1);
    }

    // Check command line arguments for test mode
    if (process.argv.includes('--test') || process.argv.includes('-t')) {
        config.testMode = true;
    }

    // Check additional test mode flags
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
        config.testVerbose = true;
    }

    if (process.argv.includes('--save') || process.argv.includes('-s')) {
        config.testSaveOutput = true;
    }

    // Set language from config
    setLanguage(config);

    const context = initContext(config);
    try {
        console.log(
            config.testMode
                ? i18next.t('log.startingAppTest')
                : i18next.t('log.startingApp')
        );

        // Check if log file exists
        if (!fs.existsSync(config.logFile)) {
            console.error(
                i18next.t('log.logFileError', {
                    filename: config.logFile,
                })
            );
            return;
        }

        // If test mode is enabled, run it
        if (config.testMode) {
            await runTestMode(config, context);
            return;
        }

        // Run tail -f to read logs
        const tail = child_process.spawn('tail', [
            '-F',
            '-n',
            '0',
            config.logFile,
        ]);

        // Create interface for reading lines from tail's stdout
        const rl = readline.createInterface({
            input: tail.stdout,
            crlfDelay: Infinity,
        });

        // Process each log line
        rl.on('line', async (line: string) => {
            await processLine(line, context, config);
        });

        // Handle errors
        tail.stderr.on('data', (data: unknown) => {
            console.error(i18next.t('log.tailError', { data: String(data) }));
        });

        // Handle tail process termination
        tail.on('close', (code: number) => {
            console.log(i18next.t('log.tailClosed', { code }));
        });

        // Capture termination signals for proper shutdown
        process.on('SIGINT', () => {
            console.log(i18next.t('log.shuttingDown'));
            tail.kill();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log(i18next.t('log.shuttingDown'));
            tail.kill();
            process.exit(0);
        });
    } catch (error) {
        console.error(i18next.t('log.criticalError', { error }));
    }
}

// Run script
main().catch((err) => {
    console.error(i18next.t('log.unexpectedError', { error: err }));
    process.exit(1);
});
