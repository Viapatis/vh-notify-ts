import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types/types';

/** Load config.json from the directory of the running script. */
export function loadConfig(): Config | null {
    try {
        const scriptDir = path.dirname(require.main?.filename || __dirname);
        const configPath = path.join(scriptDir, 'config.json');

        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }

        return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Config;
    } catch (error) {
        console.error('Error loading configuration:', error);
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
