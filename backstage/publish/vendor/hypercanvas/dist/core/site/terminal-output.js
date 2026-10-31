/** PTY logs are a byte stream; render control sequences as plain readable text. */
export function formatSiteTerminalOutput(logs = []) {
    const text = (Array.isArray(logs) ? logs : [])
        .map((entry) => typeof entry === 'object' && entry !== null && 'message' in entry && typeof entry.message === 'string' ? entry.message : '')
        .filter(message => message.trim())
        .join('\n');
    // Paseo may hand us either full ANSI escapes or CSI fragments without ESC.
    // Strip these only after joining the stream so codes split across writes work.
    return stripTerminalEscapes(text)
        .replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '');
}
function stripTerminalEscapes(text) {
    let output = '';
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code === 27 && text[index + 1] === '[') {
            let end = index + 2;
            while (end < text.length && text.charCodeAt(end) >= 0x30 && text.charCodeAt(end) <= 0x3f)
                end += 1;
            while (end < text.length && text.charCodeAt(end) >= 0x20 && text.charCodeAt(end) <= 0x2f)
                end += 1;
            if (end < text.length && text.charCodeAt(end) >= 0x40 && text.charCodeAt(end) <= 0x7e) {
                index = end;
                continue;
            }
        }
        if (code === 27 && text[index + 1] === ']') {
            let end = index + 2;
            while (end < text.length && text.charCodeAt(end) !== 7 && !(text.charCodeAt(end) === 27 && text[end + 1] === '\\') && text[end] !== '\n')
                end += 1;
            if (end < text.length && (text.charCodeAt(end) === 7 || text.charCodeAt(end) === 27 && text[end + 1] === '\\')) {
                index = text.charCodeAt(end) === 7 ? end : end + 1;
                continue;
            }
        }
        const colorFragment = text[index] === '[' ? /^\[(?:\d{1,3};?){1,6}m/.exec(text.slice(index)) : null;
        if (colorFragment) {
            index += colorFragment[0].length - 1;
            continue;
        }
        if (code === 13) {
            output += '\n';
            if (text.charCodeAt(index + 1) === 10)
                index += 1;
            continue;
        }
        if (code <= 8 || code === 11 || code === 12 || code >= 14 && code <= 31 || code === 127)
            continue;
        output += text[index];
    }
    return output;
}
