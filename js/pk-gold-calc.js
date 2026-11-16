/* Pakistan gold dashboard: pure calculation helpers.
   Works in the browser (window.PKGold) and in Node (module.exports) so it can be tested.
   All money maths is done in integer "micro-units" (BigInt) to avoid float drift,
   then converted back to a Number only for display. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PKGold = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Exact constants, scaled by 1e7 (the most decimals either constant has).
    const SCALE = 10000000n;
    const GRAMS_PER_OZ = 311034768n;   // 31.1034768 g
    const GRAMS_PER_TOLA = 116638038n; // 11.6638038 g (note: 7 decimals => 11.6638038)
    const GRAMS_PER_OZ_NUM = 31.1034768;
    const GRAMS_PER_TOLA_NUM = 11.6638038;

    const KARATS = { 24: 24, 22: 22, 21: 21, 18: 18 };

    // Parse a Number into a BigInt scaled by 1e6 (rounded).
    function toMicro(n) {
        return BigInt(Math.round(n * 1e6));
    }
    function fromMicro(b) {
        return Number(b) / 1e6;
    }
    // round-half-up integer division
    function divRound(a, b) {
        const q = a / b, r = a % b;
        return r * 2n >= b ? q + 1n : q;
    }

    function assertPositive(n, name) {
        if (typeof n !== 'number' || !isFinite(n) || n <= 0) throw new Error(name + ' must be a positive number');
    }

    // PKR gold price per troy ounce = USD/oz x USD/PKR
    function pkrPerOunce(usdPerOz, usdPkr) {
        assertPositive(usdPerOz, 'usdPerOz'); assertPositive(usdPkr, 'usdPkr');
        return fromMicro(divRound(toMicro(usdPerOz) * toMicro(usdPkr), 1000000n));
    }

    // 24K price for 10 grams, from a per-ounce price in any currency.
    function perTenGrams24k(perOunce) {
        assertPositive(perOunce, 'perOunce');
        // perOunce * 10 / 31.1034768
        return fromMicro(divRound(toMicro(perOunce) * 10n * SCALE, GRAMS_PER_OZ));
    }

    // 24K price per tola.
    function perTola24k(perOunce) {
        assertPositive(perOunce, 'perOunce');
        // perOunce * 11.6638038 / 31.1034768
        return fromMicro(divRound(toMicro(perOunce) * GRAMS_PER_TOLA, GRAMS_PER_OZ));
    }

    // Price for another karat from the 24K price: x * karat / 24
    function byKarat(price24k, karat) {
        if (!KARATS[karat]) throw new Error('Unsupported karat: ' + karat);
        assertPositive(price24k, 'price24k');
        return fromMicro(divRound(toMicro(price24k) * BigInt(karat), 24n));
    }

    function pricePerGram24k(perOunce) {
        assertPositive(perOunce, 'perOunce');
        return fromMicro(divRound(toMicro(perOunce) * SCALE, GRAMS_PER_OZ));
    }

    // Value of a holding. unit: 'g' or 'tola'. Returns PKR.
    function holdingValue(weight, unit, karat, pkrPerOz) {
        if (typeof weight !== 'number' || !isFinite(weight) || weight < 0) throw new Error('weight must be >= 0');
        if (unit !== 'g' && unit !== 'tola') throw new Error('unit must be g or tola');
        if (!KARATS[karat]) throw new Error('Unsupported karat: ' + karat);
        assertPositive(pkrPerOz, 'pkrPerOz');
        const grams = unit === 'tola' ? weight * GRAMS_PER_TOLA_NUM : weight;
        const perGram24 = toMicro(pkrPerOz) * SCALE / GRAMS_PER_OZ; // micro PKR per gram (24K)
        const value = BigInt(Math.round(grams * 1e6)) * perGram24 * BigInt(karat) / 24n / 1000000n;
        return fromMicro(value);
    }

    function change(current, previous) {
        assertPositive(current, 'current'); assertPositive(previous, 'previous');
        const abs = current - previous;
        return { abs: abs, pct: (abs / previous) * 100 };
    }

    return {
        GRAMS_PER_OZ: GRAMS_PER_OZ_NUM, GRAMS_PER_TOLA: GRAMS_PER_TOLA_NUM,
        pkrPerOunce, perTenGrams24k, perTola24k, pricePerGram24k, byKarat, holdingValue, change
    };
});
