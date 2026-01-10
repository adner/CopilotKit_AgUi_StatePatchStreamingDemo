# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Guidelines

### Styling
- Use CSS custom properties `var(--background)` and `var(--foreground)` from globals.css for theming
- All components should automatically adapt to light/dark mode using these variables
- Use `rgba(128, 128, 128, 0.2)` for subtle borders that work in both themes
- Apply styling according to @copilotkit/react-core/v2/styles.css conventions

### AG-UI Event Handling
- Subscribe to agent events using `const { agent } = useAgent()` hook
- Use `parseAGUIEvent()` from `src/lib/agui-events/parser.ts` to extract all event properties
- Import types from `@ag-ui/client` (re-exports from `@ag-ui/core`)
- Use discriminated unions (`ParsedAGUIEvent`) for type-safe event handling
- Use type guards from `src/lib/agui-events/type-guards.ts` to narrow event types
- Always clean up subscriptions in `useEffect` return function
- AG-UI event types documented at: https://docs.ag-ui.com/sdk/js/core/events

### Layout Considerations
- Use `flex-1` for components that should expand to fill available space
- AG-UI event monitoring components should be responsive to sidebar state changes

## AG-UI Event System Architecture

### Type System (`src/lib/agui-events/`)
- **types.ts**: Discriminated union of all parsed event types with metadata
- **type-guards.ts**: Category and specific event type guards
- **parser.ts**: `parseAGUIEvent()` extracts all event properties
- **extractors.ts**: Safe property extraction helpers
- **display.ts**: Display names and color coding

### State management
- See the [documentation](https://docs.copilotkit.ai/langgraph/use-agent-hook) for information on how to use agent state, when using the `useAgent` hook.

### Components
- **AGUIEventList** (`src/components/AGUIEventList.tsx`): Subscribes to events, stores `ParsedAGUIEvent[]`, newest first, 100 limit
- **AGUIEvent** (`src/components/AGUIEvent.tsx`): Category-based rendering with type-specific details
- **Renderers** (`src/components/agui-events/renderers.tsx`): Category renderers for tool calls, errors, steps, messages, etc.

## References

- AG-UI Typescript SDK: https://docs.ag-ui.com/sdk/js/core/overview
- AG-UI Events Documentation: https://docs.ag-ui.com/sdk/js/core/events
- CopilotKit API Documentation: https://docs.copilotkit.ai/reference
- CopilotKit v2 React API (used in this project): https://github.com/CopilotKit/CopilotKit/blob/main/src/v2.x/docs/REACT_API.md
- CopilotKit GitHub: https://github.com/CopilotKit/CopilotKit
- Microsoft Agent Framework: https://github.com/microsoft/agents
