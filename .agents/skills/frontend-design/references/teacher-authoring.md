# Teacher Authoring

Use for course creation/editing, lessons, exercises, media, preview, submission, and rejected-course revision.

Direction:

* medium-to-high design latitude: productive, friendly, structured, forgiving, and easy to scan
* spend expressiveness on information architecture, a legible builder, useful data-backed visualization, and fewer unnecessary steps
* personality must support productivity, confidence, content structure, revision, preview, and save/submit flow; do not spend aesthetic boldness on a detail that slows authoring

Prioritize:

* clear page purpose and status
* grouped forms
* visible validation
* save or submit state
* preview before submission
* rejection feedback
* safe destructive actions
* easy navigation across content sections
* a continuous primary creation journey with context preserved across steps, plus convenient direct editing of an individual item

Persistence hierarchy must not dictate the number of UI steps or navigation transitions. The journey need not be one page. Preserve established routes, permissions, and the course/chapter/topic mental model unless a separate approved change owns them. Add charts only when the data supports an accurate authoring decision.

Group long forms by meaning, for example:

```txt
Basic information
Media
Pricing
Lessons
Exercises
Review / Submit
```

Avoid:

* exposing raw database fields
* cold admin-like density
* ambiguous destructive actions
* lost input after errors
* hidden validation
* decoration that distracts from authoring
