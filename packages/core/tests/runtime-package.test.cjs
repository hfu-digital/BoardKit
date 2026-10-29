const assert = require('node:assert/strict');
const { test } = require('node:test');

test('built package supports Node require and ESM named imports', async () => {
    const required = require('@hfu.digital/boardkit-core');
    const imported = await import('@hfu.digital/boardkit-core');
    assert.equal(typeof required.createScene, 'function');
    assert.equal(imported.createScene, required.createScene);
});
