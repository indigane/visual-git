# Architecture and development

The application is split into a **NodeJS server** and a **web user interface**.

All dependencies are vendored. Neither the server nor the web interface uses `npm` or a build step.

_Why NodeJS and web?_<br>Web has the lowest friction for me. The same goes for NodeJS, I like that it is a single binary. Low friction is important so that I don't drop the project.

_Why not_ `npm`_?_<br>This is non-conventional but again the reason is friction. I have been burned too many times so I do not want to be dependent on `npm`. I want no gate keepers between me and the project. The way to do that is to vendor the dependencies and accept the trade-offs. I acknowledge that this may increase the friction for others familiar with the ecosystem.

Notable trade-offs from vendored dependencies: Dependencies are updated manually. Dependencies **must** contain version information. Dependencies **must not** be modified during development. Search and other tools may need to ignore dependencies.

## Interfacing with git

Visual Git uses the `git` binary itself to interact with the Git repositories.

The common alternative is to use `libgit2`. Both were considered but I chose `git` over `libgit2` for a few reasons. `libgit2` is a full rewrite of Git as a library and an API, which veers a bit too far from `git` for me. I started writing Visual Git to help me use Git more efficiently and also as a teaching tool. I want it to be an extension of the command line. Replicating familiar `git` commands in `libgit2` would require significant engineering effort. As of writing `libgit2` is working on their own CLI implementation of Git, which could help, but again I do not want to be dependent on `libgit2` and its progress, I'd rather depend on `git`.

The trade-off from using `git` is that the interface is mostly meant for humans not applications. Another trade-off could be performance but the performance of `git` itself has improved a lot over time and may keep improving.

## NodeJS Server

The server should be as thin a layer as possible between the web user interface and Git. The main reason for this is to leave open the possibility of using Visual Git as a static web app for viewing web-hosted Git repositories.

The server should have low trust in the web user interface. Some trust will be needed for write operations, but this should be configurable. As of writing this is enforced by allow-lists for commands and flags. The reason here is mostly an irrational "it feels bad to just pipe everything through". And also [RCE via argument injection](https://web.archive.org/web/20230930081804/https://snyk.io/blog/argument-injection-when-using-git-and-mercurial/). But mostly an irrational bad feeling.

### File layout

|  |  |
| --- | --- |
| `backend/` | Contains the source code for the server. |
| `bin/` | Contains the `vg` command for Windows and Linux. |
| `runtime/` | Currently the location for the `node` binary. |

_Why a dedicated_ `node` _binary?_<br>The same way I do not like messing with `npm`, I would rather just download the binary because I know that it will always work. There may be alternative methods in the future.

## Web user interface

The web user interface is written in modern vanilla HTML, CSS and JavaScript. It targets the most recent Firefox and Chromium browsers.

Parts of the UI are split into Web Components. Shadow DOM is not used. Communication is event-based as opposed to reactive. CSS is all in a single file for now, sorry. CSS variables are used to parametrize the UI. SVG is used for the graph and icons. These are subject to change as the growth of the project requires it.

### File layout

The frontend code starts from the `frontend/` directory. It is further split as follows.

|  |  |
| --- | --- |
| `git-interface/` | Code for interfacing with Git. |
| `models/` | Classes such as `Commit` and `Reference`. |
| `ui/` | UI rendering, interactions, animations. May be split further in the future. |
| `vendor/` | Vendored dependencies. |
| `main.js` | Entrypoint. |
| `utils.js` | Generic code that is not project specific. |

### Code structure

As of writing the web user interface roughly consists of:

- Module for interfacing with Git (`commands.js`).
- Settings module for configurability (`settings.js`).
- Graph module for drawing a graph of Git commits and references (`graph.js`).

These are tied together in the `main.js`.
