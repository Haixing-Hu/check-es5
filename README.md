# check-es-version

A tool used to **recursively** check the ECMAScript compatibility of a
JavaScript package and all its dependencies.

## Installation

```
yarn add --dev check-es-version
```

## Usage

```
check-es-version --es-version=<esVersion> \
  --package-name=<packageName> \
  --require-resolve-path=<requireResolvePath> \
  --show-dependency-tree=<showDependencyTree> \
  --show-error=<showError> \
  [--target-file=<targetFile>]
```

where

- `esVersion`: The ECMAScript compatibility version to check. Default value is 5.
- `packageName`: The name of the package to check. Default value is ".", indicating
the package in the current directory.
- `requireResolvePath`: The path where to resolve the dependent packages. Default value
is ".", indicating the program will try to resolve the path of the dependent packages
in the "./node_modules" directory.
- `showDependencyTree`: Whether to display the dependency tree. Default value is `true`.
If the project has a very deep dependency tree, display the dependency tree may
cause an unreadable output.
- `showError`: Whether to display the detailed errors. Default value is `false`.
It it is set to `true`, the detailed parsing errors of each uncompatible packages
will be displayed.
- `targetFile`: If this argument is specified, the program will check the
compatibility of the specified target JavaScript file.
- `--help` or `-h`: Show the command line help messages.

## Examples

First execute the following command to install the package:
```
yarn add --dev check-es-version
```

Then add the following command in the `package.json`:

```
"scripts": {
  ...
  "es5": "./node_modules/.bin/check-es-version -e 5 -p .",
  ...
}
```

Now you can use `yarn es5` to check the ES5 compatibility of your library and all
its dependencies.

If you project is not a library, for example, a `Quasar` App. You can add the
following command to your `package.json`:

```
"scripts": {
  ...
  "es5": "for f in ./dist/spa/js/*.js; do ./node_modules/.bin/check-es-version -e 5 -f $f; done",
  "es5:dep": "./node_modules/.bin/check-es-version -e 5 -p .",
  ...
}
```

The first command `yarn es5` will check the compatibility of all compilied
JavaScript files of your App. If you find some JS file is uncompatible, you can
execute the second command `yarn es5:dep` to check the compatibility of all
dependencies of your App. If you find some dependency is uncompatible to ES5,
you can add it to the `build.transpileDependencies` section of `quasar.conf.js`.
