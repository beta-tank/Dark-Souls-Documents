#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outputDir = path.join(rootDir, 'output');
const games = ['1', '2', '3'];

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

  for (const game of games) {
    const engDir = path.join(rootDir, 'text', `eng${game}`);
    const japDir = path.join(rootDir, 'text', `jap${game}`);
    const gameOutputDir = path.join(outputDir, game);

    ensureDir(gameOutputDir);

    const engNamePath = path.join(engDir, 'item_name.xml');
    const engDescPath = path.join(engDir, 'item_desc.xml');
    const japNamePath = path.join(japDir, 'item_name.xml');
    const japDescPath = path.join(japDir, 'item_desc.xml');

    if (!fs.existsSync(engNamePath) || !fs.existsSync(engDescPath) ||
        !fs.existsSync(japNamePath) || !fs.existsSync(japDescPath)) {
      console.log(`Game ${game}: Missing item XML files, skipping`);
      continue;
    }

    const engName = extractTextEntries(fs.readFileSync(engNamePath, 'utf8'));
    const engDesc = extractTextEntries(fs.readFileSync(engDescPath, 'utf8'));
    const japName = extractTextEntries(fs.readFileSync(japNamePath, 'utf8'));
    const japDesc = extractTextEntries(fs.readFileSync(japDescPath, 'utf8'));

    // Use English names as master index, fallback to Japanese + description IDs
    const allIdsSet = new Set([...engName.idArray, ...engDesc.idArray]);
    const allIds = [...allIdsSet].sort((a, b) => Number(a) - Number(b));

    const lines = [
      '---',
      'cssclasses:',
      '  - wide-page',
      'tags:',
      `  - "#game${game}"`,
      '---',
      '| JP name | JP description | EN name | EN description | Loc name | Loc description | Notes |',
      '| ------- | -------------- | ------- | -------------- | -------- | --------------- | ----- |',
    ];

    for (const id of allIds) {
      const jpName = japName.map[id] ? normalizeEntry(japName.map[id]) : '';

      const jpDesc = japDesc.map[id] ? normalizeEntry(japDesc.map[id]) : '';
      const enDescRaw = engDesc.map[id];
      const locDesc = enDescRaw ? normalizeEntry(enDescRaw) : '';

      const enNameRaw = engName.map[id];
      const locName = enNameRaw ? normalizeEntry(enNameRaw) : '';

      lines.push(`| ${jpName} | ${jpDesc} | | | ${locName} | ${locDesc} | |`);
    }

    lines.push('');
    const markdown = lines.join('\n');
    const outputPath = path.join(gameOutputDir, 'item.md');

    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`Game ${game}: Exported item.md (${allIds.length} entries)`);
  }

  console.log('\nDone! Output written to ./output/');
}

main();
