import path from "path";
import * as babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export type ParsedNodeType =
  | "class"
  | "method"
  | "function"
  | "import"
  | "python_function"
  | "python_class"
  | "java_class"
  | "java_interface"
  | "java_enum"
  | "java_method"
  | "kotlin_class"
  | "kotlin_fun"
  | "kotlin_object"
  | "android_component"
  | "config"
  | "doc";

export type ParsedNodeEdgeKind = "DEFINES" | "CONTAINS" | "DOCUMENTS";
export type ParsedFileNodeType = "file" | "doc";

export interface ParsedNode {
  name: string;
  type: ParsedNodeType;
  edgeKind: ParsedNodeEdgeKind;
  startLine?: number;
  endLine?: number;
}

export interface ParsedFile {
  filePath: string;
  fileNodeType: ParsedFileNodeType;
  nodes: ParsedNode[];
  imports: string[];
  callees: string[];
}

const MAX_CONTENT_BYTES = 500 * 1024;
const PYTHON_CALL_IGNORE = new Set([
  "and",
  "class",
  "def",
  "elif",
  "except",
  "False",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "not",
  "or",
  "print",
  "raise",
  "return",
  "True",
  "while",
  "with",
  "yield",
]);

function createEmptyParsedFile(filePath: string, fileNodeType: ParsedFileNodeType = "file"): ParsedFile {
  return {
    filePath,
    fileNodeType,
    nodes: [],
    imports: [],
    callees: [],
  };
}

function addUnique(items: string[], seen: Set<string>, value: string) {
  const trimmed = value.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  items.push(trimmed);
}

function parseJavaScriptLikeFile(filePath: string, content: string): ParsedFile | null {
  try {
    const ast = babelParser.parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "dynamicImport",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
      errorRecovery: true,
    });

    const parsed = createEmptyParsedFile(filePath);
    const seenNodes = new Set<string>();
    const seenImports = new Set<string>();
    const seenCallees = new Set<string>();

    const addNode = (node: ParsedNode) => {
      const key = `${node.type}:${node.name}`;
      if (seenNodes.has(key)) return;
      seenNodes.add(key);
      parsed.nodes.push(node);
    };

    traverse(ast as Parameters<typeof traverse>[0], {
      ImportDeclaration({ node }) {
        const src = node.source.value;
        addNode({
          name: src,
          type: "import",
          edgeKind: "DEFINES",
          startLine: node.loc?.start.line,
          endLine: node.loc?.end.line,
        });
        addUnique(parsed.imports, seenImports, src);
      },

      FunctionDeclaration({ node }) {
        const name = node.id?.name;
        if (!name) return;
        addNode({
          name,
          type: "function",
          edgeKind: "DEFINES",
          startLine: node.loc?.start.line,
          endLine: node.loc?.end.line,
        });
      },

      VariableDeclarator({ node }) {
        if (
          t.isIdentifier(node.id) &&
          (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init))
        ) {
          addNode({
            name: node.id.name,
            type: "function",
            edgeKind: "DEFINES",
            startLine: node.loc?.start.line,
            endLine: node.init.loc?.end.line || node.loc?.end.line,
          });
        }
      },

      ClassDeclaration({ node }) {
        const name = node.id?.name;
        if (!name) return;
        addNode({
          name,
          type: "class",
          edgeKind: "DEFINES",
          startLine: node.loc?.start.line,
          endLine: node.loc?.end.line,
        });
      },

      ClassMethod({ node }) {
        if (!t.isIdentifier(node.key)) return;
        addNode({
          name: node.key.name,
          type: "method",
          edgeKind: "DEFINES",
          startLine: node.loc?.start.line,
          endLine: node.loc?.end.line,
        });
      },

      CallExpression({ node }) {
        let name: string | null = null;
        if (t.isIdentifier(node.callee)) {
          name = node.callee.name;
        } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
          name = node.callee.property.name;
        }

        if (name) {
          addUnique(parsed.callees, seenCallees, name);
        }
      },
    });

    return parsed;
  } catch {
    return null;
  }
}

function parsePythonFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seenNodes = new Set<string>();
  const seenImports = new Set<string>();
  const seenCallees = new Set<string>();
  const lines = content.split(/\r?\n/);

  const addNode = (node: ParsedNode) => {
    const key = `${node.type}:${node.name}`;
    if (seenNodes.has(key)) return;
    seenNodes.add(key);
    parsed.nodes.push(node);
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const importMatch = trimmed.match(/^import\s+(.+)$/);
    if (importMatch) {
      importMatch[1]
        .split(",")
        .map((part) => part.trim().split(/\s+as\s+/i)[0]?.trim())
        .filter(Boolean)
        .forEach((moduleName) => {
          addNode({
            name: moduleName,
            type: "import",
            edgeKind: "DEFINES",
            startLine: lineNumber,
            endLine: lineNumber,
          });
          addUnique(parsed.imports, seenImports, moduleName);
        });
    }

    const fromImportMatch = trimmed.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
    if (fromImportMatch) {
      addNode({
        name: fromImportMatch[1],
        type: "import",
        edgeKind: "DEFINES",
        startLine: lineNumber,
        endLine: lineNumber,
      });
      addUnique(parsed.imports, seenImports, fromImportMatch[1]);
    }

    const functionMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (functionMatch) {
      addNode({
        name: functionMatch[1],
        type: "python_function",
        edgeKind: "DEFINES",
        startLine: lineNumber,
        endLine: lineNumber,
      });
    }

    const classMatch = trimmed.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (classMatch) {
      addNode({
        name: classMatch[1],
        type: "python_class",
        edgeKind: "DEFINES",
        startLine: lineNumber,
        endLine: lineNumber,
      });
    }

    if (/^(def|class|from|import)\b/.test(trimmed)) return;

    const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    for (const match of trimmed.matchAll(callPattern)) {
      const callee = match[1];
      if (PYTHON_CALL_IGNORE.has(callee)) continue;
      addUnique(parsed.callees, seenCallees, callee);
    }
  });

  return parsed;
}

function parseJsonFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);

  try {
    const value = JSON.parse(content) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return parsed;
    }

    Object.keys(value).forEach((key) => {
      parsed.nodes.push({
        name: key,
        type: "config",
        edgeKind: "CONTAINS",
      });
    });
  } catch {
    return parsed;
  }

  return parsed;
}

function parseYamlFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seenKeys = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) continue;

    const keyMatch = line.match(/^([A-Za-z0-9_.-]+)\s*:/);
    if (!keyMatch) continue;
    seenKeys.add(keyMatch[1]);
  }

  seenKeys.forEach((key) => {
    parsed.nodes.push({
      name: key,
      type: "config",
      edgeKind: "CONTAINS",
    });
  });

  return parsed;
}

function parseMarkdownFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath, "doc");
  const seenHeadings = new Set<string>();

  content.split(/\r?\n/).forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,2})\s+(.+?)\s*$/);
    if (!headingMatch) return;

    const heading = headingMatch[2].trim();
    if (!heading || seenHeadings.has(heading)) return;
    seenHeadings.add(heading);
    parsed.nodes.push({
      name: heading,
      type: "doc",
      edgeKind: "DOCUMENTS",
      startLine: index + 1,
      endLine: index + 1,
    });
  });

  return parsed;
}

// ─── Java Parser ─────────────────────────────────────────────────────────────

const JAVA_CALL_IGNORE = new Set([
  "if", "else", "for", "while", "switch", "catch", "return", "new",
  "throw", "instanceof", "extends", "implements", "super", "this",
  "void", "int", "long", "boolean", "String", "List", "Map", "Set",
  "Object", "null", "true", "false",
]);

function parseJavaFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seenNodes = new Set<string>();
  const seenImports = new Set<string>();
  const seenCallees = new Set<string>();
  const lines = content.split(/\r?\n/);

  const addNode = (node: ParsedNode) => {
    const key = `${node.type}:${node.name}`;
    if (seenNodes.has(key)) return;
    seenNodes.add(key);
    parsed.nodes.push(node);
  };

  // Annotation patterns (Android components)
  const androidAnnotations = new Set([
    "Activity", "Fragment", "Service", "BroadcastReceiver",
    "ContentProvider", "ViewModel", "Repository",
  ]);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    // package declaration
    const packageMatch = trimmed.match(/^package\s+([\w.]+)\s*;/);
    if (packageMatch) {
      addNode({ name: packageMatch[1], type: "import", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // import statements
    const importMatch = trimmed.match(/^import\s+(?:static\s+)?([\w.*]+)\s*;/);
    if (importMatch) {
      const imp = importMatch[1];
      addNode({ name: imp, type: "import", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      addUnique(parsed.imports, seenImports, imp.replace(/\.\*/,""));
      return;
    }

    // class declarations (including abstract, final, static inner)
    const classMatch = trimmed.match(
      /(?:public|private|protected|static|abstract|final)?\s*(?:public|private|protected|static|abstract|final)?\s*class\s+([A-Z][\w]*)(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([\w.,\s]+))?/
    );
    if (classMatch) {
      addNode({ name: classMatch[1], type: "java_class", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      // imports: extends target
      if (classMatch[2]) addUnique(parsed.imports, seenImports, classMatch[2]);
      // imports: implements targets
      if (classMatch[3]) {
        classMatch[3].split(",").map(s => s.trim()).filter(Boolean).forEach(iface => {
          addUnique(parsed.imports, seenImports, iface);
        });
      }
      return;
    }

    // interface declarations
    const ifaceMatch = trimmed.match(/(?:public|private|protected)?\s*interface\s+([A-Z][\w]*)/);
    if (ifaceMatch) {
      addNode({ name: ifaceMatch[1], type: "java_interface", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // enum declarations
    const enumMatch = trimmed.match(/(?:public|private|protected)?\s*enum\s+([A-Z][\w]*)/);
    if (enumMatch) {
      addNode({ name: enumMatch[1], type: "java_enum", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // method declarations (heuristic: return-type methodName()
    const methodMatch = trimmed.match(
      /(?:public|private|protected|static|final|synchronized|native|abstract)?\s+(?:public|private|protected|static|final|synchronized)?\s*(?:@Override\s+)?(?:void|[A-Za-z_$][\w<>\[\],\s.]*?)\s+([a-z][\w]*)\s*\(/
    );
    if (methodMatch && !trimmed.includes("//")) {
      const name = methodMatch[1];
      // skip keywords and constructor-like (uppercase)
      if (!JAVA_CALL_IGNORE.has(name) && /^[a-z]/.test(name)) {
        addNode({ name, type: "java_method", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      }
    }

    // Android annotations (@Override, @Inject etc already handled, check for component patterns)
    const annotationMatch = trimmed.match(/@([A-Z][\w]*)/);
    if (annotationMatch && androidAnnotations.has(annotationMatch[1])) {
      addNode({ name: annotationMatch[1], type: "android_component", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
    }

    // call expressions: SomeThing.method()
    if (!trimmed.startsWith("import") && !trimmed.startsWith("package")) {
      const callPattern = /\b([a-z][\w]*)\s*\(/g;
      for (const match of trimmed.matchAll(callPattern)) {
        if (!JAVA_CALL_IGNORE.has(match[1])) {
          addUnique(parsed.callees, seenCallees, match[1]);
        }
      }
    }
  });

  return parsed;
}

// ─── Kotlin Parser ────────────────────────────────────────────────────────────

const KOTLIN_CALL_IGNORE = new Set([
  "if", "else", "for", "while", "when", "try", "catch", "return",
  "val", "var", "fun", "class", "object", "interface", "data",
  "override", "private", "public", "protected", "internal", "companion",
  "null", "true", "false", "it", "this", "super", "by", "in", "is", "as",
]);

function parseKotlinFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seenNodes = new Set<string>();
  const seenImports = new Set<string>();
  const seenCallees = new Set<string>();
  const lines = content.split(/\r?\n/);

  const addNode = (node: ParsedNode) => {
    const key = `${node.type}:${node.name}`;
    if (seenNodes.has(key)) return;
    seenNodes.add(key);
    parsed.nodes.push(node);
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    // package
    const packageMatch = trimmed.match(/^package\s+([\w.]+)/);
    if (packageMatch) {
      addNode({ name: packageMatch[1], type: "import", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // import
    const importMatch = trimmed.match(/^import\s+([\w.*]+)/);
    if (importMatch) {
      const imp = importMatch[1];
      addNode({ name: imp, type: "import", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      addUnique(parsed.imports, seenImports, imp.replace(/\.\*/, ""));
      return;
    }

    // class / data class / sealed class / abstract class
    const classMatch = trimmed.match(/(?:data|sealed|abstract|open|inner)?\s*class\s+([A-Z][\w]*)/);
    if (classMatch) {
      addNode({ name: classMatch[1], type: "kotlin_class", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // interface
    const ifaceMatch = trimmed.match(/interface\s+([A-Z][\w]*)/);
    if (ifaceMatch) {
      addNode({ name: ifaceMatch[1], type: "java_interface", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // object / companion object
    const objectMatch = trimmed.match(/(?:companion\s+)?object\s+([A-Z][\w]*)/);
    if (objectMatch) {
      addNode({ name: objectMatch[1], type: "kotlin_object", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // enum class
    const enumMatch = trimmed.match(/enum\s+class\s+([A-Z][\w]*)/);
    if (enumMatch) {
      addNode({ name: enumMatch[1], type: "java_enum", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
      return;
    }

    // fun declarations (named functions only — not lambdas)
    const funMatch = trimmed.match(/^(?:override\s+|private\s+|public\s+|protected\s+|internal\s+|suspend\s+|inline\s+|open\s+)*fun\s+([a-z][\w]*)\s*[(<]/);
    if (funMatch) {
      addNode({ name: funMatch[1], type: "kotlin_fun", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
    }

    // call expressions
    if (!trimmed.startsWith("import") && !trimmed.startsWith("package")) {
      const callPattern = /\b([a-z][\w]*)\s*\(/g;
      for (const match of trimmed.matchAll(callPattern)) {
        if (!KOTLIN_CALL_IGNORE.has(match[1])) {
          addUnique(parsed.callees, seenCallees, match[1]);
        }
      }
    }
  });

  return parsed;
}

// ─── Android XML Parser ───────────────────────────────────────────────────────

function parseAndroidXmlFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seen = new Set<string>();

  // Android component tags
  const componentTagRe = /<(activity|service|receiver|provider|fragment|include|merge|navigation|action|argument)\b/gi;
  for (const match of content.matchAll(componentTagRe)) {
    const tag = match[1].toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      parsed.nodes.push({ name: tag, type: "android_component", edgeKind: "DEFINES" });
    }
  }

  // android:name attribute values (fully qualified class references)
  const nameAttrRe = /android:name="([\w.]+)"/g;
  for (const match of content.matchAll(nameAttrRe)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      parsed.nodes.push({ name, type: "android_component", edgeKind: "DEFINES" });
      // treat as import reference
      addUnique(parsed.imports, new Set(parsed.imports), name);
    }
  }

  // tools:context
  const contextRe = /tools:context="([\w.]+)"/g;
  for (const match of content.matchAll(contextRe)) {
    const name = match[1].replace(/^\./,"");
    if (!seen.has(name)) {
      seen.add(name);
      parsed.nodes.push({ name, type: "android_component", edgeKind: "DEFINES" });
    }
  }

  // strings.xml / values: extract resource names
  const resourceRe = /<(?:string|color|dimen|style|attr|declare-styleable)\s+name="([\w.]+)"/g;
  for (const match of content.matchAll(resourceRe)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      parsed.nodes.push({ name, type: "config", edgeKind: "CONTAINS" });
    }
  }

  return parsed;
}

// ─── Gradle Parser ────────────────────────────────────────────────────────────

function parseGradleFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return;
    const lineNumber = index + 1;

    // dependencies: implementation, api, testImplementation etc.
    const depMatch = trimmed.match(/(?:implementation|api|testImplementation|androidTestImplementation|compileOnly|runtimeOnly|kapt|annotationProcessor)\s+['"]([\w.:+-]+)['"]/);
    if (depMatch) {
      const dep = depMatch[1];
      if (!seen.has(dep)) {
        seen.add(dep);
        parsed.nodes.push({ name: dep, type: "import", edgeKind: "DEFINES", startLine: lineNumber, endLine: lineNumber });
        addUnique(parsed.imports, new Set(parsed.imports), dep.split(":")[0]);
      }
      return;
    }

    // plugins
    const pluginMatch = trimmed.match(/(?:id|apply plugin)\s+['"]([\w.-]+)['"]/);
    if (pluginMatch && !seen.has(pluginMatch[1])) {
      seen.add(pluginMatch[1]);
      parsed.nodes.push({ name: pluginMatch[1], type: "config", edgeKind: "CONTAINS", startLine: lineNumber, endLine: lineNumber });
    }
  });

  return parsed;
}

// ─── ProGuard / R8 Parser ─────────────────────────────────────────────────────

function parseProguardFile(filePath: string, content: string): ParsedFile {
  const parsed = createEmptyParsedFile(filePath);
  const seen = new Set<string>();

  const keepRe = /-keep(?:classmembers|classeswithmembers)?\s+(?:public\s+)?(?:class|interface)\s+([\w.*]+)/g;
  for (const match of content.matchAll(keepRe)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      parsed.nodes.push({ name, type: "config", edgeKind: "CONTAINS" });
    }
  }

  return parsed;
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export function parseFile(filePath: string, content: string): ParsedFile | null {
  if (Buffer.byteLength(content, "utf-8") > MAX_CONTENT_BYTES) {
    return null;
  }

  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  try {
    // JavaScript / TypeScript
    if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
      return parseJavaScriptLikeFile(filePath, content);
    }

    // Python
    if (ext === ".py") {
      return parsePythonFile(filePath, content);
    }

    // Java
    if (ext === ".java") {
      return parseJavaFile(filePath, content);
    }

    // Kotlin
    if (ext === ".kt" || ext === ".kts") {
      return parseKotlinFile(filePath, content);
    }

    // Android XML (layouts, manifests, resources, navigation)
    if (ext === ".xml") {
      return parseAndroidXmlFile(filePath, content);
    }

    // Gradle build files
    if (ext === ".gradle" || base === "build.gradle" || base === "settings.gradle" || base === "build.gradle.kts") {
      return parseGradleFile(filePath, content);
    }

    // ProGuard / R8 rules
    if (ext === ".pro" || base === "proguard-rules.pro") {
      return parseProguardFile(filePath, content);
    }

    // JSON (package.json, gradle.properties etc.)
    if (ext === ".json") {
      return parseJsonFile(filePath, content);
    }

    // YAML
    if (ext === ".yaml" || ext === ".yml") {
      return parseYamlFile(filePath, content);
    }

    // Markdown docs
    if (ext === ".md") {
      return parseMarkdownFile(filePath, content);
    }

    // .properties files (gradle.properties, local.properties)
    if (ext === ".properties") {
      return parseYamlFile(filePath, content); // key: value format compatible
    }

    return null;
  } catch {
    return createEmptyParsedFile(filePath, ext === ".md" ? "doc" : "file");
  }
}
