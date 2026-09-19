const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {writeJson} = require('../src/services/json-store');
test('failed serialization leaves the previous file intact and no temporary files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'vsa-store-'));
    const file = path.join(dir,'data.json');
    writeJson(file,{value:42});
    assert.throws(()=>writeJson(file,{value:1n}));
    assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{value:42});
    assert.deepEqual(fs.readdirSync(dir),['data.json']);
    fs.unlinkSync(file); fs.rmdirSync(dir);
});
