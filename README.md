# check-es-version

A tool used to **recursively** check the ECMAScript compatibility of a
JavaScript package and all its dependencies.

## Usage

```
check-es-version --es-version=<esVersion> --package-name=<packageName> --require-resolve-path=<requireResolvePath> --show-error=<showError>
```

where

- `esVersion`: The ECMAScript compatibility version to check. Default value is 5.
- `packageName`: The name of the package to check. Default value is ".", indicating
the package in the current directory.
- `requireResolvePath`: The path where to resolve the dependent packages. Default value
is ".", indicating the program will try to resolve the path of the dependent packages
in the "./node_modules" directory.
- `showError`: Whether to display the detailed errors. Default value is `false`.
It it is set to `true`, the detailed parsing errors of each uncompatible packages
will be displayed.
- `--help` or `-h`: Show the command line help messages.

