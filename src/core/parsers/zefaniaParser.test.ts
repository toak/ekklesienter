import { describe, it, expect } from 'vitest';
import { zefaniaParser } from './zefaniaParser';

describe('zefaniaParser scriptures interpreter', () => {
    it('should parse well-formed XML Zefania streams', async () => {
        const xml = '<XMLBIBLE><BIBLEBOOK bnumber="1" bname="Genesis"><CHAPTER cnumber="1"><VERS vnumber="1">In the beginning...</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>';
        const bible = await zefaniaParser.parse(xml, 'test.xml');
        expect(bible).toBeDefined();
        expect(bible.translation.name).toBe('test.xml');
    });
});

