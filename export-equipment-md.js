#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outputDir = path.join(rootDir, 'output', '3');

const categories = [
  { name: 'weapon', label: '武器', tag: 'weapons', files: ['weapon_name.xml', 'weapon_desc.xml'] },
  { name: 'armor',  label: '防具', tag: 'armor',   files: ['armor_name.xml', 'armor_desc.xml'] },
  { name: 'magic',  label: '魔法', tag: 'magic',   files: ['magic_name.xml', 'magic_desc.xml'] },
  { name: 'ring',   label: '指輪', tag: 'rings',   files: ['ring_name.xml', 'ring_desc.xml'] },
];

function extractTextEntries(xml) {
  const map = {};
  const regex = /<text(?:\s+id="([^"]+)")?>([\s\S]*?)<\/text>/g;

  for (const match of xml.matchAll(regex)) {
    map[match[1] || ''] = decodeXml(match[2]);
  }

  return { get idArray() { return Object.keys(map).sort((a, b) => Number(a) - Number(b)); }, map };
}

function decodeXml(value) {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function isUnused(text) {
  return text != null && text.startsWith('##');
}

function normalizeEntry(raw) {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/#[0-9#]/g, '');
  return escapeMarkdownTable(text);
}

function escapeMarkdownTable(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  ensureDir(outputDir);

  const engDir = path.join(rootDir, 'text', 'eng3');
  const japDir = path.join(rootDir, 'text', 'jap3');

  for (const cat of categories) {
    const engNamePath = path.join(engDir, cat.files[0]);
    const engDescPath = path.join(engDir, cat.files[1]);
    const japNamePath = path.join(japDir, cat.files[0]);
    const japDescPath = path.join(japDir, cat.files[1]);

    if (!fs.existsSync(engNamePath) || !fs.existsSync(engDescPath) ||
        !fs.existsSync(japNamePath) || !fs.existsSync(japDescPath)) {
      console.log(`${cat.name}: Missing XML files, skipping`);
      continue;
    }

    const engName = extractTextEntries(fs.readFileSync(engNamePath, 'utf8'));
    const engDesc = extractTextEntries(fs.readFileSync(engDescPath, 'utf8'));
    const japName = extractTextEntries(fs.readFileSync(japNamePath, 'utf8'));
    const japDesc = extractTextEntries(fs.readFileSync(japDescPath, 'utf8'));

    const allIdsSet = new Set([...engName.idArray, ...engDesc.idArray, ...japName.idArray, ...japDesc.idArray]);
    const allIds = [...allIdsSet].sort((a, b) => Number(a) - Number(b));

    const lines = [
      '---',
      'cssclasses:',
      '  - wide-page',
      'tags:',
      `  - ${cat.tag}`,
      '---',
      `# ${cat.label}`,
      '',
      '| JP Name | JP desc | EN name | EN desc | Loc Name | Loc desc | Notes |',
      '| ------- | ------- | ------- | ------- | -------- | -------- | ----- |',
    ];

    let exported = 0;
    for (const id of allIds) {
      const jpNameRaw = japName.map[id];
      if (isUnused(jpNameRaw)) continue;

      const jpName = jpNameRaw ? normalizeEntry(jpNameRaw) : '';
      const jpDesc = japDesc.map[id] ? normalizeEntry(japDesc.map[id]) : '';
      const locName = engName.map[id] ? normalizeEntry(engName.map[id]) : '';
      const locDesc = engDesc.map[id] ? normalizeEntry(engDesc.map[id]) : '';

      lines.push(`| ${jpName} | ${jpDesc} | | | ${locName} | ${locDesc} | |`);
      exported++;
    }

    lines.push('');
    const markdown = lines.join('\n');
    const outputPath = path.join(outputDir, `${cat.name}.md`);

    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`${cat.name}: Exported ${cat.name}.md (${exported} entries)`);
  }

  console.log('\nDone! Output written to ./output/3/');
}

main();
