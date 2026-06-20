import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const files = [...html.matchAll(/<script\s+src="\.\/([^"]+\.js)"><\/script>/g)]
  .map((match) => match[1]);

files.push('sw.js');

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  vm.createScript(source, { filename: file });
}

console.log(`JS OK (${files.join(', ')})`);
