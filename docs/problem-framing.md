# Problem Framing

## Domain

The domain of this project is collaborative software maintenance, specifically how developers understand and restructure existing software systems. Software systems evolve continuously. As a project grows, developers reorganize its implementation to separate responsibilities, reduce complexity, and make future changes easier. Components may be split, moved between subsystems, or combined as the system's responsibilities change.

Developers also maintain documentation that helps people understand these systems. Documentation can describe what components do, how they interact, and how larger parts of the system fit together. Importantly, documentation does not necessarily have the same structure as the implementation. Code may be organized around modules and technical dependencies, while documentation may be organized around concepts, workflows, or responsibilities that span multiple components. This difference is useful because documentation does not need to reproduce the implementation to help people understand it. However, it creates a problem when the implementation is structurally reorganized. A developer cannot always determine how the documentation should change simply by looking at the resulting code structure.

This is particularly difficult in collaborative development because the developer performing a refactoring may not be the person who originally designed the component or wrote its documentation. Other developers may have important context about why particular concepts were grouped together or separated. Developers therefore maintain two related but different representations of the system. The implementation structure describes how the software is divided into components and responsibilities, while the documentation structure describes how the system is organized for people to understand. The important problem is not simply that documentation becomes outdated. The deeper problem is that when one representation is structurally changed, developers must decide how, or whether, the other representation should change with it.

## Stakeholders

The primary stakeholders are developers and reviewers. 

- **Developers**: Need to maintain or understand existing documentation in order to work within the codebase. They may also have important context about why the system is organized around particular concepts. This context can be recorded so that other developers can use it when making future structural decisions.
- **Reviewers**: Need to evaluate whether a proposed structural change preserves a coherent understanding of the system and provide context about existing design decisions.

## Bad Situations

### Onboarding to an unfamiliar codebase

A developer joins a mature project and is asked to modify a subsystem they have never worked on before. The codebase has evolved over several years, so its implementation structure reflects many previous refactorings. The developer begins by looking at the documentation to understand the subsystem, but the documentation and implementation are organized differently. Documentation may describe a broad concept while the code divides that concept across several components. Conversely, several implementation components may be grouped together in one conceptual section.

The developer therefore has to reconstruct the relationship between the two structures. They move between documentation and source code, search for references, inspect historical changes, and ask experienced teammates why certain responsibilities are separated or grouped together. The difficulty is not simply finding what individual components do. The developer also needs to reconstruct why the system is organized and explained in this particular way. This increases the time required to understand an unfamiliar system and can create repeated interruptions for experienced developers who have to explain the structure of a system that is difficult to reconstruct from its existing artifacts.

### Restructuring a documented component

A developer discovers that a permissions component is tightly coupled to several security responsibilities and decides to move it from the authentication subsystem into a new security subsystem. The implementation change is straightforward, but the difficulty begins when the developer considers the existing documentation. The documentation currently places Permissions under Authentication, and there are several plausible interpretations of this organization. The documentation could move with the component because Permissions is now part of Security. It could remain under Authentication because the documentation is explaining the relationship between authentication and permissions rather than the location of the implementation. It could also be reorganized into a broader Security section while retaining its relationship to Authentication. The correct answer cannot be inferred from the new code structure alone.

The developer who originally wrote the documentation may know why it was organized this way, and a reviewer or maintainer may understand relationships that are not obvious from the current implementation. The team therefore has to make a structural decision about the documentation while making a structural decision about the code. Today, those decisions can be handled as separate activities: the code change is reviewed in one place, the documentation is edited elsewhere, and the reasoning connecting the two may be discussed informally. The consequence is not necessarily incorrect documentation. The more fundamental cost is that developers have to reconstruct and negotiate the relationship between two representations of the same system when a structural change crosses that boundary.

### Splitting a component

A developer discovers that a large UserManager component is responsible for authentication, user profiles, and preferences and decides to split it into three components. The existing documentation contains a single User Management section describing the original component. The developer now has several reasonable choices: the documentation could be divided according to the new components, the existing User Management concept could be preserved, or the existing section could become a broader concept containing separate subsections. The correct decision depends on what the documentation is intended to communicate, not simply on how the code is now structured.

Another developer may know that the three responsibilities were intentionally grouped because they form one user-facing concept. Without that context, the developer performing the refactoring may incorrectly assume that the documentation should mirror the new code structure. The team therefore needs to collaboratively decide how the system should be explained after its implementation has been reorganized. This situation is easy to overlook because developers can tolerate it through existing workarounds. They can discuss the decision in a pull request, ask a teammate, edit the documentation separately, and move on. However, these workarounds treat the structural decision as incidental rather than as a distinct part of maintaining the system.

## Corroboration

Developers frequently rely on software history to understand how existing systems evolved, but that history can be difficult to interpret. Codoban et al. studied how developers examine software history and found that developers use committed changes to understand the current state of a system, investigate why code changed, and determine whether past changes are relevant to their current work. The study highlights that understanding existing software often requires developers to reconstruct information that is not immediately apparent from the current code alone.

The study also found that developers use information from other developers and from the history of a system to recover the reasoning behind existing code. Rather than simply needing access to more information, developers need to identify and interpret the information that explains the current organization of the system. This supports the broader problem that understanding an evolving codebase involves reconstructing relationships and design decisions that are not necessarily represented directly in the implementation.

Recent developer discussions suggest that these difficulties persist in practice. In a Reddit discussion about Git pain points, developers described difficulty finding the history behind particular pieces of code and understanding how changes relate to one another across branches and previous work. These responses are anecdotal and do not establish how common these problems are, but they provide contemporary examples of developers struggling to reconstruct the context behind an evolving codebase. Together, these sources support the broader need for better ways to connect current software structure with the historical and contextual information developers use to understand it.

#### Sources

- Software History under the Lens: A Study on Why and How Developers Examine It, dig.cs.illinois.edu/papers/codoban-icsme15.pdf. Accessed 15 Sept. 2026.

- R/Webdev on Reddit: What’s Your #1 Git Pain Point That You’ve Just... Accepted?, www.reddit.com/r/webdev/comments/1ox3b1f/whats_your_1_git_pain_point_that_youve_just/. Accessed 15 Sept. 2026.

## Workarounds and Comparables

### GitHub Pull Requests

Developers can already use pull requests to propose, discuss, review, and revise structural code changes. Reviewers can request changes and discuss the implementation with the author. Rhis is a strong solution for reviewing the code restructuring itself. However, the relationship between the code structure and documentation structure remains implicit. A reviewer can say that documentation should change, but the team has no dedicated representation for deciding how the two structures should relate.

### GitHub CODEOWNERS

CODEOWNERS helps identify developers or teams responsible for particular code locations and can automatically request their review. This can help locate people with relevant expertise, but ownership is tied to files and directories rather than to the conceptual organization of documentation. Someone who understands why documentation is organized around a particular concept may not own the changed code.

### Backstage TechDocs

Backstage TechDocs connects documentation with software components and presents that documentation within a developer portal. This demonstrates the value of connecting documentation with software components. However, it primarily treats documentation as information attached to a component rather than addressing what should happen when component boundaries themselves change.

### CodeSee

CodeSee makes code structure and dependencies explicit through interactive maps and supports activities such as onboarding, refactoring, and code exploration. This addresses the difficulty of understanding implementation structure, but the documentation structure and its relationship to the implementation are not the central object of collaboration.

### Asking Other Developers

Developers can ask teammates who previously worked on the relevant code or documentation. This can provide context that is difficult to recover from existing artifacts, particularly when someone knows why a particular conceptual grouping was chosen. However, this knowledge is informal and depends on finding the right person, who may be busy, on PTO, etc. The resulting decision may also disappear into a conversation rather than becoming part of the system's maintenance history.

## Opportunity

Existing tools support the major activities involved in maintaining software, including changing and reviewing code, writing documentation, communicating with teammates, and investigating unfamiliar systems. However, they do not provide a dedicated place for the decision that connects these activities: determining how the documentation structure should evolve when the implementation structure changes.

Because code and documentation can represent the same system according to different organizational principles, this decision cannot always be derived from the resulting code structure. Developers currently resolve it through a combination of code review, separate documentation edits, conversations with teammates, and informal knowledge. The reasoning behind the final decision can therefore remain scattered across different tools and people.

The opportunity is to make this structural decision a first-class collaborative activity. The system would connect the implementation and documentation structures while keeping them conceptually separate, allowing developers to propose how they should relate after a structural change and allowing other developers to provide context, challenge the proposed organization, and preserve the reasoning behind the resulting decision.

## Solution Sketch

We propose a collaborative workspace that helps developers decide how documentation should change when a codebase is structurally refactored. The workspace connects the existing code structure with the documentation sections that describe it while keeping the two structures separate.

When a developer performs a structural refactoring, they can create a restructuring proposal that identifies the affected code components and proposes how the related documentation should be organized afterward. The proposal captures the existing relationship between the code and documentation, the proposed documentation structure, and the reasoning behind the change.

An AI agent assists with the investigation rather than making the decision. It examines the affected code and documentation, identifies potentially affected sections, traces relationships between components and documentation, and surfaces relevant evidence that may help the developer evaluate different organizational choices. It can also suggest possible structures, but the developer remains responsible for deciding what the documentation should communicate.

Another developer can review the proposal and provide context, request changes, or suggest a different documentation structure. The original developer can revise the proposal in response to this feedback, while the system preserves the reasoning and evolution of the decision.

The resulting workspace gives the team a dedicated place to investigate, discuss, and record how the conceptual representation of a system should evolve alongside structural changes to its implementation. 