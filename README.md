# Visual Git

## Installation

- Download visual git.<br>
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
