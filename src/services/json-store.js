const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, JSON.stringify(data, null, 2), {encoding: 'utf8', mode: 0o600});
        fs.renameSync(temporary, file);
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}
module.exports = {writeJson};
