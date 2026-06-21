# Main setup

- **Please find GSD tools from `.Codex/gsd-core`** and not from `$HOME/.Codex/gsd-core`
- **Please do not run the server** I do on my side

# Preact Development Guidelines

> description: Development guidelines for writing efficient Preact code, choosing Signals over unnecessary React hooks, and keeping planning files committed during the GSD workflow.

## Prefer Preact-Native Patterns

This project uses **Preact**, not a standard React environment.

Do not automatically apply common React patterns or workarounds. React-specific techniques may introduce unnecessary dependencies, additional rendering work, and avoidable complexity in a Preact codebase.

Before implementing state management or reactive behavior:

1. Check whether the project already uses Preact Signals.
2. Review the `developing-preact` skill when additional guidance is needed.
3. Prefer the simplest Preact-native solution that matches the existing architecture.

## Prefer Signals Over Unnecessary Hooks

When appropriate, prefer Preact Signals over `useState` and `useEffect`.

Use Signals for:

- Reactive values shared across components.
- State that can be updated outside a component.
- Fine-grained updates.
- Derived reactive values.
- State that would otherwise require effect dependency management.
- Logic that should not be tied to a component's render lifecycle.

Typical APIs include:

```ts
import { computed, effect, signal } from "@preact/signals";
```

Examples:

- Basic state with signal

```ts
import { computed, signal } from "@preact/signals";

export const count = signal(0)
export const doubledCount = computed(() => count.value * 2)
```
- Avoid:

```ts
const [fullName, setFullName] = useState("")

useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])
```

- Prefer direct derivation:

```ts
const fullName = `${firstName} ${lastName}`

// Or, when the source values are Signals:
const fullName = computed(
  () => `${firstName.value} ${lastName.value}`,
);
```

## Avoid Effect Dependency Complexity

Do not introduce useEffect merely to react to internal state changes.

Before adding an effect, determine whether the logic can instead be handled by:

* An event handler.
* A computed value.
* A Signal.
* A regular function.
* Initialization logic.
* A dedicated data or service layer.

Effects should synchronize with something external. They should not be used as a general-purpose control-flow mechanism.

When an effect is necessary:

* Keep it focused on one responsibility.
* Include proper cleanup.
* Avoid unstable dependencies.
* Do not suppress dependency warnings without a documented reason.
* Do not create dependency loops.
* Do not copy state from one reactive source into another unless synchronization is genuinely required.

Consult the Preact Skill

When implementing or reviewing Preact code, consult the developing-preact skill for project-specific guidance.

In particular, use it before introducing:

* Complex hook combinations.
* New shared-state abstractions.
* React compatibility workarounds.
* Custom reactive utilities.
* Performance optimizations.
* Signal and hook interoperability patterns.

Prefer established project conventions over generic React examples found elsewhere.

Preserve Existing Project Conventions

Before changing an existing implementation:

1. Inspect nearby components and modules.
2. Identify how the project currently manages state.
3. Reuse existing utilities and abstractions.
4. Avoid mixing multiple state-management approaches without a clear reason.
5. Keep the change proportional to the task.

Do not refactor unrelated code solely to replace hooks with Signals.

When retaining a React-style hook instead of using a Signal, the implementation should have a clear lifecycle or locality reason.
