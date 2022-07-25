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

function checkScript(packageName, scriptPath, options, indent) {
  const indentSpace = '    '.repeat(indent);
  if (options.compatible.has(packageName)) {
    console.log(`${indentSpace}${VALID_SYMBOL} ${packageName} is ES${options.esVersion} compatible.`);
    return true;
  } else if (options.uncompatible.has(packageName)) {
    console.log(`${indentSpace}${INVALID_SYMBOL} ${packageName} is not ES${options.esVersion} compatible.`);
    return false;
  } else {
    let scriptCode;
    try {
      scriptCode = fs.readFileSync(scriptPath, 'utf8');
    } catch (error) {
      console.log(`${indentSpace}${QUESTION_SYMBOL} ${packageName} has no main script file. `
        + 'Maybe it is not a script library or it has not been compiled.');
      return false;
    }
    try {
      acorn.parse(scriptCode, { ecmaVersion: options.esVersion });
      console.log(`${indentSpace}${VALID_SYMBOL} ${packageName} is ES${options.esVersion} compatible.`);
      options.compatible.add(packageName);
      return true;
    } catch (err) {
      if (options.showError) {
        console.log(`${indentSpace}${INVALID_SYMBOL} ${packageName} is not ES${options.esVersion} compatible:`, err);
      } else {
        console.log(`${indentSpace}${INVALID_SYMBOL} ${packageName} is not ES${options.esVersion} compatible.`);
      }
      options.uncompatible.add(packageName);
      return false;
    }
  }
}

function checkDependencies(packagePath, options, indent) {
  const package = require(resolve(packagePath, 'package.json'));
  const dependencies = Object.keys(package.dependencies || {})
    .concat(Object.keys(package.peerDependencies || {}))
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
      checkDependencies(depDir, options, indent + 1);
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
    console.log(`  ${VALID_SYMBOL} ${pkg}`);
  });
  if (options.uncompatible.size === 0) {
    console.log('No uncompatible packages.');
  } else {
    console.log('All uncompatible packages are: ');
    options.uncompatible.forEach((pkg) => {
      console.log(`  ${INVALID_SYMBOL} ${pkg}`);
    });
  }
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
const showError = args.showError;
const targetFile = args.targetFile;
const options = {
  requireResolvePath,
  esVersion,
  showError,
  compatible: new Set(),
  uncompatible: new Set(),
};
if (targetFile) {
  checkScript(targetFile, targetFile, options, 0);
} else {
  checkEsCompatible(packageName, packagePath, options, 0);
}