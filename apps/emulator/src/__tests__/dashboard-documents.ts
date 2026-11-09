/**
 * Pulls the GraphQL documents straight out of the dashboard source so the
 * shim is always tested against the exact text DiffKit sends. Dynamic
 * documents are rendered by evaluating their own template literals.
 */
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

const GITHUB_MODULES_DIR = new URL(
	"../../../dashboard/src/lib/github/",
	import.meta.url,
);

export type ExtractedDocument = {
	/** Enclosing function or server fn name. */
	name: string;
	line: number;
	/** Raw template text (without backticks). */
	template: string;
	dynamic: boolean;
};

const GRAPHQL_START = /^\s*(query|mutation|fragment)\b/u;

function enclosingName(node: ts.Node): string {
	let current: ts.Node | undefined = node.parent;
	while (current) {
		if (ts.isFunctionDeclaration(current) && current.name) {
			return current.name.text;
		}
		if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
			return current.name.text;
		}
		current = current.parent;
	}
	return "anonymous";
}

function loadSources() {
	return readdirSync(GITHUB_MODULES_DIR)
		.filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
		.sort()
		.map((file) =>
			ts.createSourceFile(
				file,
				readFileSync(new URL(file, GITHUB_MODULES_DIR), "utf8"),
				ts.ScriptTarget.Latest,
				true,
			),
		);
}

function templateText(node: ts.TemplateLiteral, source: ts.SourceFile) {
	return node.getText(source).slice(1, -1);
}

export function extractDocuments(): ExtractedDocument[] {
	return loadSources().flatMap(extractDocumentsFrom);
}

function extractDocumentsFrom(source: ts.SourceFile): ExtractedDocument[] {
	const documents: ExtractedDocument[] = [];
	const visit = (node: ts.Node) => {
		if (
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateExpression(node)
		) {
			const template = templateText(node, source);
			if (GRAPHQL_START.test(template)) {
				documents.push({
					name: enclosingName(node),
					line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
					template,
					dynamic: ts.isTemplateExpression(node),
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return documents;
}

/** Every template literal in the modules, for rendering dynamic fragments. */
function allTemplates() {
	const templates: string[] = [];
	const constants = new Map<string, unknown>();
	for (const source of loadSources()) {
		collectTemplates(source, templates, constants);
	}
	return { templates, constants };
}

function collectTemplates(
	source: ts.SourceFile,
	templates: string[],
	constants: Map<string, unknown>,
) {
	const visit = (node: ts.Node) => {
		if (
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateExpression(node)
		) {
			templates.push(templateText(node, source));
		}
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer &&
			ts.isSourceFile(node.parent.parent.parent) &&
			(ts.isNoSubstitutionTemplateLiteral(node.initializer) ||
				ts.isArrayLiteralExpression(node.initializer))
		) {
			try {
				constants.set(
					node.name.text,
					new Function(`return ${node.initializer.getText(source)}`)(),
				);
			} catch {
				// Not a literal we can evaluate.
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
}

export function renderTemplate(
	template: string,
	scope: Record<string, unknown>,
) {
	const keys = Object.keys(scope);
	return new Function(...keys, `return \`${template}\`;`)(
		...keys.map((key) => scope[key]),
	) as string;
}

function findTemplate(templates: string[], prefix: string) {
	const found = templates.find((template) =>
		template.trimStart().startsWith(prefix),
	);
	if (!found) {
		throw new Error(`could not find template starting with ${prefix}`);
	}
	return found;
}

/**
 * Renders a dynamic document with realistic inputs. Throws for unknown
 * substitutions so new dynamic documents get explicit coverage.
 */
export function renderDynamicDocument(
	document: ExtractedDocument,
	seeded: { pullNumbers: number[] },
) {
	const { templates, constants } = allTemplates();
	if (document.template.includes("${fields}")) {
		const field = findTemplate(templates, "p${i}: object(");
		const paths = constants.get("PR_TEMPLATE_PATHS") as string[];
		return {
			query: renderTemplate(document.template, {
				fields: paths
					.map((path, i) => renderTemplate(field, { path, i }))
					.join("\n"),
			}),
			variables: {},
		};
	}
	if (document.template.includes('${aliases.join("\\n")}')) {
		const alias = findTemplate(templates, "e${i}: history(");
		const entries = ["src", "README.md", "package.json"];
		return {
			query: renderTemplate(document.template, {
				aliases: entries.map((entryPath, i) =>
					renderTemplate(alias, { i, entryPath }),
				),
			}),
			variables: {},
		};
	}
	if (document.template.includes('${pullAliases.join("\\n")}')) {
		const alias = findTemplate(templates, "p${number}: pullRequest(");
		return {
			query: renderTemplate(document.template, {
				pullAliases: seeded.pullNumbers.map((number) =>
					renderTemplate(alias, { number }),
				),
			}),
			variables: {},
		};
	}
	if (document.template.includes("${BRANCH_NODE_FIELDS}")) {
		return {
			query: renderTemplate(document.template, {
				BRANCH_NODE_FIELDS: constants.get("BRANCH_NODE_FIELDS"),
			}),
			variables: {},
		};
	}
	if (document.template.includes('${declarations.join(", ")}')) {
		const declaration = findTemplate(templates, "$h${index}: String!");
		const head = findTemplate(templates, "h${index}: ref(");
		const tag = findTemplate(templates, "t${index}: ref(");
		const candidates = ["feat", "feat/sse-headers"];
		const declarations: string[] = [];
		const fields: string[] = [];
		const variables: Record<string, string> = {};
		candidates.forEach((candidate, index) => {
			declarations.push(
				renderTemplate(declaration, { index }),
				renderTemplate(findTemplate(templates, "$t${index}: String!"), {
					index,
				}),
			);
			fields.push(
				renderTemplate(head, { index }),
				renderTemplate(tag, { index }),
			);
			variables[`h${index}`] = `refs/heads/${candidate}`;
			variables[`t${index}`] = `refs/tags/${candidate}`;
		});
		return {
			query: renderTemplate(document.template, { declarations, fields }),
			variables,
		};
	}
	throw new Error(
		`No renderer for dynamic GraphQL document in ${document.name} (line ${document.line}). Add one in dashboard-documents.ts.`,
	);
}
