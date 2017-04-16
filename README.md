# vscode-tradeship [![CircleCI](https://circleci.com/gh/taichi/vscode-tradeship.svg?style=svg)](https://circleci.com/gh/taichi/vscode-tradeship) [![AppVeyor](https://ci.appveyor.com/api/projects/status/fpwar10hwlxiiw7q/branch/master?svg=true)](https://ci.appveyor.com/project/taichi/vscode-tradeship/branch/master)

Extension to integrate [tradeship](https://github.com/karthikv/tradeship) into VSCode.

## Development setup

* run `npm run install:all` inside the **tradeship** folder
* run `npm run watch` inside the **tradeship** folder
* open VS Code on **tradeship** and **tradeship-server**

## Developing the server

* open VS Code on **tradeship-server**
* run `npm run compile` or `npm run watch` to build the server and copy it into the **tradeship** folder
* to debug press F5 which attaches a debugger to the server

## Developing the extension/client

* open VS Code on **tradeship**
* run F5 to build and debug the extension
