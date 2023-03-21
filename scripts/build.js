#!/usr/bin/env node

import Path from 'node:path';
import Fs from 'node:fs/promises';
import glob from 'fast-glob';
import swc from '@swc/core';

const exportImportNodes = [
  'ExportAllDeclaration',
  'ExportDeclaration',
  'ExportDefaultDeclaration',
  'ExportDefaultExpression',
  'ExportDefaultSpecifier',
  'ExportNamedDeclaration',
  'ExportNamespaceSpecifier',
  'ExportSpecifier',
  'ImportDeclaration',
  'ImportDefaultSpecifier',
  'ImportNamespaceSpecifier',
  'ImportSpecifier',
];

const isLocalFile = /^\.{0,2}\//;

const isFileExportImport = (node) => {
  return (
    (exportImportNodes.includes(node.type) && node.source?.type === 'StringLiteral' && isLocalFile.test(node.source.value)) ||
    (node.expression?.type === 'StringLiteral' && isLocalFile.test(node.expression.value))
  );
};

const setNodeExtension = (node, extenstion) => {
  node.value = `${node.value}.${extenstion}`;
  node.raw = JSON.stringify(node.value);
};

const forceExtension = (module, extenstion) => {
  for (const node of module.body) {
    if (isFileExportImport(node)) {
      switch (true) {
        case !!node.source:
          {
            setNodeExtension(node.source, extenstion);
          }
          break;
        case !!node.expression:
          {
            setNodeExtension(node.expression, extenstion);
          }
          break;
      }
    }
  }
  return module;
};

const cjsConfig = {
  module: {
    type: 'commonjs',
    strict: true,
  },
  jsc: {
    target: 'es5',
    parser: {
      syntax: 'typescript',
    },
  },
  plugin: (module) => {
    forceExtension(module, 'cjs');
    return module;
  },
};

const mjsConfig = {
  module: {
    type: 'es6',
    strict: true,
  },
  jsc: {
    target: 'es2022',
    parser: {
      syntax: 'typescript',
    },
  },
  plugin: (module) => {
    forceExtension(module, 'js');
    return module;
  },
};

const compile = async (sourceFile, destinationFile, config) => {
  const destinationMapFile = `${destinationFile}.map`;
  const output = await swc.transformFile(sourceFile, {
    ...config,
    filename: sourceFile,
    isModule: true,
    sourceMaps: true,
  });

  await Fs.mkdir(Path.dirname(destinationFile), { recursive: true });
  await Fs.writeFile(destinationFile, `${output.code}\n//# sourceMappingURL=${Path.basename(destinationMapFile)}\n`);
  await Fs.writeFile(destinationMapFile, output.map);
};

(async () => {
  const sourceFiles = await glob('**/*.ts', { ignore: ['**/__tests__/**/*.ts', '*.tmp.ts'], cwd: 'src' });
  for (const filename of sourceFiles) {
    const sourceFile = `src/${filename}`;
    const destinationFileCjs = `build/${Path.basename(filename, '.ts')}.cjs`;
    const destinationFileMjs = `build/${Path.basename(filename, '.ts')}.js`;
    await compile(sourceFile, destinationFileCjs, cjsConfig);
    await compile(sourceFile, destinationFileMjs, mjsConfig);
  }
})().catch((e) => console.error(e));
