---
name: ui-text-writer
description: Generates professional, attractive, and context-aware UI text. Use when the user needs copy for buttons, modals, error messages, or onboarding screens. Adapts tone and style to the codebase context.
---

# UI Text Writer

## Overview

This skill assists in writing high-quality user interface copy. It focuses on clarity, professionalism, and user-friendliness, while adapting to the existing tone and style of the application.

## Workflow

### 1. Analyze Context

Before writing new text, analyze the surrounding codebase to match the existing voice.

- **Check existing UI components**: Look at `src/*` or `src/components` or `src/features` to see how text is currently written.
- **Check locale files**: If applicable, checks `public/locales` or `src/i18n` to understand naming conventions and tone.
- **Identify the specific component**: Is it a destructive modal? A welcome screen? The tone should match the stakes (e.g., serious for errors, enthusiastic for onboarding).

### 2. Choose Mode

#### Mode A: New Content (Drafting)

Generate text options based on the context and [Best Practices](references/best-practices.md).

- **Propose Options**: Offer 2-3 variations (e.g., "Direct", "Friendly", "Formal").
- **Mockups**: Show how the text looks in the UI structure.

#### Mode B: Existing Content (Analyze & Suggest)

1. **Audit**: Read the existing text and compare it against [Best Practices](references/best-practices.md) and the app's tone.
2. **Identify Issues**: Look for:
    - Inconsistencies (e.g., "Log in" vs "Sign in").
    - Tone mismatches (e.g., robotic error messages).
    - Wordiness.
3. **Suggest Improvements**: Show a side-by-side comparison:
    > **Original**: "User was successfully created."
    > **Suggested**: "Account created!" (Reason: More direct and friendly)

### 3. Apply User Guidelines

If the user provides specific instructions (e.g., "Make it sound exciting" or "Use Title Case for everything"), prioritize them over default best practices.

- **Conflict Resolution**: If a user guideline conflicts with usability (e.g., "No labels"), warn the user but provide the requested option alongside a "Best Practice" alternative.
- **Adaptive Style**: If the user edits your suggestion, analyze their edit. What changed? (e.g., did they shorten it?). Apply that pattern to future suggestions in this session.

### 4. Proactive Improvements

When fulfilling a request, look for adjacent improvements.

- **Consistency Check**: "I noticed you changed 'Submit' to 'Send' here. Should I update the other 3 buttons on this page to match?"
- **Opportunity Detection**: "While fixing this error message, I noticed the success message is also very generic. Would you like suggestions for that too?"

### 5. Refine

Review the final text against constraints:

- **Length**: Will it fit on mobile screens?
- **Clarity**: Is it unambiguous?

## When to Use

- **New Features**: creating onboarding flows, feature announcements.
- **Error Handling**: writing user-friendly error messages.
- **Refactoring**: improving existing, confusing UI text.
- **Microcopy**: labels, tooltips, button text.

## Resources

- **[Best Practices](references/best-practices.md)**: Detailed guidelines on tone, mechanics, and specific components.
