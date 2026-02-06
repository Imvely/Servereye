import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('index.html', () => {
  const htmlPath = resolve(__dirname, '../../index.html');
  const html = readFileSync(htmlPath, 'utf-8');

  it('has ServerEye in the title', () => {
    expect(html).toMatch(/<title>.*ServerEye.*<\/title>/);
  });

  it('references favicon.svg', () => {
    expect(html).toContain('href="/favicon.svg"');
  });
});

describe('favicon.svg', () => {
  it('exists in the public directory', () => {
    const faviconPath = resolve(__dirname, '../../public/favicon.svg');
    expect(existsSync(faviconPath)).toBe(true);
  });

  it('is a valid SVG file', () => {
    const faviconPath = resolve(__dirname, '../../public/favicon.svg');
    const content = readFileSync(faviconPath, 'utf-8');
    expect(content).toContain('<svg');
    expect(content).toContain('</svg>');
  });
});
