# Visual Git

Visual Git is the Git GUI I've wished existed so I wouldn't have to write it myself.

Some ideas Visual Git may or may not be built on:

- **See everything** you need without polling. Reduce mistakes by being aware of the state of your repository at all times.
- **Interact with everything** you see. You should be allowed to do anything, while staying informed of the consequences of any action.
- **Learn** git. Start from visually intuitive concepts and drill down all the way into git internals if you want to.


## Installation

- Download Visual Git.<br>
  _For example:_
  ```sh
  git clone https://gitlab.com/indigane/visual-git.git
  ```
- [Download node binary](https://nodejs.org/en/download) and place it in `runtime/`. Node 20 recommended.<br>
  _For example:_
  ```sh
  cd visual-git
  curl -L https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz | tar -Jxv --strip-components=2 -C runtime -f - node-v20.11.1-linux-x64/bin/node
  ```
- If you want to use a `vg` command, add `visual-git/bin/` to PATH:<br>
  _For example temporarily:_
  ```sh
  cd visual-git
  export PATH=$PATH:$PWD/bin
  ```
- Alternatively add `visual-git/bin/vg` as a git alias:<br>
  _For example:_
  ```sh
  cd visual-git
  git config --global alias.vg '!'$PWD/bin/vg
  ```

## Usage

- Run `vg` in a git repository.
- Alternatively run `vg <path-to-repository>`.


## Using with docker

Build container with following command

```
docker build -t visualgit .
```

Start docker with following command in repository directory

```
docker run --rm -i -t -v .:/home/vision/repo -p 3000:3000 visualgit
```

