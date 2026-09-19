/**
 * bump-version.js — Incremento automático de versão para o VS&A.
 * 
 * Uso:
 *   node scripts/bump-version.js          → incrementa PATCH (1.0.0 → 1.0.1)
 *   node scripts/bump-version.js minor    → incrementa MINOR (1.0.1 → 1.1.0)
 *   node scripts/bump-version.js major    → incrementa MAJOR (1.1.0 → 2.0.0)
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const changelogPath = path.resolve(__dirname, '..', 'CHANGELOG.md');

// 1. Lê o package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const oldVersion = pkg.version;

// 2. Determina o tipo de incremento via argumento
const bumpType = (process.argv[2] || 'patch').toLowerCase();
const parts = oldVersion.split('.').map(Number);

switch (bumpType) {
    case 'major':
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
        break;
    case 'minor':
        parts[1]++;
        parts[2] = 0;
        break;
    case 'patch':
    default:
        parts[2]++;
        break;
}

const newVersion = parts.join('.');

// 3. Salva a nova versão no package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
const lockPath = path.resolve(__dirname, '..', 'package-lock.json');
if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = newVersion;
    if (lock.packages?.['']) lock.packages[''].version = newVersion;
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

// 4. Atualiza o CHANGELOG.md com a nova entrada
const today = new Date();
const dateStr = today.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
});

const newEntry = `## v${newVersion} — ${dateStr}\n- (preencha as novidades desta versão)\n`;

if (fs.existsSync(changelogPath)) {
    let changelog = fs.readFileSync(changelogPath, 'utf-8');
    // Insere a nova entrada logo após o título principal do CHANGELOG
    const headerMarker = '# Changelog — VS&A\n';
    if (changelog.includes(headerMarker)) {
        changelog = changelog.replace(
            headerMarker,
            headerMarker + '\n' + newEntry + '\n'
        );
    } else {
        // Fallback: insere no topo
        changelog = `# Changelog — VS&A\n\n${newEntry}\n${changelog}`;
    }
    fs.writeFileSync(changelogPath, changelog, 'utf-8');
} else {
    // Cria o arquivo se não existir
    const changelog = `# Changelog — VS&A\n\n${newEntry}\n## v${oldVersion}\n- Versão anterior\n`;
    fs.writeFileSync(changelogPath, changelog, 'utf-8');
}

// 5. Mensagem de confirmação
console.log(`\n✅ Build versão ${newVersion} (era ${oldVersion})`);
console.log(`   Tipo de bump: ${bumpType}`);
console.log(`   CHANGELOG.md atualizado.\n`);
