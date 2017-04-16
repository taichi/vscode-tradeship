# VS Code tradeship extension

Integrates [tradeship](https://github.com/karthikv/tradeship) into VS Code.
If you are new to tradeship check the [documentation](https://github.com/karthikv/tradeship).

The extension uses the tradeship library installed in the opened workspace folder. If the folder doesn't provide one the
extension looks for a global install version. If you haven't installed tradeship either locally or globally do so by running
`npm install tradeship` in the workspace folder for a local install or `npm install -g tradeship` for a global install.

## Settings Options

* `tradeship.autoFixOnSave`
  * by default is `false`. if you set `true`, Automatically organize imports on save.
* `tradeship.nodePath`
  * use this setting if an installed tradeship package can't be detected, for example `/myGlobalNodePackages/node_modules`.
* `tradeship.trace`
  * Traces the communication between VSCode and the tradeship organize imports service.

## Commands

This extension contributes the following commands to the Command palette.

* Organize imports
  * statically analyzes your JavaScript code for identifiers that aren't defined and finds the appropriate dependencies to import.

## Release Notes

### 0.1.0
* Initial Release
