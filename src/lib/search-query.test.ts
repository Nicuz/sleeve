import { expect, test } from 'bun:test';
import { highlightTerms, parseSearchQuery } from './search-query';

test('parses plain text', () => {
  expect(parseSearchQuery('green day')).toEqual({
    text: 'green day',
    filters: {},
  });
});

test('parses operators and quoted values', () => {
  expect(parseSearchQuery('artist:"green day" label:reprise year:2004')).toEqual({
    text: '',
    filters: { artist: 'green day', label: 'reprise', year: '2004' },
  });
});

test('keeps unknown operators and quoted phrases as text', () => {
  expect(parseSearchQuery('foo:bar "blue note" track:boulevard')).toEqual({
    text: 'foo:bar blue note',
    filters: { track: 'boulevard' },
  });
});

test('combines free text with operators', () => {
  expect(parseSearchQuery('idiot artist:green')).toEqual({
    text: 'idiot',
    filters: { artist: 'green' },
  });
});

test('builds highlight terms from text and operators', () => {
  expect(highlightTerms(parseSearchQuery('idiot artist:"green day"'))).toEqual([
    'idiot',
    'green',
    'day',
  ]);
});
