import * as fs from 'fs';
import * as path from 'path';
import i18next from 'i18next';
import { Config, SinkConfig, SinkType } from './types/types';

const REQUIRED_KEYS: Array<keyof Config> = ['logFile', 'users'];

/** Config of 1.x: a single hardcoded Telegram destination. */
interface LegacyConfig {
    telegramBotToken?: string;
    telegramChatID?: string;
}

/**
 * 1.x configs carried the Telegram credentials at the top level. Turn them into a
 * telegram sink so an existing install keeps working after an upgrade.
 */
function migrateLegacy(config: Partial<Config> & LegacyConfig): void {
    if (config.sinks || !config.telegramBotToken) {
        return;
    }
    config.sinks = [
        {
            type: SinkType.Telegram,
            botToken: config.telegramBotToken,
            chatId: config.telegramChatID ?? '',
        },
    ];
    console.warn(i18next.t('log.legacySinkConfig'));
}

/** Every sink needs its own fields; report all problems at once, not one per restart. */
function validateSinks(sinks: SinkConfig[]): string[] {
    const problems: string[] = [];
    sinks.forEach((sink, index) => {
        const at = `sinks[${index}]`;
        switch (sink.type) {
            case SinkType.Telegram:
                if (!sink.botToken) problems.push(`${at}.botToken`);
                if (!sink.chatId) problems.push(`${at}.chatId`);
                break;
            case SinkType.Webhook:
                if (!sink.url) problems.push(`${at}.url`);
                break;
            default:
                problems.push(`${at}.type=${JSON.stringify((sink as { type?: unknown }).type)}`);
        }
    });
    return problems;
}

/** Load and validate config.json from the directory of the running script. */
export function loadConfig(): Config | null {
    try {
        const scriptDir = path.dirname(require.main?.filename || __dirname);
        const configPath = path.join(scriptDir, 'config.json');

        if (!fs.existsSync(configPath)) {
            throw new Error(i18next.t('log.configNotFound', { filename: configPath }));
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<Config> &
            LegacyConfig;
        migrateLegacy(config);

        const missing = REQUIRED_KEYS.filter((key) => !config[key]);
        if (!Array.isArray(config.sinks) || config.sinks.length === 0) {
            missing.push('sinks');
        }
        if (missing.length > 0) {
            throw new Error(i18next.t('log.configMissing', { keys: missing.join(', ') }));
        }

        const problems = validateSinks(config.sinks as SinkConfig[]);
        if (problems.length > 0) {
            throw new Error(i18next.t('log.configSinkInvalid', { keys: problems.join(', ') }));
        }
        return config as Config;
    } catch (error) {
        console.error(i18next.t('log.configError', { error }));
        return null;
    }
}

type BooleanOption = 'testMode' | 'testVerbose' | 'testSaveOutput';

const FLAGS: Array<[BooleanOption, string[]]> = [
    ['testMode', ['--test', '-t']],
    ['testVerbose', ['--verbose', '-v']],
    ['testSaveOutput', ['--save', '-s']],
];

/** Command line flags switch on the corresponding config options. */
export function applyCliFlags(config: Config, argv: string[]): void {
    for (const [option, aliases] of FLAGS) {
        if (aliases.some((flag) => argv.includes(flag))) {
            config[option] = true;
        }
    }
}

export function isHelpRequested(argv: string[]): boolean {
    return argv.includes('--help') || argv.includes('-h');
}
