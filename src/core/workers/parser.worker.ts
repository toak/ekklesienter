import { BibleData } from '@/core/types';
import { zefaniaParser } from '@/core/parsers/zefaniaParser';
import { myBibleParser } from '@/core/parsers/myBibleParser';

/* eslint-disable no-restricted-globals */

self.onmessage = async (e: MessageEvent) => {
    const { fileType, content, fileName } = e.data;

    try {
        let data: BibleData;

        if (fileType === 'xml') {
            data = await zefaniaParser.parse(content as string, fileName);
            self.postMessage({ type: 'success', data });
        } else if (fileType === 'sqlite') {
            await myBibleParser.parse(content as ArrayBuffer, fileName, (type, data, progress) => {
                if (type === 'metadata') {
                    self.postMessage({ type: 'metadata', data });
                } else if (type === 'verses') {
                    self.postMessage({ type: 'chunk', data, progress });
                }
            });
            self.postMessage({ type: 'success' }); // Done
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (err: any) {
        console.error('[ParserWorker] Error:', err);
        self.postMessage({
            type: 'error',
            error: err instanceof Error ? err.message : (typeof err === 'string' ? err : 'Unknown Parsing Error')
        });
    }
};
