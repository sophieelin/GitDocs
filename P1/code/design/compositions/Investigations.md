# Investigations

An investigation is a developer's written case about one commit of a
repository: which documentation needs to change, why, and the evidence. The
repository is a shared workspace, so its investigations belong to everyone who
opens it, and each request is resolved through its active session first.

A current account may [submit an investigation of a commit](reaction:Investigations.Submitting.SubmitInvestigation)
with a title, the affected documentation files each with a reason, and the
evidence. The application supplies the signed-in username as the investigator
and the moment of the request as when it was submitted, so a caller can choose
neither. Nothing is recorded before this request: opening the draft in the
browser saves nothing. A commit can have many investigations, and a submitted
investigation does not change.

```endpoints
Investigations.Submitting.SubmitInvestigation at /investigations/submit
```

A current account may [read an investigation](reaction:Investigations.Reading.GetInvestigation).
The answer is [the investigation with its affected documentation and evidence](former:Investigations.Reading.InvestigationDetail):
its repository, commit, investigator, title, and when it was submitted, then
each affected file with its reason and each evidence item, in the order given.
An investigation that does not exist answers `INVESTIGATION_NOT_FOUND`, rather
than leaving the request unanswered.

```endpoints
Investigations.Reading.GetInvestigation at /investigations/get
```

A current account may [list a repository's investigations](reaction:Investigations.Reading.ListInvestigations),
using [the repository's investigations](former:Investigations.Reading.RepositoryInvestigations),
or [list one commit's investigations](reaction:Investigations.Reading.ListCommitInvestigations),
using [the commit's investigations](former:Investigations.Reading.CommitInvestigations).
Both answer the most recently submitted first, each with its title, who
submitted it, and when; an empty list when there are none.

```endpoints
Investigations.Reading.ListInvestigations at /investigations/list
Investigations.Reading.ListCommitInvestigations at /investigations/for-commit
```
