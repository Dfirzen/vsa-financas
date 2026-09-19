const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'renderer', 'vendor');
fs.mkdirSync(output, {recursive: true});
const assets = {
    'chart.js/dist/chart.umd.js': 'chart.umd.js',
    'chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.min.js': 'chartjs-plugin-datalabels.min.js',
    'xlsx/dist/xlsx.full.min.js': 'xlsx.full.min.js',
    'marked/lib/marked.umd.js': 'marked.umd.js',
    'dompurify/dist/purify.min.js': 'purify.min.js',
    'gsap/dist/gsap.min.js': 'gsap.min.js'
};
for (const [source, target] of Object.entries(assets)) fs.copyFileSync(path.join(root, 'node_modules', source), path.join(output, target));
// Preserve the upstream license alongside each bundled package.
for (const name of ['chart.js', 'chartjs-plugin-datalabels', 'xlsx', 'marked', 'dompurify', 'gsap']) {
    const dir = path.join(root, 'node_modules', name);
    const file = fs.readdirSync(dir).find(f => /^licen[sc]e/i.test(f));
    if (file) fs.copyFileSync(path.join(dir, file), path.join(output, name.replace(/\W/g, '-') + '-LICENSE.txt'));
}
console.log('Renderer dependencies prepared locally.');
