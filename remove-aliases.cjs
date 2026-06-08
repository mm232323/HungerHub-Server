const fs = require('fs');
const path = require('path');

function replaceAliases(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            replaceAliases(fullPath);
        } else if (file.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            if (content.includes('#supabase')) {
                // calculate relative path to src/lib/supabase.js
                // all files are in src/controllers or src/types, which is 1 level deep
                content = content.replace(/['"]#supabase['"]/g, "'../lib/supabase.js'");
                modified = true;
            }

            if (content.includes('#api-zod')) {
                // calculate relative path to src/api-zod/index.js
                content = content.replace(/['"]#api-zod['"]/g, "'../api-zod/index.js'");
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
            }
        }
    });
}

replaceAliases('src');
console.log('Aliases replaced in source files.');
