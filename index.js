#!/usr/bin/env node
////////////////////////////////////////////////////////////////////////////////
//
//    Copyright (c) 2022 - 2023.
//    Haixing Hu, Qubit Co. Ltd.
//
//    All rights reserved.
//
////////////////////////////////////////////////////////////////////////////////

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
const INDENT_SPACE = '  ';
const IGNORE_FILE_EXTENSIONS = ['.css', '.less', '.scss', '.style'];
const JAVASCRIPT_FILE_EXTENSIONS = ['.js', '.cjs'];

function outputCompatible(packageName, options, indent) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  console.info(`${indentSpace}${VALID_SYMBOL} ${packageName} is ES${options.esVersion} compatible.`);
}

function outputIncompatible(packageName, options, indent, error) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  if (options.showError && error) {
    console.error(`${indentSpace}${INVALID_SYMBOL} ${packageName} is NOT ES${options.esVersion} compatible:`, error.message);
  } else {
    console.error(`${indentSpace}${INVALID_SYMBOL} ${packageName} is NOT ES${options.esVersion} compatible.`);
  }
}

function outputCannotOpen(packageName, indent) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  console.error(`${indentSpace}${QUESTION_SYMBOL} ${packageName} has no main script file. `);
}

function outputNonJs(packageName, indent) {
  const indentSpace = INDENT_SPACE.repeat(indent);
  console.info(`${indentSpace}${VALID_SYMBOL} ${packageName} is not a JavaScript library, ignore it.`);
}

function shouldIgnore(path) {
  if (path) {
    for (const ext of IGNORE_FILE_EXTENSIONS) {
      if (path.endsWith(ext)) {
        return true;
      }
    }
  }
  return false;
}

function isJavascriptFile(path) {
  if (path) {
    for (const ext of JAVASCRIPT_FILE_EXTENSIONS) {
      if (path.endsWith(ext)) {
        return true;
      }
    }
  }
  return false;
}

function checkScript(packageName, scriptPath, options, indent) {
  if (shouldIgnore(scriptPath)) {
    if (options.showDependencyTree) {
      outputNonJs(packageName, indent);
    }
    options.nonJs.add(packageName);
    return true;
  }
  let scriptCode;
  try {
    scriptCode = fs.readFileSync(scriptPath, 'utf8');
  } catch (error) {
    if (options.showDependencyTree) {
      outputCannotOpen(packageName, indent);
    }
    options.canNotOpen.add(packageName);
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
      outputIncompatible(packageName, options, indent, error);
    }
    options.incompatible.add(packageName);
    options.incompatibleErrors.set(packageName, error);
    return false;
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
    options.canNotOpen.add(packageName);
    return false;
  }
  let dependencies = Object.keys(packageInfo.dependencies || {});
  if (options.checkPeerDependency) {
    dependencies = dependencies.concat(Object.keys(packageInfo.peerDependencies || {}));
  }
  dependencies = dependencies.sort();
  // console.info('Checking the following list of dependencies: ', dependencies);
  dependencies.forEach((dep) => {
    if (options.compatible.has(dep)) {
      if (options.showDependencyTree) {
        outputCompatible(dep, options, indent);
      }
      return true;
    } else if (options.incompatible.has(dep)) {
      if (options.showDependencyTree) {
        outputIncompatible(dep, options, indent);
      }
      return false;
    } else if (options.canNotOpen.has(dep)) {
      if (options.showDependencyTree) {
        outputCannotOpen(dep, indent);
      }
      return false;
    } else if (options.nonJs.has(dep)) {
      if (options.showDependencyTree) {
        outputNonJs(dep, indent);
      }
      return true;
    } else {
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
    }
  });
}

function checkEsCompatible(packageName, packagePath, options, indent) {
  const pkg = require(resolve(packagePath, 'package.json'));
  if (packageName === '.') {
    packageName = pkg.name;
  }
  const mainScriptPath = (pkg.main ? resolve(packagePath, pkg.main) : null);
  checkScript(packageName, mainScriptPath, options , indent);
  checkDependencies(packageName, packagePath, options, indent + 1);
  console.info('All compatible packages are: ');
  options.compatible.forEach((pkg) => {
    outputCompatible(pkg, options, 1);
  });
  if (options.nonJs.size > 0) {
    console.info('All non-JavaScript packages are: ');
    options.nonJs.forEach((pkg) => {
      outputNonJs(pkg, 1);
    });
  }
  if (options.incompatible.size === 0) {
    console.info('No incompatible packages.');
  } else {
    console.info('All incompatible packages are: ');
    options.incompatible.forEach((pkg) => {
      const error = options.incompatibleErrors.get(pkg);
      outputIncompatible(pkg, options, 1, error);
    });
  }
  if (options.canNotOpen.size > 0) {
    console.info('The following packages have no main script or cannot be read:')
    options.canNotOpen.forEach((pkg) => {
      outputCannotOpen(pkg, 1);
    });
  }
  return (options.incompatible.size === 0);
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
    description: 'The resolve path for dependent packages.',
    type: String,
    default: '.',
  })
  .option('show-dependency-tree', {
    alias: 't',
    description: 'Whether to show the dependency tree.',
    type: String,
    default: 'false',
  })
  .option('show-error', {
    alias: 's',
    description: 'Whether to show the detailed errors.',
    type: String,
    default: 'false',
  })
  .option('check-peer-dependency', {
    alias: 'c',
    description: 'Whether to check the peer dependency.',
    type: String,
    default: 'false',
  })
  .option('target-file', {
    alias: 'f',
    description: 'Check the specified target file.',
    type: String,
    default: '',
  })
  .option('target-dir', {
    alias: 'd',
    description: 'Check all JavaScript files in the target directory.',
    type: String,
    default: '',
  })
  .help()
  .alias('help', 'h')
  .argv;

const esVersion = args.esVersion;
const requireResolvePath = args.requireResolvePath;
const packageName = args.packageName;
const packagePath = (packageName === '.' ? '.' : resolve(requireResolvePath, `node_modules/${packageName}`));
const showDependencyTree = (args.showDependencyTree === 'true');
const showError = (args.showError === 'true');
const checkPeerDependency = (args.checkPeerDependency === 'true');
const targetFile = args.targetFile;
const targetDir = args.targetDir;
const options = {
  requireResolvePath,
  esVersion,
  showError,
  showDependencyTree,
  checkPeerDependency: checkPeerDependency,
  compatible: new Set(),
  incompatible: new Set(),
  nonJs : new Set(),
  canNotOpen: new Set(),
  incompatibleErrors: new Map(),
};

// console.info(args);

if (targetFile) {
  options.showDependencyTree = true;
  checkScript(targetFile, targetFile, options, 0);
} else if (targetDir) {
  console.info(`Checking all JavaScript files in ${targetDir} ...`);
  options.showDependencyTree = true;
  fs.readdir(targetDir, (error, files) => {
    if (error) {
      console.error(`Cannot open the directory ${targetDir}.`);
    } else {
      files.forEach((file) => {
        if (isJavascriptFile(file)) {
          const path = resolve(targetDir, file);
          checkScript(path, path, options, 0);
        }
      });
    }
  });
} else {
  checkEsCompatible(packageName, packagePath, options, 0);
}
