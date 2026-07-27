import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) {
            processFileSafer(fullPath);
        }
    }
}

function processFileSafer(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    const regex = /((?:import|export)\s+(?:(?:[\s\S]*?)\s+from\s+)?['"])(\.\/|\.\.\/)([^'"]+)(['"])/g;

    content = content.replace(regex, (match, prefixStr, dotSlash, importPath, suffixStr) => {
        if (importPath.endsWith('.js') || importPath.endsWith('.ts') || importPath.endsWith('.json')) {
            return match;
        }

        const absolutePath = path.resolve(path.dirname(filePath), dotSlash + importPath);
        let isDir = false;
        try {
            isDir = fs.statSync(absolutePath).isDirectory();
        } catch (e) {}

        const newImportPath = isDir ? importPath + '/index.js' : importPath + '.js';
        console.log(`Updated in ${path.basename(filePath)}: ${dotSlash}${importPath} -> ${dotSlash}${newImportPath}`);
        modified = true;
        return `${prefixStr}${dotSlash}${newImportPath}${suffixStr}`;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}

processDir(path.join(__dirname, 'src'));
if (fs.existsSync(path.join(__dirname, 'api'))) {
    processDir(path.join(__dirname, 'api'));
}
