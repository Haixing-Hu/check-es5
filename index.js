#!/usr/bin/env node

/*******************************************************************************
 *
 * A tool used to **recursively** check the ECMAScript compatibility of a
 * JavaScript package and all its dependencies.
 *
 * Author: Haixing Hu
 * URL: https://github.com/Haixing-Hu/check-es-version
 *
 *******************************************************************************/

const resolve = require('path').resolve;
const fs = require('fs');
const acorn = require('acorn');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const QUESTION_SYMBOL = '❓';
const VALID_SYMBOL = '✅';
const INVALID_SYMBOL = '❌';
const INDENT_SPACE = '    ';

function outputCompatible(packageName, options, indent) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  console.log(`${indentSpace}${VALID_SYMBOL} ${packageName} is ES${options.esVersion} compatible.`);
}

function outputUncompatible(packageName, options, indent, error) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  if (options.showError && error) {
    console.log(`${indentSpace}${INVALID_SYMBOL} ${packageName} is NOT ES${options.esVersion} compatible:`, error);
  } else {
    console.log(`${indentSpace}${INVALID_SYMBOL} ${packageName} is NOT ES${options.esVersion} compatible.`);
  }
}

function outputCannotOpen(packageName, indent) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  console.log(`${indentSpace}${QUESTION_SYMBOL} ${packageName} has no main script file. `
    + 'Maybe it is not a script library or it has not been compiled.');
}

function checkScript(packageName, scriptPath, options, indent) {
  if (options.compatible.has(packageName)) {
    if (options.showDependencyTree) {
      outputCompatible(packageName, options, indent);
    }
    return true;
  } else if (options.uncompatible.has(packageName)) {
    if (options.showDependencyTree) {
      outputUncompatible(packageName, options, indent);
    }
    return false;
  } else if (options.cannotopen.has(packageName)) {
    if (options.showDependencyTree) {
      outputCannotOpen(packageName, indent);
    }
  } else {
    let scriptCode;
    try {
      scriptCode = fs.readFileSync(scriptPath, 'utf8');
    } catch (error) {
      if (options.showDependencyTree) {
        outputCannotOpen(packageName, indent);
      }
      options.cannotopen.add(packageName);
      return false;
    }
    try {
      acorn.parse(scriptCode, { ecmaVersion: options.esVersion });
      if (options.showDependencyTree) {
        outputCompatible(packageName, options, indent);
      }
      options.compatible.add(packageName);
      return true;
    } catch (error) {
      if (options.showDependencyTree) {
        outputUncompatible(packageName, options, indent, error);
      }
      options.uncompatible.add(packageName);
      options.uncompatibleErrors.set(packageName, error);
      return false;
    }
  }
}

function checkDependencies(packageName, packagePath, options, indent) {
  let packageInfo;
  try {
    packageInfo = require(resolve(packagePath, 'package.json'));
  } catch (error) {
    if (options.showDependencyTree) {
      outputCannotOpen(packageName, indent);
    }
    options.cannotopen.add(packageName);
    return false;
  }
  const dependencies = Object.keys(packageInfo.dependencies || {})
    .concat(Object.keys(packageInfo.peerDependencies || {}))
    .sort();
  // console.log('Checking the following list of dependencies: ', dependencies);
  dependencies.forEach((dep) => {
    let scriptPath = null;
    try {
      scriptPath = require.resolve(dep, { paths: [ options.requireResolvePath ] });
    } catch (error) {
      scriptPath = null;
    }
    if (!checkScript(dep, scriptPath, options, indent)) {
      const depDir = resolve(options.requireResolvePath, `node_modules/${dep}`);
      checkDependencies(dep, depDir, options, indent + 1);
    }
  });
}

function checkEsCompatible(packageName, packagePath, options, indent) {
  const package = require(resolve(packagePath, 'package.json'));
  if (packageName === '.') {
    packageName = package.name;
  }
  const mainScriptPath = (package.main ? resolve(packagePath, package.main) : null);
  checkScript(packageName, mainScriptPath, options , indent);
  checkDependencies(packagePath, options, indent + 1);
  console.log('All compatible packages are: ');
  options.compatible.forEach((pkg) => {
    outputCompatible(pkg, options, 1);
  });
  if (options.uncompatible.size === 0) {
    console.log('No uncompatible packages.');
  } else {
    console.log('All uncompatible packages are: ');
    options.uncompatible.forEach((pkg) => {
      const error = options.uncompatibleErrors.get(pkg);
      outputUncompatible(pkg, options, 1, error);
    });
  }
  options.cannotopen.forEach((pkg) => {
    outputCannotOpen(pkg, 1);
  });
  return (options.uncompatible.size === 0);
}

const args = yargs(hideBin(process.argv))
  .option('es-version', {
    alias: 'e',
    description: 'The ECMAScript version to check',
    type: Number,
    default: 5,
  })
  .option('package-name', {
    alias: 'p',
    description: 'The name of the package to check, or "." to check the current package.',
    type: String,
    default: '.',
  })
  .option('require-resolve-path', {
    alias: 'r',
    description: 'The resolve path for depdendent packages.',
    type: String,
    default: '.',
  })
  .option('show-dependency-tree', {
    alias: 't',
    description: 'Whether to show the dependency tree.',
    type: Boolean,
    default: true,
  })
  .option('show-error', {
    alias: 's',
    description: 'Whether to show the detailed errors.',
    type: Boolean,
    default: false,
  })
  .option('target-file', {
    alias: 'f',
    description: 'Check the specified target file.',
    type: Boolean,
    default: '',
  })
  .help()
  .alias('help', 'h')
  .argv;

const esVersion = args.esVersion;
const requireResolvePath = args.requireResolvePath;
const packageName = args.packageName;
const packagePath = (packageName === '.' ? '.' : resolve(requireResolvePath, `node_modules/${packageName}`));
const showDependencyTree = args.showDependencyTree;
const showError = args.showError;
const targetFile = args.targetFile;
const options = {
  requireResolvePath,
  esVersion,
  showError,
  showDependencyTree,
  compatible: new Set(),
  uncompatible: new Set(),
  cannotopen: new Set(),
  uncompatibleErrors: new Map(),
};
if (targetFile) {
  options.showDependencyTree = true;
  checkScript(targetFile, targetFile, options, 0);
} else {
  checkEsCompatible(packageName, packagePath, options, 0);
}
