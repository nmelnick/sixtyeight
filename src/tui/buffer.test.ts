import { describe, expect, it } from 'vitest';
import { Buffer2D, CellAttr } from './buffer.js';

describe('Buffer2D', () => {
  it('starts filled with spaces', () => {
    const buf = new Buffer2D(5, 2);
    expect(buf.toBlessedContent()).toBe('     \n     ');
  });

  it('writes text at the given position', () => {
    const buf = new Buffer2D(10, 1);
    buf.writeText(2, 0, 'hi');
    expect(buf.toBlessedContent()).toBe('  hi      ');
  });

  it('clips text that runs past the buffer edges', () => {
    const buf = new Buffer2D(5, 1);
    buf.writeText(3, 0, 'abcdef');
    expect(buf.toBlessedContent()).toBe('   ab');
  });

  it('ignores writes outside vertical bounds', () => {
    const buf = new Buffer2D(3, 1);
    buf.writeText(0, 5, 'x');
    expect(buf.toBlessedContent()).toBe('   ');
  });

  it('lets a later write overwrite an earlier one, cell by cell', () => {
    const buf = new Buffer2D(6, 1);
    buf.writeText(0, 0, 'AAAAAA');
    buf.writeText(2, 0, 'BB');
    expect(buf.toBlessedContent()).toBe('AABBAA');
  });

  it('wraps dim runs in a blessed-recognized tag (grey-fg, not the nonexistent {dim})', () => {
    const buf = new Buffer2D(6, 1);
    buf.writeText(0, 0, 'ab');
    buf.writeText(2, 0, 'CD', CellAttr.Dim);
    buf.writeText(4, 0, 'ef');
    expect(buf.toBlessedContent()).toBe('ab{grey-fg}CD{/grey-fg}ef');
  });

  it('escapes literal curly braces so they are not read as tags', () => {
    const buf = new Buffer2D(3, 1);
    buf.writeText(0, 0, '{x}');
    expect(buf.toBlessedContent()).toBe('{open}x{close}');
  });
});
