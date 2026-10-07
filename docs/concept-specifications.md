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
&emsp;**where** investigation exists and documentation is not already associated with it
\
&emsp;**then** adds documentation to the investigation's affectedDocumentation set

record(investigation: Investigation, evidence: Evidence)
\
&emsp;**where** investigation exists
\
&emsp;**then** adds evidence to the investigation's evidence set

complete(investigation: Investigation)
\
&emsp;**where** investigation exists and its status is open
\
&emsp;**then** changes the investigation's status to complete


## Concept 2: RestructuringDocumentation

**concept** RestructuringDocumentation
\
**types** Commit, Documentation, DocumentationTree
\
**purpose** allow developers to construct and justify alternative documentation structures in response to a set of commits without requiring documentation to mirror the code structure
\
**principle**
after creating a restructuring proposal,
\
&emsp;the proposal preserves the current documentation structure
\
&emsp;and allows the developer to construct and justify an alternative structure

**state**
a set of Restructurings with
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
create(commits: set of Commit, currentStructure: DocumentationTree, rationale: String): (restructuring: Restructuring)
\
&emsp;**where** currentStructure exists
\
&emsp;**then** creates a restructuring with currentStructure as its initial proposedStructure, the given rationale, and status draft

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

revise(restructuring: Restructuring, proposedStructure: DocumentationTree, rationale: String)
\
&emsp;**where** restructuring exists and its status is underReview
\
&emsp;**then** replaces the proposedStructure, updates the rationale, and changes the status to draft

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
&emsp;and approves the proposal or requests changes

**state**
a set of Reviews with
\
&emsp;proposal Restructuring
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
create(proposal: Restructuring, reviewer: User): (review: Review)
\
&emsp;**where** no review exists for the proposal and reviewer
\
&emsp;**then** creates a review with empty comments and suggestions and decision pending

comment(review: Review, comment: Comment)
\
&emsp;**where** review exists and its decision is pending
\
&emsp;**then** adds the comment to the review's comments set

suggest(review: Review, suggestion: Suggestion)
\
&emsp;**where** review exists and its decision is pending
\
&emsp;**then** adds the suggestion to the review's suggestions set

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

# Essential Reactions

**reaction** createProposal
\
**where**
\
&emsp;InvestigatingChanges completes an investigation
\
**then**
\
&emsp;RestructuringDocumentation creates a restructuring for the investigation's commits

The investigation identifies potentially affected documentation and provides the evidence that informs the developer's restructuring proposal.

**reaction** submitForReview
\
**where**
\
&emsp;RestructuringDocumentation submits a restructuring
\
**then**
\
&emsp;ReviewingDocumentation creates a review for the restructuring

When a user submits a restructuring, the proposed representation should be available for independent evaluation.

**reaction** requestRevision
\
**where**
\
&emsp;ReviewingDocumentation requests changes to a restructuring
\
**then**
\
&emsp;RestructuringDocumentation revises the restructuring

The reviewer records concerns without modifying the proposal, allowing the developer to revise the proposed representation in response to feedback.


# Role of Concepts

**InvestigatingChanges** determines which documentation may need reconsideration and records the evidence supporting that assessment. Both developers and AI agents can investigate changes. It does not decide how documentation should be reorganized.

**RestructuringDocumentation** allows users to propose alternative representations of the documentation structure. It allows developers to explore different organizations without assuming that documentation must mirror the structure of the code.

**ReviewingDocumentation** independently evaluates a proposed representation and records discussion and decisions. Reviews are performed by developers, who retain responsibility for deciding whether a proposed documentation representation is appropriate.

The concepts separate three different responsibilities. InvestigatingChanges determines what may need to change, RestructuringDocumentation designs how the documentation could represent the system, and ReviewingDocumentation evaluates whether that representation is appropriate. This separation addresses the difficult case where a structural code change can have multiple reasonable documentation outcomes.


- `Commit` represents a repository commit
- `Documentation` represents a documentation item
- `DocumentationTree` represents the hierarchy connecting documentation items
- `User` represents a developer or reviewer
- `Agent` represents an AI investigator
- `Evidence` represents supporting information such as code references, repository history, issue discussions, or documentation links
- `Restructuring` represents a proposed documentation structure being evaluated by ReviewingDocumentation