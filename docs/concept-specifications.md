# Concept Design

## Concept 1: InvestigatingChanges

**concept** InvestigatingChanges
\
**types** Commit, Documentation, Evidence, User, Agent
\
**purpose** identify documentation that may need reconsideration when a set of commits changes the structure or responsibilities of the system
\
**principle**
after investigating a set of commits,
\
&emsp;the investigation records potentially affected documentation
\
&emsp;and evidence connecting the commits to that documentation
\
&emsp;and if a document was flagged by mistake or a piece of evidence does not hold up,
\
&emsp;the investigator removes it before completing the investigation

**state**
a set of Investigations with
\
&emsp;commits set of Commit
\
&emsp;author User or Agent
\
&emsp;affectedDocumentation set of Documentation
\
&emsp;evidence set of Evidence
\
&emsp;status String

**actions**
\
identify(commits: set of Commit, investigator: User or Agent): (investigation: Investigation)
\
&emsp;**where** no investigation exists for the commits and investigator
\
&emsp;**then** creates an investigation with the commits, investigator, empty affectedDocumentation and evidence sets, and status open

associate(investigation: Investigation, documentation: Documentation)
\
&emsp;**where** investigation exists, its status is open, and documentation is not already associated with it
\
&emsp;**then** adds documentation to the investigation's affectedDocumentation set

dissociate(investigation: Investigation, documentation: Documentation)
\
&emsp;**where** investigation exists, its status is open, and documentation is associated with it
\
&emsp;**then** removes documentation from the investigation's affectedDocumentation set

record(investigation: Investigation, evidence: Evidence)
\
&emsp;**where** investigation exists and its status is open
\
&emsp;**then** adds evidence to the investigation's evidence set

retract(investigation: Investigation, evidence: Evidence)
\
&emsp;**where** investigation exists, its status is open, and evidence is in the investigation's evidence set
\
&emsp;**then** removes evidence from the investigation's evidence set

complete(investigation: Investigation)
\
&emsp;**where** investigation exists and its status is open
\
&emsp;**then** changes the investigation's status to complete


## Concept 2: RestructuringDocumentation

**concept** RestructuringDocumentation
\
**types** Investigation, Commit, Documentation, DocumentationTree
\
**purpose** allow developers to construct and justify alternative documentation structures in response to a set of commits without requiring documentation to mirror the code structure
\
**principle**
after creating a restructuring,
\
&emsp;the restructuring preserves the current documentation structure
\
&emsp;and allows the developer to construct and justify an alternative structure
\
&emsp;and if the developer wants to keep working on a submitted restructuring, they revise it back into a draft,
\
&emsp;and a draft they no longer want can be discarded

**state**
a set of Restructurings with
\
&emsp;investigation Investigation
\
&emsp;commits set of Commit
\
&emsp;currentStructure DocumentationTree
\
&emsp;proposedStructure DocumentationTree
\
&emsp;rationale String
\
&emsp;status String

**actions**
\
create(investigation: Investigation, commits: set of Commit, currentStructure: DocumentationTree): (restructuring: Restructuring)
\
&emsp;**where** currentStructure exists and no restructuring exists for the investigation
\
&emsp;**then** creates a restructuring for the investigation with the commits, currentStructure as its initial proposedStructure, an empty rationale, and status draft

modify(restructuring: Restructuring, proposedStructure: DocumentationTree, rationale: String)
\
&emsp;**where** restructuring exists and its status is draft
\
&emsp;**then** replaces the proposedStructure and updates the rationale

submit(restructuring: Restructuring)
\
&emsp;**where** restructuring exists and its status is draft
\
&emsp;**then** changes the status to underReview

revise(restructuring: Restructuring)
\
&emsp;**where** restructuring exists and its status is underReview or approved
\
&emsp;**then** changes the status to draft, so the developer can modify it again

discard(restructuring: Restructuring)
\
&emsp;**where** restructuring exists and its status is draft
\
&emsp;**then** removes the restructuring

approve(restructuring: Restructuring)
\
&emsp;**where** restructuring exists and its status is underReview
\
&emsp;**then** changes the status to approved

apply(restructuring: Restructuring)
\
&emsp;**where** restructuring exists and its status is approved
\
&emsp;**then** replaces the current documentation structure with the proposedStructure and changes the status to applied

## Concept 3: ReviewingDocumentation

**concept** ReviewingDocumentation
\
**types** Restructuring, User, Comment, Suggestion
\
**purpose** allow another developer to evaluate whether a proposed documentation structure provides a coherent representation of the system
\
**principle**
after a restructuring is submitted for review,
\
&emsp;the reviewer records concerns and alternative suggestions
\
&emsp;and approves the restructuring or requests changes
\
&emsp;and if the reviewer thinks of another concern or realizes they made a mistake,
\
&emsp;they edit or remove a comment or suggestion, or reopen a review they already decided

**state**
a set of Reviews with
\
&emsp;restructuring Restructuring
\
&emsp;reviewer User
\
&emsp;comments set of Comment
\
&emsp;suggestions set of Suggestion
\
&emsp;decision String

**actions**
\
create(restructuring: Restructuring, reviewer: User): (review: Review)
\
&emsp;**where** no review exists for the restructuring and reviewer
\
&emsp;**then** creates a review with empty comments and suggestions and decision pending

comment(review: Review, comment: Comment)
\
&emsp;**where** review exists and its decision is pending
\
&emsp;**then** adds the comment to the review's comments set

editComment(review: Review, comment: Comment, revised: Comment)
\
&emsp;**where** review exists, its decision is pending, and comment is in the review's comments set
\
&emsp;**then** replaces comment with revised in the review's comments set

removeComment(review: Review, comment: Comment)
\
&emsp;**where** review exists, its decision is pending, and comment is in the review's comments set
\
&emsp;**then** removes the comment from the review's comments set

suggest(review: Review, suggestion: Suggestion)
\
&emsp;**where** review exists and its decision is pending
\
&emsp;**then** adds the suggestion to the review's suggestions set

editSuggestion(review: Review, suggestion: Suggestion, revised: Suggestion)
\
&emsp;**where** review exists, its decision is pending, and suggestion is in the review's suggestions set
\
&emsp;**then** replaces suggestion with revised in the review's suggestions set

removeSuggestion(review: Review, suggestion: Suggestion)
\
&emsp;**where** review exists, its decision is pending, and suggestion is in the review's suggestions set
\
&emsp;**then** removes the suggestion from the review's suggestions set

requestChanges(review: Review)
\
&emsp;**where** review exists and its decision is pending
\
&emsp;**then** changes the decision to changesRequested

approve(review: Review)
\
&emsp;**where** review exists and its decision is pending
\
&emsp;**then** changes the decision to approved

reopen(review: Review)
\
&emsp;**where** review exists and its decision is changesRequested or approved
\
&emsp;**then** changes the decision back to pending, so the reviewer can change their comments and suggestions and decide again

# Essential Reactions

**reaction** createRestructuring
\
**where**
\
&emsp;InvestigatingChanges.complete(investigation)
\
**then**
\
&emsp;RestructuringDocumentation.create(investigation, investigation's commits, currentStructure)

The investigation identifies potentially affected documentation and provides the evidence that informs the developer's restructuring. `currentStructure` is the repository's documentation tree at the time the investigation is completed. The restructuring keeps a reference to the investigation, so its affected documentation and evidence stay reachable while the developer writes the rationale with `modify`.

**reaction** submitForReview
\
**where**
\
&emsp;RestructuringDocumentation.submit(restructuring)
\
**then**
\
&emsp;ReviewingDocumentation.create(restructuring, reviewer)

When a user submits a restructuring, the proposed representation should be available for independent evaluation.

**reaction** requestRevision
\
**where**
\
&emsp;ReviewingDocumentation.requestChanges(review)
\
**then**
\
&emsp;RestructuringDocumentation.revise(review's restructuring)

The reviewer records concerns without modifying the restructuring, allowing the developer to revise the proposed representation in response to feedback.


# Role of Concepts

**InvestigatingChanges** determines which documentation may need reconsideration and records the evidence supporting that assessment. Both developers and AI agents can investigate changes. It does not decide how documentation should be reorganized.

**RestructuringDocumentation** allows users to propose alternative representations of the documentation structure. It allows developers to explore different organizations without assuming that documentation must mirror the structure of the code.

**ReviewingDocumentation** independently evaluates a proposed representation and records discussion and decisions. Reviews are performed by developers, who retain responsibility for deciding whether a proposed documentation representation is appropriate.

The concepts separate three different responsibilities. InvestigatingChanges determines what may need to change, RestructuringDocumentation designs how the documentation could represent the system, and ReviewingDocumentation evaluates whether that representation is appropriate. This separation addresses the difficult case where a structural code change can have multiple reasonable documentation outcomes.


- `Investigation` represents a completed investigation that a restructuring responds to
- `Commit` represents a repository commit
- `Documentation` represents a documentation item
- `DocumentationTree` represents the hierarchy connecting documentation items
- `User` represents a developer or reviewer
- `Agent` represents an AI investigator
- `Evidence` represents supporting information such as code references, repository history, issue discussions, or documentation links
- `Restructuring` represents a proposed documentation structure being evaluated by ReviewingDocumentation