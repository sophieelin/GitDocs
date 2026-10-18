# Investigations

An investigation is one shared place to look at a repository's commit. The
repository is a shared workspace, so its investigations belong to everyone who
opens it, and each request is resolved through its active session first.

A current account may [open an investigation of a commit](reaction:Investigations.Opening.OpenInvestigation)
in a repository. The application supplies the signed-in username as the
investigator and the moment of the request as when it was opened, so a caller
can choose neither. Opening a commit that already has an investigation in that
repository, by anyone, answers that same investigation.

```endpoints
Investigations.Opening.OpenInvestigation at /investigations/open
```

A current account may [read an investigation](reaction:Investigations.Reading.GetInvestigation):
its repository, commit, who opened it, and when. An investigation that does not
exist answers `INVESTIGATION_NOT_FOUND`, rather than leaving the request
unanswered.

```endpoints
Investigations.Reading.GetInvestigation at /investigations/get
```

A current account may [list a repository's investigations](reaction:Investigations.Reading.ListInvestigations).
The answer uses [the repository's investigations](former:Investigations.Reading.RepositoryInvestigations):
every investigation in it, the most recently opened first, each with its
commit, who opened it, and when. A repository with no investigations answers an
empty list.

```endpoints
Investigations.Reading.ListInvestigations at /investigations/list
```
