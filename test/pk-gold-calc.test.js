const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pk-gold-calc.js');

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('PKR per ounce = USD x rate', () => {
    close(C.pkrPerOunce(3871.6, 276.3501), 3871.6 * 276.3501, 0.01);
});

test('24K per 10g and per tola match the spec formulas', () => {
    const ozPkr = 1000000; // easy number
    close(C.perTenGrams24k(ozPkr), (ozPkr * 10) / 31.1034768, 0.01);
    close(C.perTola24k(ozPkr), (ozPkr * 11.6638038) / 31.1034768, 0.01);
});

test('1 ounce of 24K is worth the per-ounce price (31.1034768 g)', () => {
    close(C.holdingValue(31.1034768, 'g', 24, 1000000), 1000000, 0.01);
});

test('tola holding = per-tola price', () => {
    close(C.holdingValue(1, 'tola', 24, 1000000), C.perTola24k(1000000), 0.01);
});

test('karat scaling: 22K = 24K x 22/24, 21K, 18K', () => {
    close(C.byKarat(2400, 22), 2200); close(C.byKarat(2400, 21), 2100); close(C.byKarat(2400, 18), 1800);
    close(C.holdingValue(10, 'g', 18, 3110347.68), 10 * (3110347.68 / 31.1034768) * 0.75, 0.01);
});

test('10g is 10/11.6638038 of a tola', () => {
    const oz = 2500000;
    close(C.perTenGrams24k(oz) / C.perTola24k(oz), 10 / 11.6638038, 1e-6);
});

test('change calculation', () => {
    const c = C.change(3871.6, 3886.3);
    close(c.abs, -14.7, 1e-9); close(c.pct, -0.3782, 0.001);
});

test('invalid inputs throw', () => {
    assert.throws(() => C.pkrPerOunce(0, 276));
    assert.throws(() => C.pkrPerOunce(3800, NaN));
    assert.throws(() => C.byKarat(100, 20));
    assert.throws(() => C.holdingValue(-1, 'g', 24, 1000));
    assert.throws(() => C.holdingValue(1, 'oz', 24, 1000));
});
