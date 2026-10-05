# Composer Design System
<!-- beads-id: br-ds-composer-tokens -->

The implemented Composer controls share semantic tokens from [design-tokens.css](../../src/styles/design-tokens.css), the [Button primitive](../../src/components/ui/Button.tsx), and [control styles](../../src/components/ui/controls.module.css). The five Composer stages and shared playback toolbar use these controls. Existing catalogue and experimental screens can migrate incrementally.

## Color, typography and spacing
<!-- beads-id: br-ds-composer-tokens-foundations -->

Use semantic roles instead of component-specific hex values. Canvas, surface, surface-muted, surface-hover and border establish depth; text and text-muted establish hierarchy. Accent is amber for the primary action and selected choices. Danger is reserved for destructive/reset actions; success and info communicate status. Light and dark themes share the same roles. Playback uses an inverse surface; notation paper stays white.

CSS variables use the `--ds-` prefix. Tailwind aliases include `bg-surface`, `text-content`, `text-muted`, `border-line`, `bg-accent`, `text-danger`, and their soft/status counterparts. New component colors belong in the token file.

Spacing follows 4, 8, 12, 16, 20, 24 and 32px. Control labels use 12–14px, body text 14px, panel headings 16px. Controls have an 8px radius, panels 12px, and a 2px visible keyboard focus ring. Reduced-motion preferences disable control transitions.

## Button dimensions and roles
<!-- beads-id: br-ds-composer-tokens-buttons -->

| Size | Minimum height | Label | Use |
| --- | --- | --- | --- |
| sm | 32px | 12px | Toolbar icons and secondary inline actions |
| md (default) | 36px | 13px | Primary workflow action and normal buttons |
| lg | 40px | 14px | Deliberately prominent standalone actions |
| Touch | 44px | Inherited | Minimum target on any coarse-pointer device |

Heights are minimums: long/localized labels wrap. Icon-only buttons have square targets and 16px icons. Use an accessible name and a tooltip. Text actions fit their content by default; opt into fullWidth only when the flow requires it. Choice cards fill their grid cell, have a minimum height of 56px and expose selection with aria-pressed. They are not sized like ordinary action buttons.

Variants: primary for the main action, secondary for bordered utility actions, ghost for quiet actions, danger for reset/delete, choice for selectable cards. Disabled controls retain their variant with reduced opacity and no hover feedback. Busy controls should also be disabled when repeated activation is unsafe.

```tsx
<Button variant="primary" onClick={generate}>Generate accompaniment</Button>
<Button size="sm" onClick={save}>Save note</Button>
<Button variant="ghost" size="sm" iconOnly aria-label="Copy ABC" title="Copy ABC">
  <CopyIcon />
</Button>
<Button variant="choice" aria-pressed={selected} onClick={select}>Option A</Button>
<Link className={buttonStyles({ variant: "primary" })} href={nextUrl}>Continue →</Link>
```

Button defaults to native type=button; explicitly request type=submit for form submission. Keep navigation as links. Do not override button height, font, padding or width with page-specific rules; extend a token or primitive variant when a shared need emerges. Native controls retain their keyboard semantics. Navigation tabs and notation hit areas have separate layout requirements.
