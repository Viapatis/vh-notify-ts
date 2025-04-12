#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as child_process from 'child_process';
import { getEvent } from './events';
import { Config, Context } from './types/types';
import { loadNames } from './utils/user.utils';
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
        userNames: {},
        playerZdoIds: {},
        zdoIdNames: {},
        playerStates: {},
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
    const event = getEvent(line);
    if (!event) {
        return;
    }
    await event.process({
        context,
        line,
        config,
    });
}

/**
 * Main function
 */
async function main(): Promise<void> {
    const config = loadConfig();
    if (!config) {
        console.error(
            i18next.t('log.criticalError', {
                error: 'Configuration not loaded',
            })
        );
        process.exit(1);
    }
    
    // Set language from config
    setLanguage(config);
    
    const context = initContext(config);
    try {
        console.log(i18next.t('log.startingApp'));

        // Check if log file exists
        if (!fs.existsSync(config.logFile)) {
            console.error(
                i18next.t('log.logFileError', {
                    filename: config.logFile,
                })
            );
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
            console.error(
                i18next.t('log.tailError', { data: String(data) })
            );
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
