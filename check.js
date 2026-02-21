const fs = require('fs');
const content = fs.readFileSync('src/app/admin/AdminDashboard.tsx', 'utf8');

let lineNum = 1;
const stack = [];
for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lineNum++;

    // Simplistic JSX tag finder (will break on strings, but good enough for this)
    if (content[i] === '<' && content[i + 1] !== ' ' && content[i + 1] !== '=' && content[i + 1] !== '/' && content[i + 1] !== '>') {
        let tag = '';
        let j = i + 1;
        while (j < content.length && /[a-zA-Z0-9]/.test(content[j])) {
            tag += content[j];
            j++;
        }
        if (tag && tag !== 'br' && tag !== 'hr' && tag !== 'img' && tag !== 'input') {
            // Check if it's self-closing
            let k = j;
            let selfClosing = false;
            while (k < content.length && content[k] !== '>') {
                if (content[k] === '/' && content[k + 1] === '>') selfClosing = true;
                k++;
            }
            if (!selfClosing) {
                stack.push({ tag, line: lineNum });
                // console.log(`Opened <${tag}> at ${lineNum}`);
            }
        }
    } else if (content[i] === '<' && content[i + 1] === '/') {
        let tag = '';
        let j = i + 2;
        while (j < content.length && /[a-zA-Z0-9]/.test(content[j])) {
            tag += content[j];
            j++;
        }
        if (tag) {
            const last = stack.pop();
            // console.log(`Closed </${tag}> at ${lineNum}`);
            if (!last || last.tag !== tag) {
                console.log(`Mismatch at line ${lineNum}: Expected </${last ? last.tag : 'nothing'}> but got </${tag}>`);
                break;
            }
        }
    }
}
if (stack.length > 0) {
    console.log("Unclosed tags remaining:", stack.slice(-5));
} else {
    console.log("Tags perfectly matched!");
}
