# Sine, in this repository

The part of **Arcon Sine** (`@arcon.mobi/sine` 0.6.6) that the editor uses, kept
here as a local Nuxt layer so the editor doesn't install from Arcon's registry.
Nuxt registers every layer in `layers/` on its own, and this one names itself
`sine`, so the editor reaches it as `#layers/sine/…`.

It is a copy, trimmed to what the editor reaches and nothing else: the
components, composables and utilities its files import, followed through their
own imports; the stylesheet and the Tailwind theme; the Sans and Mono cuts of
the type; and the `sine` command that lints and checks the editor against the
system. The files are unchanged from 0.6.6 except `nuxt.config.ts` (no package
or map wiring), `public/css/font.css` (two cuts) and `package.json`.

## Using more of Sine

Copy the file you need from the Sine repository, at the same path, along with
whatever it imports that isn't here yet. Every Sine file imports what it uses by
relative path, so `pnpm typecheck` names anything missing. A package it imports
becomes one of the editor's dependencies, and goes in `peerDependencies` here
so `pnpm doctor:sine` checks it.

## Checks

- `pnpm lint:design` holds the editor's `app/` to Sine's rules, with the
  exceptions in `sine.config.ts` at the repository's root.
- `pnpm doctor:sine` checks the wiring: the layer, the packages in
  `peerDependencies`, the stylesheet, and what the shell mounts.

## Licensing

The PP Neue Montreal fonts in `public/fonts` and the Nucleo glyphs in
`app/components/Icon/Nucleo` are licensed to Arcon, and Sine itself is private.
Keep this repository, and any build of the editor, private.
