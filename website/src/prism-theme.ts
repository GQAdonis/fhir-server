import type {PrismTheme} from 'prism-react-renderer';

// Code blocks are Ink Navy fields in both colour modes, so one theme serves both.
// Syntax hues stay inside the brand: navy tints, the mark's teal and green, and
// the on-navy text colours. Highlighter yellow is reserved for evidence in focus.
const inkNavyCode: PrismTheme = {
  plain: {color: '#f3f7fa', backgroundColor: '#002a42'},
  styles: [
    {types: ['comment', 'prolog', 'doctype', 'cdata'], style: {color: '#8aa7bb', fontStyle: 'italic'}},
    {types: ['punctuation', 'operator'], style: {color: '#b4cbd9'}},
    {types: ['keyword', 'atrule', 'important', 'selector'], style: {color: '#7fd0dc'}},
    {types: ['string', 'char', 'attr-value', 'inserted', 'regex'], style: {color: '#9fd8b8'}},
    {types: ['number', 'boolean', 'constant', 'symbol'], style: {color: '#f2c38c'}},
    {types: ['property', 'attr-name', 'tag', 'key'], style: {color: '#c9dbe7'}},
    {types: ['function', 'class-name', 'builtin'], style: {color: '#ffffff', fontWeight: '600'}},
    {types: ['variable', 'parameter'], style: {color: '#e3edf4'}},
    {types: ['deleted'], style: {color: '#ff9a92'}},
  ],
};

export default inkNavyCode;
