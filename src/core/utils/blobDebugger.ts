/**
 * Centralized Blob URL debugger for identifying origin mismatches.
 * Overrides URL.createObjectURL to provide diagnostic logs with origins and stack traces.
 */
if (import.meta.env.DEV) {
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function (obj: Blob | MediaSource) {
        const url = originalCreateObjectURL.call(URL, obj);
        const origin = window.location.origin;
        const stack = new Error().stack;

        console.log(`[BLOB-DEBUG] Created: ${url} (Origin: ${origin})`);
        
        if (url.startsWith('blob:file:')) {
            console.error(`[CRITICAL] blob:file: origin detected in ${origin}!`, { stack });
        }
        
        // If we're in http but creating a file blob (how?), or vice versa
        if (origin.startsWith('http') && url.startsWith('blob:file:')) {
            console.error(`[CRITICAL] Cross-origin blob creation blocked: ${url} at ${origin}`);
        }

        return url;
    };
    
    console.log(`⚡️ Blob URL Debugger active (Origin: ${window.location.origin})`);
}
