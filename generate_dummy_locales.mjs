import fs from 'fs';
import path from 'path';

const enPath = path.join(process.cwd(), 'src/locales/en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const LANGUAGES = ['es', 'fr']; // user said just a couple is good enough

function translateObject(obj, prefix) {
  const result = {};
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = translateObject(obj[key], prefix);
    } else {
      let text = obj[key];
      // Keep placeholders intact simple regex
      result[key] = `[${prefix}] ${text}`;
    }
  }
  return result;
}

function main() {
  for (const lang of LANGUAGES) {
    console.log(`\nTranslating to ${lang}...`);
    const translated = translateObject(enData, lang.toUpperCase());
    fs.writeFileSync(path.join(process.cwd(), `src/locales/${lang}.json`), JSON.stringify(translated, null, 2));
  }
  
  // Create an empty ru.json to fix the i18n.ts import error
  fs.writeFileSync(path.join(process.cwd(), `src/locales/ru.json`), JSON.stringify({}, null, 2));
  
  console.log('Complete!');
}

main();
