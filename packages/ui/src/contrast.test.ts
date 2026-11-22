import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, darkTheme, gradients, lightTheme, WCAG_AA } from './index.js';

test('contrastRatio matches known WCAG values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  assert.equal(contrastRatio('#767676', '#FFFFFF').toFixed(2), '4.54');
});

for (const [name, t] of Object.entries({ light: lightTheme, dark: darkTheme })) {
  for (const bg of ['background', 'surface', 'surfaceRaised'] as const) {
    test(`${name}: body text is AA on ${bg}`, () => {
      for (const fg of ['textPrimary', 'textSecondary', 'danger', 'success'] as const) {
        const r = contrastRatio(t[fg], t[bg]);
        assert.ok(r >= WCAG_AA.text, `${fg} on ${bg} = ${r.toFixed(2)}`);
      }
    });
    test(`${name}: muted text, primary and accent meet UI contrast (3:1) on ${bg}`, () => {
      for (const fg of ['textMuted', 'primary', 'warning'] as const) {
        const r = contrastRatio(t[fg], t[bg]);
        assert.ok(r >= WCAG_AA.ui, `${fg} on ${bg} = ${r.toFixed(2)}`);
      }
    });
  }
  test(`${name}: control borders meet 3:1 on surfaces`, () => {
    for (const bg of ['background', 'surface', 'surfaceRaised', 'surfaceMuted'] as const) {
      const r = contrastRatio(t.borderStrong, t[bg]);
      assert.ok(r >= WCAG_AA.ui, `borderStrong on ${bg} = ${r.toFixed(2)}`);
    }
  });
  test(`${name}: text stays AA on surfaceMuted and primarySoft`, () => {
    for (const bg of ['surfaceMuted', 'primarySoft'] as const) {
      for (const fg of ['textPrimary', 'textSecondary', 'primary'] as const) {
        const r = contrastRatio(t[fg], t[bg]);
        assert.ok(r >= WCAG_AA.text, `${fg} on ${bg} = ${r.toFixed(2)}`);
      }
    }
  });
  test(`${name}: labels on solid status fills are AA`, () => {
    for (const [fg, bg] of [['onSuccess', 'success'], ['onWarning', 'warning'], ['onDanger', 'danger']] as const) {
      const r = contrastRatio(t[fg], t[bg]);
      assert.ok(r >= WCAG_AA.text, `${fg} on ${bg} = ${r.toFixed(2)}`);
    }
  });
  test(`${name}: primaryText on primary is AA`, () => {
    const r = contrastRatio(t.primaryText, t.primary);
    assert.ok(r >= WCAG_AA.text, `primaryText on primary = ${r.toFixed(2)}`);
  });
  test(`${name}: primary is AA for text links on background`, () => {
    const r = contrastRatio(t.primary, t.background);
    assert.ok(r >= WCAG_AA.text, `primary on background = ${r.toFixed(2)}`);
  });
}

test('signalStrong gradient keeps white labels AA at every stop', () => {
  for (const stop of gradients.signalStrong) {
    const r = contrastRatio('#FFFFFF', stop);
    assert.ok(r >= WCAG_AA.text, `white on ${stop} = ${r.toFixed(2)}`);
  }
});
