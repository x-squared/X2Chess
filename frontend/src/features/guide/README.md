# `features/guide`

Guide/onboarding feature package.

Important subdirectories:

- `model/`: guide identifiers and guide-state metadata.
- `components/`: guide UI surfaces that attach to shell/editor landmarks.

Keep guide-specific IDs and onboarding UI here rather than scattering tutorial metadata through unrelated packages.

Guide and study-overlay feature package.

Contains guide identifiers, guide inspection UI, and study overlay presentation used to explain the interface. This package should stay focused on onboarding and guided interaction support.
