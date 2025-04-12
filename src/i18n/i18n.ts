import i18next from 'i18next';
import * as path from 'path';
import * as fs from 'fs';
import { Config } from '../types/types';

// Loading localizations
const loadLocales = () => {
    const scriptDir = path.dirname(require.main?.filename || __dirname);
    const localesDir = path.resolve(scriptDir, './i18n/locales');

    try {
        // Check if directory exists
        if (!fs.existsSync(localesDir)) {
            console.error(`Localization directory not found: ${localesDir}`);
            return { en: {}, ru: {} };
        }

        // Load all locales from directory
        const locales: Record<string, any> = {};
        const files = fs.readdirSync(localesDir);

        for (const file of files) {
            if (file.endsWith('.json')) {
                const localeName = file.replace('.json', '');
                const filePath = path.join(localesDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                locales[localeName] = { translation: JSON.parse(content) };
            }
        }

        if (Object.keys(locales).length === 0) {
            console.error('No localization files found');
            return { en: {}, ru: {} };
        }

        return locales;
    } catch (error) {
        console.error(`Error loading localizations: ${error}`);
        return { en: {}, ru: {} };
    }
};

// Initialize i18next with default language
i18next.init({
    lng: 'ru', // Default language, will be updated when config is loaded
    fallbackLng: ['en', 'ru'], // Fallback order
    resources: loadLocales(),
    interpolation: {
        escapeValue: false,
    },
});

// Update language based on config
export function setLanguage(config: Config): void {
    if (config.language) {
        i18next.changeLanguage(config.language);
    }
}
