#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outputDir = path.join(rootDir, 'output');
const games = ['1', '2', '3'];

function extractTextEntries(xml) {
  const entries = [];
  const regex = /<text(?:\s+id="([^"]+)")?>([\s\S]*?)<\/text>/g;

  for (const match of xml.matchAll(regex)) {
    entries.push({
      id: match[1] || null,
      raw: decodeXml(match[2]),
    });
  }

  return entries;
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
  let isSection = false;

  if (text.startsWith('#0')) {
    isSection = true;
    text = text.slice(2);
  }

  text = text.replace(/##/g, '');
  text = convertYellowMarkup(text);
  text = text.replace(/#1|#3/g, '');

  if (isSection) {
    text = `==${text}==`;
  }

  return escapeMarkdownTable(text);
}

function convertYellowMarkup(text) {
  let result = '';
  let highlightOpen = false;

  for (let i = 0; i < text.length; i += 1) {
    const token = text.slice(i, i + 2);

    if (token === '#2') {
      result += '==';
      highlightOpen = true;
      i += 1;
      continue;
    }

    if (token === '#3') {
      result += '==';
      highlightOpen = false;
      i += 1;
      continue;
    }

    result += text[i];
  }

  if (highlightOpen) {
    result += '==';
  }

  return result;
}

function escapeMarkdownTable(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

function buildMarkdown(filename, japEntries, engEntries) {
  if (japEntries.length !== engEntries.length) {
    throw new Error(
      `Entry count mismatch for ${filename}: jap=${japEntries.length}, eng=${engEntries.length}`,
    );
  }

  const lines = [
    '---',
    'cssclasses:',
    '  - wide-page',
    'tags:',
    `  - "#${filename}"`,
    '---',
    '| JP text | EN text | Loc text | Notes |',
    '| ------- | ------- | -------- | ----- |',
  ];

  for (let i = 0; i < japEntries.length; i += 1) {
    lines.push(`| ${normalizeEntry(japEntries[i].raw)} |  | ${normalizeEntry(engEntries[i].raw)} |  |`);
  }

  lines.push('');
  return lines.join('\n');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  ensureDir(outputDir);

  for (const game of games) {
    const engDir = path.join(rootDir, 'text', `eng${game}`, 'dialogue');
    const japDir = path.join(rootDir, 'text', `jap${game}`, 'dialogue');
    const gameOutputDir = path.join(outputDir, game);

    ensureDir(gameOutputDir);

    const filenames = fs
      .readdirSync(engDir)
      .filter((name) => name.endsWith('.xml'))
      .sort((a, b) => a.localeCompare(b));

    for (const xmlFilename of filenames) {
      const engPath = path.join(engDir, xmlFilename);
      const japPath = path.join(japDir, xmlFilename);

      if (!fs.existsSync(japPath)) {
        throw new Error(`Missing matching Japanese file for ${xmlFilename} in game ${game}`);
      }

      const filename = path.basename(xmlFilename, '.xml');
      const engXml = fs.readFileSync(engPath, 'utf8');
      const japXml = fs.readFileSync(japPath, 'utf8');
      const engEntries = extractTextEntries(engXml);
      const japEntries = extractTextEntries(japXml);
      const markdown = buildMarkdown(filename, japEntries, engEntries);
      const outputPath = path.join(gameOutputDir, `${filename}.md`);

      fs.writeFileSync(outputPath, markdown, 'utf8');
    }
  }
}

main();
