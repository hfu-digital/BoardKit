const assert = require('node:assert/strict');
const { test } = require('node:test');

test('built package supports Node require and ESM named imports', async () => {
    const required = require('@hfu.digital/boardkit-nestjs');
    const imported = await import('@hfu.digital/boardkit-nestjs');
    assert.equal(typeof required.BoardModule, 'function');
    assert.equal(imported.BoardModule, required.BoardModule);
});
