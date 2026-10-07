# Application Pitch

## GitDocs: Documentation Evolution Workspace

### Motivation

Developers often restructure a codebase without having a clear way to determine how the documentation should change with it. Documentation may be organized around broader concepts, workflows, or responsibilities rather than directly mirroring code components, so a refactoring can create ambiguity about whether information should be split, merged, renamed, or reorganized. Developers therefore need a way to reason about these changes collaboratively rather than treating documentation updates as a separate editing task after the refactoring is complete.

### Documentation Map

GitDocs represents the code structure and documentation structure separately because they are two different representations of the same system. Code may be organized around modules and dependencies, while documentation may be organized around concepts, workflows, or responsibilities that span multiple components. GitDocs makes the relationship between these structures explicit by showing the documentation hierarchy alongside the code components it describes. When a structural refactoring occurs, developers can use these relationships to identify potentially affected documentation and reason about how the documentation should evolve without requiring it to mirror the codebase.

### Evolution Proposals

Because there may be multiple reasonable ways to reorganize documentation after a refactoring, GitDocs treats the decision as a proposal rather than automatically changing the documentation. A proposal shows the existing and proposed documentation structures, identifies affected code and documentation, and records the rationale for the change. Other developers can review the proposal, comment on specific parts, and suggest alternatives before approving it. The proposal can then be revised throughout the discussion, preserving not only the final documentation structure but also the reasoning and collaboration that led to it.

### Documentation Copilot

Because the appropriate documentation structure cannot always be inferred from the resulting code structure, the AI agent assists with investigation rather than making the decision itself. It can trace references, identify potentially affected documentation, surface relevant code and documentation as evidence, and suggest possible reorganizations. Developers remain responsible for evaluating this evidence and deciding which structure best represents the system.

GitDocs gives developers a shared place to decide how the documentation representation should evolve when the code representation changes. By keeping the two structures distinct while making their relationships explicit, GitDocs supports the judgment that cannot be derived mechanically from the code alone and preserves the reasoning behind that decision.
