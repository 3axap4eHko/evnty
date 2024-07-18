import { readFile, writeFile } from 'node:fs/promises';
import { print } from 'recast';
import { parse, TSESTree, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';

const fileName = `${process.cwd()}/${process.argv[2]}`;

const sourceCode = await readFile(fileName, 'utf-8');

interface Member {
  args: string[]
  returnType: string;
  docs: string[];
}

interface Namespace {
  name: string;
  members: Map<string, Member[]>;
  docs: string[];
}

class ASTVisitor {
  docs: Namespace[] = [{
    name: ``,
    members: new Map(),
    docs: [],
  }];
  ast?: TSESTree.Program;
  lastNode: TSESTree.Node = ast;

  debug = false;

  setLastNode(n: TSESTree.Node) {
    this.lastNode = n;
  }

  getNodeComments(node: TSESTree.Node) {
    return this.ast?.comments
      ?.filter(comment => comment.range[0] >= this.lastNode.range[1] && comment.range[1] <= node.range[0])
      .map(comment => comment.value
        .replace(/( +\*|\*\n)/g, '')
        .replace(/( *\@\w+)/g, '-$1')
      ) ?? [];
  }
  visit(n: TSESTree.Node) {
    switch (n.type) {
      case AST_NODE_TYPES.Program: {
        this.visitProgram(n);
      } break;
    }
  }
  visitProgram(program: TSESTree.Program) {
    this.ast = program;

    for (const node of program.body) {
      this.visitProgramStatement(node);
    }
  }
  visitProgramStatement(n: TSESTree.ProgramStatement) {
    switch (n.type) {
      case AST_NODE_TYPES.ExportNamedDeclaration: {
        this.visitExportNamedDeclaration(n);
      } break;
      case AST_NODE_TYPES.ExportDefaultDeclaration: {

      } break;
      default: {
        console.error(n.type);
      };
    }
    this.setLastNode(n);
  }
  visitExportNamedDeclaration(n: TSESTree.ExportNamedDeclaration) {
    switch (n.declaration?.type) {
      case AST_NODE_TYPES.ClassDeclaration: {
        this.visitClassDeclaration(n.declaration);
      } break;
      case AST_NODE_TYPES.TSInterfaceDeclaration: {
        this.visitTSInterfaceDeclaration(n.declaration);
      } break;
      case AST_NODE_TYPES.TSTypeAliasDeclaration: {

      } break;
      case AST_NODE_TYPES.VariableDeclaration: {
        this.visitVariableDeclaration(n.declaration);
      } break;
      default: {
        console.error(n.declaration?.type);
      };
    }
  }
  visitVariableDeclaration(n: TSESTree.VariableDeclaration) {
    for (const declaration of n.declarations) {
      switch (declaration.type) {
        case AST_NODE_TYPES.VariableDeclarator: {
          this.visitVariableDeclarator(declaration);
        } break;
        default: {
          console.error(declaration.type);
        }
      }
    }
    this.setLastNode(n);
  }
  visitVariableDeclarator(n: TSESTree.VariableDeclarator) {
    let name = ``;
    switch (n.id.type) {
      case AST_NODE_TYPES.Identifier: {
        name += n.id.name;
      } break;
    }
    this.docs[0].members.set(name, []);
    switch (n.init?.type) {
      case AST_NODE_TYPES.ArrowFunctionExpression: {
        this.docs[0].members.get(name)?.push({
          ...this.getFunctionExpressionDoc(n.init),
          docs: this.getNodeComments(n),
        })
      } break;
    }
    this.setLastNode(n);
  }
  visitTSInterfaceDeclaration(n: TSESTree.TSInterfaceDeclaration) {
    this.setLastNode(n);
  }
  visitClassDeclaration(n: TSESTree.ClassDeclaration) {
    this.docs.push({
      name: `${n.id?.name}`,
      members: new Map(),
      docs: this.getNodeComments(n),
    });

    this.visitClassBody(n.body);
    this.setLastNode(n);
  }
  visitClassBody(n: TSESTree.ClassBody) {
    for (const member of n.body) {
      switch (member.type) {
        case AST_NODE_TYPES.PropertyDefinition: {
          this.visitPropertyDefinition(member);
        } break;
        case AST_NODE_TYPES.MethodDefinition: {
          this.visitMethodDefinition(member);
        } break;
        default: {
          this.setLastNode(member);
        }
      }
    }
    this.setLastNode(n);
  }
  visitPropertyDefinition(n: TSESTree.PropertyDefinition) {
    this.setLastNode(n);
  }

  getFunctionExpressionDoc(n: TSESTree.FunctionExpression | TSESTree.TSEmptyBodyFunctionExpression | TSESTree.ArrowFunctionExpression) {
    return {
      args: n.params.map(param => {
        try {
          return print(param).code;
        } catch (e) {
          switch (param.type) {
            case AST_NODE_TYPES.Identifier: {
              return param.name;
            }
            default: {
              return ``;
            }
          }
        }
      }),
      returnType: (() => {
        try {
          if (n.returnType) {
            return print(n.returnType).code;
          }
          return ``;
        } catch (e) {
          return ``;
        }
      })(),
    };
  }

  visitMethodDefinition(n: TSESTree.MethodDefinition) {
    let name = ``;
    switch (n.key.type) {
      case AST_NODE_TYPES.Identifier: {
        name += n.key.name;
      } break;
      case AST_NODE_TYPES.MemberExpression: {
        if (n.key.object.type === AST_NODE_TYPES.Identifier) {
          name += n.key.object.name;
        }
        if (n.key.property.type === AST_NODE_TYPES.Identifier) {
          name += `.${n.key.property.name}`;
        }
      } break;
    }
    const members = this.docs[this.docs.length - 1].members;
    if (!members.has(name)) {
      members.set(name, []);
    }
    members.get(name)?.push({
      ...this.getFunctionExpressionDoc(n.value),
      docs: this.getNodeComments(n),
    });
    this.setLastNode(n);
  }
}


const ast = parse(sourceCode, {
  comment: true,
  range: true,
  loc: true,
});
const visitor = new ASTVisitor();

visitor.visitProgram(ast);

const contents: string[] = [];
const docs: string[] = [];

const normalize = (name: string) => name.replace(/\s+/g, '-').replace(/[^\w+-]/g, '').toLowerCase();

visitor.docs.push(visitor.docs.shift()!);

for (const doc of visitor.docs.filter(doc => doc.docs.every(doc => !doc.includes('@internal')))) {
  const level = doc.name === `` ? 0 : 1;
  const header =  `#`.repeat(level + 2);
  const padding = ` `.repeat(level * 2);
  const namespace = normalize(doc.name);
  if (level !== 0) {
    contents.push(`- [${doc.name}](#${namespace})`);
    docs.push(
      `${header} \`${doc.name}\``,
      '',
      `${doc.docs.join('\n')}`,
      '',
    );
  }

  for (const [name, members] of doc.members.entries()) {
    if (members.every(member => member.docs.every(doc => !doc.includes('@internal')))) {
      for (const member of members) {
        let title = `${name}(${member.args.join(', ')})${member.returnType}`;
        contents.push(`${padding}- [${title}](#${normalize(title)})`);
        docs.push(`${header}# \`${title}\``);
      }
      for (const member of members) {
        docs.push(
          '',
          `${member.docs.join('\n')}`,
        );
      }
    }
  }

}
await writeFile(`${process.cwd()}/docs/tmp.md`, `
${contents.join('\n')}

${docs.join('\n')}
`);
