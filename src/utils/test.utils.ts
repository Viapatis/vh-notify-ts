import * as fs from 'fs';
import { Config, Context } from '../types/types';
import { getEvents } from '../events';
import i18next from 'i18next';

/**
 * Process log line in test mode
 */
async function processLine(
    line: string,
    context: Context,
    config: Config
): Promise<void> {
    const events = getEvents(line);
    if (events.length === 0) {
        return;
    }
    
    // Process all matching events for this line
    for (const event of events) {
        await event.process({
            context,
            line,
            config,
        });
    }
}

/**
 * Process file in test mode
 */
export async function runTestMode(config: Config, context: Context): Promise<void> {
    console.log('🧪 [TEST MODE] Запуск тестового режима...');
    console.log('📁 [TEST MODE] Читаем файл:', config.logFile);
    
    const fileContent = fs.readFileSync(config.logFile, 'utf8');
    const lines = fileContent.split('\n');
    
    let telegramMessageCount = 0;
    let logMessageCount = 0;
    let processedLines = 0;
    
    // Arrays for collecting messages
    const telegramMessages: string[] = [];
    const logMessages: string[] = [];
    
    // Intercept console.log for counting and collecting messages
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('[TELEGRAM TEST]')) {
            telegramMessageCount++;
            const cleanMessage = message.replace('📤 [TELEGRAM TEST]:', '').trim();
            telegramMessages.push(cleanMessage);
            
            if (config.testVerbose) {
                originalConsoleLog(message);
            }
        } else if (!message.includes('[TEST MODE]')) {
            logMessageCount++;
            logMessages.push(message);
            
            if (config.testVerbose) {
                originalConsoleLog('💬 [LOG]:', message);
            }
        } else {
            // Always show TEST MODE messages
            originalConsoleLog(message);
        }
    };
    
    for (const line of lines) {
        if (line.trim()) {
            await processLine(line, context, config);
            processedLines++;
            
            // Show progress every 100 lines
            if (processedLines % 100 === 0) {
                originalConsoleLog(`🔄 [TEST MODE] Обработано строк: ${processedLines}`);
            }
        }
    }
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Save messages to files if option is enabled
    if (config.testSaveOutput) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        if (telegramMessages.length > 0) {
            const telegramFile = `test-telegram-messages-${timestamp}.txt`;
            fs.writeFileSync(telegramFile, telegramMessages.join('\n\n'), 'utf8');
            console.log(`💾 [TEST MODE] Telegram сообщения сохранены в: ${telegramFile}`);
        }
        
        if (logMessages.length > 0) {
            const logFile = `test-log-messages-${timestamp}.txt`;
            fs.writeFileSync(logFile, logMessages.join('\n'), 'utf8');
            console.log(`💾 [TEST MODE] Лог сообщения сохранены в: ${logFile}`);
        }
    }
    
    // Show statistics
    console.log('📊 [TEST MODE] Статистика:');
    console.log(`   📋 Обработано строк: ${processedLines}`);
    console.log(`   📤 Telegram сообщений: ${telegramMessageCount}`);
    console.log(`   💬 Лог сообщений: ${logMessageCount}`);
    
    // Show all messages in console if not verbose mode
    if (!config.testVerbose && (telegramMessages.length > 0 || logMessages.length > 0)) {
        console.log('\n📋 [TEST MODE] Сводка сообщений:');
        
        if (telegramMessages.length > 0) {
            console.log('\n📤 [TELEGRAM MESSAGES]:');
            console.log('=' + '='.repeat(50));
            telegramMessages.forEach((msg, index) => {
                console.log(`${index + 1}. ${msg}`);
            });
        }
        
        if (logMessages.length > 0) {
            console.log('\n💬 [LOG MESSAGES]:');
            console.log('=' + '='.repeat(50));
            logMessages.forEach((msg, index) => {
                console.log(`${index + 1}. ${msg}`);
            });
        }
    }
    
    console.log('\n✅ [TEST MODE] Тестирование завершено');
}

/**
 * Show help for test mode
 */
export function showTestModeHelp(): void {
    console.log(`
${i18next.t('help.title')}

${i18next.t('help.usage')}

${i18next.t('help.options')}

${i18next.t('help.examples')}

${i18next.t('help.info')}
`);
} 
