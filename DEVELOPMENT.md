# Development and architecture

The application is split into a **NodeJS server** and a **web user interface**.

All dependencies are vendored. Neither the server nor the web interface uses `npm` or a build step.

> <em>Why NodeJS and web?</em><br>Web has the lowest friction for me. The same goes for NodeJS. I like that it is a single binary. Low friction is important so that I don't drop the project.
>
> <em>Why not</em> `npm`<em>?</em><br>This is non-conventional but again the reason is friction. I have been burned too many times so I do not want to be dependent on `npm`. I want no gate keepers between me and the project. The way to do that is to vendor the dependencies and accept the trade-offs. I acknowledge that this may increase the friction for others familiar with the ecosystem.

Note that due to vendoring: Dependencies are updated manually. Dependencies **must** contain version information. Dependencies **must not** be modified during development. Search and other tools may need to ignore dependencies.

## Interfacing with git

Visual Git uses the `git` binary itself to interact with the Git repositories.

> <em>Why use</em> `git` <em> instead of an API?</em><br>
The common alternative is to use `libgit2`. Both were considered but I chose `git` over `libgit2` for a few reasons. `libgit2` is a full rewrite of Git as a library and an API, which veers a bit too far from `git` for me. I started writing Visual Git to help me use Git more efficiently and also as a teaching tool. I want it to be an extension of the command line. Replicating familiar `git` commands in `libgit2` would require significant engineering effort. As of writing `libgit2` is working on their own CLI implementation of Git, which could help, but again I do not want to be dependent on `libgit2` and its progress, I'd rather depend on `git`.

The trade-off from using `git` is that the interface is mostly meant for humans not applications. Another trade-off could be performance but the performance of `git` itself has improved a lot over time and may keep improving.

## NodeJS Server

The server should be as thin a layer as possible between the web user interface and Git. The main reason for this is to leave open the possibility of using Visual Git as a static web app for viewing web-hosted Git repositories.

The server should have low trust in the web user interface. Some trust will be needed for write operations, but this should be configurable. As of writing this is enforced by allow-lists for commands and flags. The reason here is mostly an irrational "it feels bad to just pipe everything through". And also [RCE via argument injection](https://web.archive.org/web/20230930081804/https://snyk.io/blog/argument-injection-when-using-git-and-mercurial/). But mostly an irrational bad feeling.

### Directory layout

|  |  |
| --- | --- |
| `backend/` | Contains the source code for the server. |
| `bin/` | Contains the `vg` command for Windows and Linux. |
| `runtime/` | Currently the location for the `node` binary. |

_Why a dedicated_ `node` _binary?_<br>The same way I do not like messing with `npm`, I would rather just download the binary because I know that it will always work. There may be alternative methods in the future.

## Web user interface

The web user interface is written in modern vanilla HTML, CSS and JavaScript. It targets the most recent Firefox and Chromium browsers.

Parts of the UI are split into Web Components. Shadow DOM is not used. Communication is event-based as opposed to reactive. CSS is all in a single file for now, sorry. CSS variables are used to parametrize the UI. SVG is used for the graph and icons. These are subject to change as the growth of the project requires it.

### Directory layout

The frontend code starts from the `frontend/` directory. It is further split as follows.

|  |  |
| --- | --- |
| `git-interface/` | Code for interfacing with Git. |
| `models/` | Classes such as `Commit` and `Reference`. |
| `ui/` | UI rendering, interactions, animations. May be split further in the future. |
| `vendor/` | Vendored dependencies. |

As of writing the web user interface roughly consists of:

|  |  |
| --- | --- |
| `main.js` | Entrypoint. |
| `graph.js` | For drawing a graph of Git commits and references. |
| `commands.js` | For interfacing with Git. |
| `settings.js` | For providing configurability. |

### Graph implementation

#### Terminology

The graph rendering terminology is differentiated from Git terminology on purpose. In the graph, a `Node` represents a commit and a distinct series of `Node`s form a `Path`. `Path`s often represent branches in Git.

> _Why different terminology?_ <br>The terminology is borrowed from graphs in general. You may think of Git history as flowing in chronological order from the earliest commits to the newest. You "branch out" into the future. But the Git <abbr title="Directed Acyclic Graph">DAG</abbr> is read in reverse chronological order with each commit pointing to its own parent(s). We also render the graph in this reverse chronological order. From the point of view of the DAG and graph rendering, a commit with two or more parents "branches" or diverges towards the past. A `Node` is rendered together with any `Path`s diverging from that node. A Git merge becomes a divergence and branching in Git becomes a convergence of `Path`s. The other reason is to avoid having to use the same naming for different purposes, rendering and version control. Time will tell if this was the correct decision.

#### Algorithm

The graph is rendered in two passes.

The first pass creates `Node`s and places them on `Path`s. It prioritizes `Path`s with an associated name priority such as `main` and otherwise the first encountered `Path`.

The `Path`s are then sorted based on name priority, merge counts and length. Each `Path` is given a column number that avoids overlap with `Node`s in other `Path`s.

In the second pass everything is rendered according to the collected information.
