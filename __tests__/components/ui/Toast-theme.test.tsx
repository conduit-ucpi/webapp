/**
 * Toasts wear the brand: the surface comes from the theme's neutrals, and only a stripe and
 * the icon say success / error / warning / info.
 *
 * They used to be tinted with the semantic families and asked for steps those families do not
 * have (text-*-900, border-*-200) plus an `info` family that does not exist. Tailwind emits
 * nothing for a class like that, so the text and border fell through to defaults and an info
 * toast had no background at all — on a partner's page, a mint box that matched nothing.
 */

import React, { useEffect } from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast, type ToastType } from '@/components/ui/Toast';

const tailwind = require('../../../tailwind.config.js');

function Show({ type }: { type: ToastType }) {
  const { showToast } = useToast();
  useEffect(() => {
    showToast({ type, title: `${type} title`, message: 'details', duration: 0 });
  }, [showToast, type]);
  return null;
}

it.each<[ToastType, string]>([
  ['success', 'border-l-success-500'],
  ['error', 'border-l-error-500'],
  ['warning', 'border-l-warning-500'],
  ['info', 'border-l-primary-500'],
])('%s toasts sit on the brand surface with a %s stripe', (type, stripe) => {
  render(<ToastProvider><Show type={type} /></ToastProvider>);

  const toast = screen.getByRole('alert');
  expect(toast).toHaveClass('bg-white', 'text-secondary-900', 'border-secondary-200', stripe);
  expect(toast.className).not.toMatch(/\bbg-(success|error|warning|info)-/);
  expect(screen.getByText(`${type} title`)).toBeInTheDocument();
});

it('names only colour steps that tailwind.config.js defines', () => {
  // ⚠️ THE CHECK THAT WOULD HAVE CAUGHT IT. A class naming a missing step compiles to nothing,
  //    silently, so this reads the component's source and resolves every colour against the
  //    config rather than trusting that the class "looks right".
  const source = fs.readFileSync(
    path.join(__dirname, '../../../packages/whitelabel-sdk/src/components/ui/Toast.tsx'),
    'utf8'
  );
  const colours = tailwind.theme.extend.colors as Record<string, unknown>;
  const used = Array.from(
    source.matchAll(/\b(?:bg|text|border(?:-[ltrbxy])?)-([a-z]+)-(\d{2,3})\b/g),
    (m) => ({ family: m[1], step: m[2], cls: m[0] })
  );

  expect(used.length).toBeGreaterThan(0);
  const missing = used.filter(({ family, step }) => {
    const scale = colours[family] as Record<string, string> | undefined;
    return !scale || !(step in scale);
  });
  expect(missing.map((u) => u.cls)).toEqual([]);
});
