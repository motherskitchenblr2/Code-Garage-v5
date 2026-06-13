/**
 * Tests for index.html changes introduced in this PR:
 *
 *  1. <title> updated to "VOLT CODE AI — v5.0 Agentic Code Fixing Hub"
 *  2. <body> element has class="bg-[#121212] overflow-x-hidden"
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const htmlPath = resolve(__dirname, '../../index.html');
const html = readFileSync(htmlPath, 'utf-8');

describe('index.html changes (PR)', () => {
  // ── Title change ──────────────────────────────────────────────────────

  it('has the updated page title', () => {
    expect(html).toContain('<title>VOLT CODE AI — v5.0 Agentic Code Fixing Hub</title>');
  });

  it('no longer contains the old placeholder title', () => {
    expect(html).not.toContain('<title>placeholder-model-1</title>');
  });

  // ── Body class attribute ──────────────────────────────────────────────

  it('body element has bg-[#121212] class for dark background', () => {
    expect(html).toMatch(/<body[^>]*bg-\[#121212\][^>]*>/);
  });

  it('body element has overflow-x-hidden class', () => {
    expect(html).toMatch(/<body[^>]*overflow-x-hidden[^>]*>/);
  });

  it('body element does not have an empty class attribute (regression)', () => {
    // Old version had <body> with no class; new version must have the class attr
    expect(html).not.toMatch(/<body\s*>/);
  });

  // ── Structural integrity (regression) ────────────────────────────────

  it('still contains the root div for React mounting', () => {
    expect(html).toContain('<div id="root"></div>');
  });

  it('still loads the main entry point script', () => {
    expect(html).toContain('src="/src/main.tsx"');
  });

  it('still has the correct charset meta tag', () => {
    expect(html).toContain('<meta charset="UTF-8"');
  });

  it('still has the viewport meta tag', () => {
    expect(html).toContain('<meta name="viewport"');
  });
});