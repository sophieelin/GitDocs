# InvestigatingChanges

## Purpose

Identify documentation that may need reconsideration when a set of commits
changes the structure or responsibilities of the system.

## Principle

After investigating a set of commits, the investigation records potentially
affected documentation and evidence connecting the commits to that
documentation. If the investigator later finds that a document was flagged by
mistake or a piece of evidence does not hold up, they remove it before
completing the investigation.

## Types

```types
external Commit
  A repository commit.
external Documentation
  A documentation item.
external Evidence
  Supporting information such as code references, repository history, issue
  discussions, or documentation links.
external Investigator
  A developer or an AI agent investigating the commits.
Status is OPEN or COMPLETE
  The lifecycle states an investigation may occupy.
```

## State

```state
a set of Investigations with
  a commits set of Commits
  an author Investigator
  an affectedDocumentation set of Documentation
  an evidence set of Evidence
  a status Status
  unique commits and author
```

## Actions

```actions
identify(commits: Commits, investigator: Investigator) : returns (investigation: Investigation)
  where no investigation has the commits and investigator as author
  then
    add a new investigation with commits, investigator as author, empty affectedDocumentation and evidence, and status OPEN
    returns investigation
  where some investigation has the commits and investigator as author
  then
    refuses INVESTIGATION_EXISTS "This investigator already has an investigation for these commits."

associate(investigation: Investigation, documentation: Documentation) : returns ()
  where investigation is in Investigations and documentation is not in its affectedDocumentation
  then
    add documentation to the investigation's affectedDocumentation
    returns
  where investigation is not in Investigations
  then
    refuses ASSOCIATE_INVESTIGATION_NOT_FOUND "There is no such investigation."
  where documentation is in the investigation's affectedDocumentation
  then
    refuses DOCUMENTATION_ALREADY_ASSOCIATED "This documentation is already associated with the investigation."

dissociate(investigation: Investigation, documentation: Documentation) : returns ()
  where investigation is in Investigations, its status is OPEN, and documentation is in its affectedDocumentation
  then
    remove documentation from the investigation's affectedDocumentation
    returns
  where investigation is not in Investigations
  then
    refuses DISSOCIATE_INVESTIGATION_NOT_FOUND "There is no such investigation."
  where the investigation's status is COMPLETE
  then
    refuses DISSOCIATE_INVESTIGATION_COMPLETE "A completed investigation can no longer be changed."
  where documentation is not in the investigation's affectedDocumentation
  then
    refuses DOCUMENTATION_NOT_ASSOCIATED "This documentation is not associated with the investigation."

record(investigation: Investigation, evidence: Evidence) : returns ()
  where investigation is in Investigations
  then
    add evidence to the investigation's evidence
    returns
  where investigation is not in Investigations
  then
    refuses RECORD_INVESTIGATION_NOT_FOUND "There is no such investigation."

retract(investigation: Investigation, evidence: Evidence) : returns ()
  where investigation is in Investigations, its status is OPEN, and evidence is in its evidence
  then
    remove evidence from the investigation's evidence
    returns
  where investigation is not in Investigations
  then
    refuses RETRACT_INVESTIGATION_NOT_FOUND "There is no such investigation."
  where the investigation's status is COMPLETE
  then
    refuses RETRACT_INVESTIGATION_COMPLETE "A completed investigation can no longer be changed."
  where evidence is not in the investigation's evidence
  then
    refuses EVIDENCE_NOT_RECORDED "This evidence is not recorded on the investigation."

complete(investigation: Investigation) : returns ()
  where investigation is in Investigations and its status is OPEN
  then
    set the investigation's status to COMPLETE
    returns
  where investigation is not in Investigations
  then
    refuses COMPLETE_INVESTIGATION_NOT_FOUND "There is no such investigation."
  where the investigation's status is COMPLETE
  then
    refuses INVESTIGATION_ALREADY_COMPLETE "This investigation is already complete."
```

## Queries

```queries
```
