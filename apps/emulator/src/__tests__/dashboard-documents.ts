/**
 * Pulls the GraphQL documents straight out of the dashboard source so the
 * shim is always tested against the exact text DiffKit sends. Dynamic
 * documents are rendered by evaluating their own template literals.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

export const GITHUB_FUNCTIONS_PATH = new URL(
	"../../../dashboard/src/lib/github.functions.ts",
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

function loadSource() {
	const text = readFileSync(GITHUB_FUNCTIONS_PATH, "utf8");
	return ts.createSourceFile(
		"github.functions.ts",
		text,
		ts.ScriptTarget.Latest,
		true,
	);
}

function templateText(node: ts.TemplateLiteral, source: ts.SourceFile) {
	return node.getText(source).slice(1, -1);
}

export function extractDocuments(): ExtractedDocument[] {
	const source = loadSource();
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

/** Every template literal in the file, for rendering dynamic fragments. */
function allTemplates() {
	const source = loadSource();
	const templates: string[] = [];
	const constants = new Map<string, unknown>();
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
	return { templates, constants };
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
export function renderDynamicDocument(document: ExtractedDocument) {
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
