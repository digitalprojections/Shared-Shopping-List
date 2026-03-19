import fs from 'fs';

const content = fs.readFileSync('c:/Users/user/source/repos/Shared-Shopping-List/src/App.tsx', 'utf8');
let stack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let char of line) {
        if (char === '{') stack.push({line: i+1, char: '{'});
        if (char === '}') {
            if (stack.length === 0) {
                console.log(`Extra closing bracket at line ${i+1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log(`Unclosed brackets: ${stack.length}`);
    stack.forEach(s => console.log(`Unclosed at line ${s.line}`));
} else {
    console.log("Brackets are balanced!");
}
