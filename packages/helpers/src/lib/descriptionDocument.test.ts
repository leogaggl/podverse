import { describe, expect, it } from 'vitest';

import {
  buildDescriptionTree,
  descriptionNodesToPlainText,
  readDescriptionDocument,
  serializeDescriptionNodes,
} from './descriptionDocument.js';
import { htmlToPlainText } from './html.js';

describe('readDescriptionDocument', () => {
  it('returns empty plain and null rich for blank input', () => {
    expect(readDescriptionDocument()).toEqual({ plain: '', rich: null });
    expect(readDescriptionDocument('')).toEqual({ plain: '', rich: null });
    expect(readDescriptionDocument('   ')).toEqual({ plain: '', rich: null });
  });

  it('keeps a link and bold in the rich tree', () => {
    const input = '<p>Visit <a href="https://example.com">our <strong>site</strong></a> today</p>';
    const doc = readDescriptionDocument(input);

    expect(doc.plain).toBe(htmlToPlainText(input));
    expect(doc.rich).toEqual([
      {
        kind: 'p',
        children: [
          { kind: 'text', text: 'Visit ' },
          {
            kind: 'a',
            href: 'https://example.com',
            children: [
              { kind: 'text', text: 'our ' },
              { kind: 'strong', children: [{ kind: 'text', text: 'site' }] },
            ],
          },
          { kind: 'text', text: ' today' },
        ],
      },
    ]);
  });

  it('keeps a paragraph break as a br node', () => {
    const doc = readDescriptionDocument('Line one<br/>Line two');

    expect(doc.plain).toBe('Line one Line two');
    expect(doc.rich).toEqual([
      { kind: 'text', text: 'Line one' },
      { kind: 'br' },
      { kind: 'text', text: 'Line two' },
    ]);
  });

  it('yields plain text only for an unclosed tag', () => {
    const input = '<p>Hello <strong>world';
    const doc = readDescriptionDocument(input);

    expect(doc.plain).toBe(htmlToPlainText(input));
    expect(doc.rich).toBeNull();
  });

  it('yields plain text only for a truncated tag', () => {
    const input = 'Hello <a href="https://example.com';
    const doc = readDescriptionDocument(input);

    expect(doc.plain).toBe(htmlToPlainText(input));
    expect(doc.rich).toBeNull();
  });

  it('drops a javascript href but keeps the rest of the tree', () => {
    const doc = readDescriptionDocument(
      '<p><a href="javascript:alert(1)">bad</a> and <em>good</em></p>'
    );

    expect(doc.rich).not.toBeNull();
    expect(doc.rich).toEqual([
      {
        kind: 'p',
        children: [
          { kind: 'text', text: 'bad and ' },
          { kind: 'em', children: [{ kind: 'text', text: 'good' }] },
        ],
      },
    ]);
  });

  it('unwraps div and span while keeping allowed formatting inside', () => {
    const doc = readDescriptionDocument('<div><span>Hello <b>world</b></span></div>');

    expect(doc.rich).toEqual([
      { kind: 'text', text: 'Hello ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'world' }] },
    ]);
  });

  it('drops script and style contents', () => {
    const doc = readDescriptionDocument(
      '<p>Safe</p><script>bad()</script><style>.x{}</style><p>Also</p>'
    );

    expect(doc.plain).toBe('Safe Also');
    expect(doc.rich).toEqual([
      { kind: 'p', children: [{ kind: 'text', text: 'Safe' }] },
      { kind: 'p', children: [{ kind: 'text', text: 'Also' }] },
    ]);
  });

  it('aliases i and b to em and strong', () => {
    const doc = readDescriptionDocument('<p><i>italic</i> <b>bold</b></p>');

    expect(doc.rich).toEqual([
      {
        kind: 'p',
        children: [
          { kind: 'em', children: [{ kind: 'text', text: 'italic' }] },
          { kind: 'text', text: ' ' },
          { kind: 'strong', children: [{ kind: 'text', text: 'bold' }] },
        ],
      },
    ]);
  });
});

describe('buildDescriptionTree (lenient)', () => {
  it('recovers implicit closes and ignores stray closing tags', () => {
    const tree = buildDescriptionTree('<p>a<p>b</p><ul><li>x<li>y</ul></p></div>', 'lenient');

    expect(tree).toEqual([
      { kind: 'p', children: [{ kind: 'text', text: 'a' }] },
      { kind: 'p', children: [{ kind: 'text', text: 'b' }] },
      {
        kind: 'ul',
        children: [
          { kind: 'li', children: [{ kind: 'text', text: 'x' }] },
          { kind: 'li', children: [{ kind: 'text', text: 'y' }] },
        ],
      },
    ]);
  });

  it('drops unclosed script contents to end of input', () => {
    const tree = buildDescriptionTree('<p>Safe</p><script>drop me forever', 'lenient');

    expect(tree).toEqual([{ kind: 'p', children: [{ kind: 'text', text: 'Safe' }] }]);
  });

  it('drops a truncated trailing tag in lenient mode', () => {
    const tree = buildDescriptionTree('<p>Safe</p><a href="https://example.com', 'lenient');

    expect(tree).toEqual([{ kind: 'p', children: [{ kind: 'text', text: 'Safe' }] }]);
  });

  it('removes empty containers and normalizes br runs', () => {
    const tree = buildDescriptionTree('<p><br><b></b>One<br><br><br>Two<br></p>', 'lenient');

    expect(tree).toEqual([
      {
        kind: 'p',
        children: [
          { kind: 'text', text: 'One' },
          { kind: 'br' },
          { kind: 'br' },
          { kind: 'text', text: 'Two' },
        ],
      },
    ]);
  });
});

describe('description tree helpers', () => {
  it('serialized lenient trees parse in strict mode with matching plain text', () => {
    const tree = buildDescriptionTree('<p><strong>A</p><ul><li>B<li>C</ul></strong>', 'lenient');
    const html = serializeDescriptionNodes(tree);
    const parsed = readDescriptionDocument(html);

    expect(tree.length).toBeGreaterThan(0);
    expect(parsed.rich).not.toBeNull();
    expect(parsed.plain).toBe(descriptionNodesToPlainText(tree, ' '));
  });

  it('converts trees to plain text using block separators', () => {
    const tree = buildDescriptionTree('<p>One</p><ul><li>Two</li><li>Three</li></ul>', 'lenient');

    expect(descriptionNodesToPlainText(tree, '\n')).toBe('One\nTwo\nThree');
    expect(descriptionNodesToPlainText(tree, ' | ')).toBe('One | Two | Three');
  });
});
