import fs from 'fs';
import path from 'path';
import translate from 'google-translate-api-x';

const enPath = path.join(process.cwd(), 'src/locales/en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const LANGUAGES = ['es', 'fr', 'de', 'zh', 'hi', 'ar', 'ja', 'ru'];

async function translateObject(obj, lang) {
  const result = {};
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = await translateObject(obj[key], lang);
    } else {
      // Avoid translating interpolation placeholders like {{variable}}
      // Actually google translate might mess up {{variable}} so let's handle it
      let text = obj[key];
      try {
        const res = await translate(text, { to: lang });
        result[key] = res.text.replace(/\{\s*\{\s*(.*?)\s*\}\s*\}/g, '{{$1}}'); // fix spacing inside brackets if any
        console.log(`[${lang}] ${text} -> ${result[key]}`);
      } catch(e) {
        console.error("Error translating:", text, e);
        result[key] = text;
      }
    }
  }
  return result;
}

async function main() {
  for (const lang of LANGUAGES) {
    console.log(`\nTranslating to ${lang}...`);
    const translated = await translateObject(enData, lang);
    fs.writeFileSync(path.join(process.cwd(), `src/locales/${lang}.json`), JSON.stringify(translated, null, 2));
  }
  console.log('Complete!');
}

main();
