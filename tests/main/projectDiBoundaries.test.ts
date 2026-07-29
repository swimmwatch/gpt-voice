import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SOURCE_ROOTS = ['src/main', 'src/renderer', 'src/shared'] as const;
const SOURCE_FILE_PATTERN = /\.(?:js|ts|tsx)$/u;
const MAIN_COMPOSITION_ROOT_FILES = new Set([
  'src/main/main.ts',
  'src/main/di/mainProcessCompositionRoot.ts',
  'src/main/di/mainProcessRuntimeFactory.ts',
]);
const IMMUTABLE_MODULE_CONSTRUCTORS = new Set(['Function', 'Map', 'RegExp', 'Set', 'WeakMap', 'WeakSet']);
const LOCALLY_OWNED_CONSTRUCTORS = new Set(['AbortController']);
const ROOT_OWNED_COMPONENT_PATTERN =
  /(?:Adapter|Audit|Controller|Coordinator|Factory|Loader|Manager|Provider|Redactor|Registry|Repository|Runner|Runtime|Service|Store|Transport)$/u;
const FACTORY_CREATED_COMPONENT_PATTERN = /(?:Adapter|Provider|Transport)$/u;
const INJECTED_OWNER_TYPE_PATTERN =
  /Adapter|Audit|Controller|Coordinator|Factory|Loader|Manager|Provider|Registry|Repository|Runner|Runtime|Service|Store|Transport/u;
const PROHIBITED_SOURCE_PATTERNS = [
  /\bDEFAULT_DEPENDENCIES\b/u,
  /\bsystemClock\b/u,
  /\bsystemFileSystem\b/u,
  /\bServiceLocator\b|\bserviceLocator\b|\bresolveToken\b/u,
  /\bcontainer\.get\s*\(/u,
] as const;

interface SourceUnit {
  readonly relativePath: string;
  readonly source: string;
  readonly sourceFile: ts.SourceFile;
}

class ProjectDiBoundaryScanner {
  public constructor(private readonly units: readonly SourceUnit[]) {}

  public scan(): string[] {
    const violations: string[] = [];
    for (const unit of this.units) {
      this.scanText(unit, violations);
      this.scanTopLevelState(unit, violations);
      this.scanSyntaxTree(unit, violations);
    }
    return violations.sort();
  }

  private scanText(unit: SourceUnit, violations: string[]): void {
    for (const pattern of PROHIBITED_SOURCE_PATTERNS) {
      if (pattern.test(unit.source)) {
        violations.push(`${unit.relativePath}: prohibited DI compatibility pattern ${pattern.source}`);
      }
    }
  }

  private scanTopLevelState(unit: SourceUnit, violations: string[]): void {
    for (const statement of unit.sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      const declarationKind = statement.declarationList.flags & ts.NodeFlags.BlockScoped ? 'let' : 'var';
      if (!(statement.declarationList.flags & ts.NodeFlags.Const)) {
        violations.push(`${unit.relativePath}: module-level mutable ${declarationKind} declaration`);
      }

      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer ? this.unwrapExpression(declaration.initializer) : undefined;
        if (!initializer || !ts.isNewExpression(initializer)) continue;
        const constructorName = this.getExpressionName(initializer.expression);
        if (!constructorName || IMMUTABLE_MODULE_CONSTRUCTORS.has(constructorName)) continue;
        violations.push(
          `${unit.relativePath}:${this.getLine(unit, declaration)} module-level constructed ${constructorName}`,
        );
      }
    }
  }

  private scanSyntaxTree(unit: SourceUnit, violations: string[]): void {
    const visit = (node: ts.Node): void => {
      if (ts.isConstructorDeclaration(node)) {
        this.scanConstructorDependencies(unit, node, violations);
      } else if (ts.isNewExpression(node)) {
        this.scanComponentConstruction(unit, node, violations);
      } else if (ts.isFunctionDeclaration(node) && node.parent === unit.sourceFile) {
        this.scanPassThroughFunction(unit, node.parameters, node.body, node.name?.text, violations);
      } else if (ts.isVariableStatement(node) && node.parent === unit.sourceFile) {
        for (const declaration of node.declarationList.declarations) {
          if (!declaration.initializer || !ts.isArrowFunction(declaration.initializer)) continue;
          const name = ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
          this.scanPassThroughFunction(
            unit,
            declaration.initializer.parameters,
            declaration.initializer.body,
            name,
            violations,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(unit.sourceFile);
  }

  private scanConstructorDependencies(
    unit: SourceUnit,
    constructor: ts.ConstructorDeclaration,
    violations: string[],
  ): void {
    for (const parameter of constructor.parameters) {
      if (!ts.isIdentifier(parameter.name) || !/^(?:dependencies|deps)$/u.test(parameter.name.text)) continue;
      if (parameter.initializer || parameter.questionToken) {
        violations.push(`${unit.relativePath}:${this.getLine(unit, parameter)} optional constructor dependency object`);
      }
      if (
        parameter.type &&
        ts.isTypeReferenceNode(parameter.type) &&
        ts.isIdentifier(parameter.type.typeName) &&
        parameter.type.typeName.text === 'Partial'
      ) {
        violations.push(`${unit.relativePath}:${this.getLine(unit, parameter)} partial constructor dependencies`);
      }
    }
  }

  private scanComponentConstruction(unit: SourceUnit, expression: ts.NewExpression, violations: string[]): void {
    if (!unit.relativePath.startsWith('src/main/')) return;
    const constructorName = this.getExpressionName(expression.expression);
    if (
      !constructorName ||
      !ROOT_OWNED_COMPONENT_PATTERN.test(constructorName) ||
      LOCALLY_OWNED_CONSTRUCTORS.has(constructorName) ||
      MAIN_COMPOSITION_ROOT_FILES.has(unit.relativePath)
    ) {
      return;
    }

    const factoryClass = this.findAncestor(expression, ts.isClassDeclaration);
    if (factoryClass?.name?.text.endsWith('Factory') && FACTORY_CREATED_COMPONENT_PATTERN.test(constructorName)) {
      return;
    }

    const factoryFunction = this.findAncestor(expression, ts.isFunctionDeclaration);
    if (factoryFunction?.name?.text.startsWith('create') && FACTORY_CREATED_COMPONENT_PATTERN.test(constructorName)) {
      return;
    }

    violations.push(
      `${unit.relativePath}:${this.getLine(unit, expression)} constructs ${constructorName} outside a composition root`,
    );
  }

  private scanPassThroughFunction(
    unit: SourceUnit,
    parameters: ts.NodeArray<ts.ParameterDeclaration>,
    body: ts.ConciseBody | undefined,
    name: string | undefined,
    violations: string[],
  ): void {
    if (!name || parameters.length === 0 || !body) return;
    const receiver = parameters[0];
    if (!ts.isIdentifier(receiver.name) || !receiver.type) return;
    const receiverType = receiver.type.getText(unit.sourceFile);
    if (!INJECTED_OWNER_TYPE_PATTERN.test(receiverType)) return;

    const expression = this.getSingleBodyExpression(body);
    if (!expression) return;
    const call = this.unwrapExpression(expression);
    if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) return;
    if (!ts.isIdentifier(call.expression.expression) || call.expression.expression.text !== receiver.name.text) return;
    const forwardedParameters = parameters.slice(1);
    if (
      call.arguments.length !== forwardedParameters.length ||
      !call.arguments.every((argument, index) => {
        const forwardedParameter = forwardedParameters[index];
        return (
          ts.isIdentifier(argument) &&
          forwardedParameter !== undefined &&
          ts.isIdentifier(forwardedParameter.name) &&
          argument.text === forwardedParameter.name.text
        );
      })
    ) {
      return;
    }

    violations.push(`${unit.relativePath}:${this.getLine(unit, body)} free pass-through wrapper ${name}`);
  }

  private getSingleBodyExpression(body: ts.ConciseBody): ts.Expression | undefined {
    if (!ts.isBlock(body)) return body;
    if (body.statements.length !== 1) return undefined;
    const statement = body.statements[0];
    if (ts.isReturnStatement(statement)) return statement.expression;
    return ts.isExpressionStatement(statement) ? statement.expression : undefined;
  }

  private unwrapExpression(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (
      ts.isAsExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isAwaitExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  private getExpressionName(expression: ts.Expression): string | undefined {
    if (ts.isIdentifier(expression)) return expression.text;
    return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
  }

  private findAncestor<T extends ts.Node>(
    node: ts.Node,
    predicate: (candidate: ts.Node) => candidate is T,
  ): T | undefined {
    let current = node.parent;
    while (current) {
      if (predicate(current)) return current;
      current = current.parent;
    }
    return undefined;
  }

  private getLine(unit: SourceUnit, node: ts.Node): number {
    return unit.sourceFile.getLineAndCharacterOfPosition(node.getStart(unit.sourceFile)).line + 1;
  }
}

function collectSourceUnits(): SourceUnit[] {
  const relativePaths: string[] = [];
  const visitDirectory = (relativeDirectory: string): void => {
    const absoluteDirectory = path.join(PROJECT_ROOT, relativeDirectory);
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(relativePath);
      } else if (SOURCE_FILE_PATTERN.test(entry.name)) {
        relativePaths.push(relativePath);
      }
    }
  };
  for (const root of SOURCE_ROOTS) visitDirectory(root);

  return relativePaths.sort().map((relativePath) => {
    const source = readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
    const scriptKind = relativePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : relativePath.endsWith('.js')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
    return {
      relativePath,
      source,
      sourceFile: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKind),
    };
  });
}

describe('project dependency injection boundaries', () => {
  it('contains no prohibited stateful global, fallback dependency, locator, or construction seam', () => {
    assert.deepEqual(new ProjectDiBoundaryScanner(collectSourceUnits()).scan(), []);
  });

  it('keeps Electron and renderer logging value imports at their process composition roots', () => {
    const units = collectSourceUnits();
    const electronValueImports = units
      .filter(({ sourceFile }) =>
        sourceFile.statements.some(
          (statement) =>
            ts.isImportDeclaration(statement) &&
            ts.isStringLiteral(statement.moduleSpecifier) &&
            (statement.moduleSpecifier.text === 'electron' ||
              statement.moduleSpecifier.text === 'electron-log/renderer') &&
            statement.importClause !== undefined &&
            !statement.importClause.isTypeOnly,
        ),
      )
      .map(({ relativePath }) => relativePath)
      .sort();

    assert.deepEqual(electronValueImports, [
      'src/main/main.ts',
      'src/main/preload.ts',
      'src/renderer/bootstrapWindow.tsx',
    ]);
  });
});
