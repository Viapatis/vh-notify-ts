import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function copyDirectory(source: string, destination: string) {
  // Create destination folder if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Read all items in the source directory
  const items = fs.readdirSync(source);

  // Process each item
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    
    // Check if item is a directory or file
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

async function build() {
  console.log('Building project with esbuild...');
  
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  try {
    // Bundle the application
    await esbuild.build({
      entryPoints: ['src/vh-notify.ts'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/vh-notify.js',
      minify: true,
      sourcemap: false,
      external: [
        // Node built-ins that shouldn't be bundled
        'child_process',
        'fs',
        'path',
        'readline'
      ]
    });
    
    console.log('✓ Bundle created successfully');
    
    // Copy config.json
    if (fs.existsSync('config.json')) {
      fs.copyFileSync('config.json', 'dist/config.json');
      console.log('✓ config.json copied to dist folder');
    } else {
      console.warn('⚠ Warning: config.json not found');
    }

    // Copy users.json
    if (fs.existsSync('users.json')) {
      fs.copyFileSync('users.json', 'dist/users.json');
      console.log('✓ users.json copied to dist folder');
    } else {
      console.warn('⚠ Warning: users.json not found');
    }
        
    
    // Copy locales directory
    const localesDir = path.join('src', 'i18n', 'locales');
    const destLocalesDir = path.join('dist', 'i18n', 'locales');
    
    if (fs.existsSync(localesDir)) {
      await copyDirectory(localesDir, destLocalesDir);
      console.log('✓ Localization files copied to dist folder');
    } else {
      console.warn('⚠ Warning: Localization directory not found');
    }
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run the build process
build(); 
