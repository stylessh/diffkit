import {
	buildSchema,
	execute,
	type GraphQLError,
	type GraphQLFieldResolver,
	GraphQLInterfaceType,
	GraphQLObjectType,
	type GraphQLSchema,
	GraphQLUnionType,
	OverlappingFieldsCanBeMergedRule,
	parse,
	specifiedRules,
	validate,
} from "graphql";
import type { ShimContext } from "../server.ts";
import { getAuthUser } from "../shims/common.ts";
import {
	ABSTRACT_TYPES,
	createGraphQLContext,
	type GraphQLContext,
	resolvers,
} from "./resolvers.ts";
import { typeDefs } from "./schema.ts";

let cachedSchema: GraphQLSchema | null = null;

export function getSchema() {
	if (cachedSchema) {
		return cachedSchema;
	}
	const schema = buildSchema(typeDefs);
	for (const [typeName, fields] of Object.entries(resolvers)) {
		const type = schema.getType(typeName);
		if (!(type instanceof GraphQLObjectType)) {
			throw new Error(`resolvers reference unknown object type ${typeName}`);
		}
		const typeFields = type.getFields();
		for (const [fieldName, resolve] of Object.entries(fields)) {
			const field = typeFields[fieldName];
			if (!field) {
				throw new Error(
					`resolvers reference unknown field ${typeName}.${fieldName}`,
				);
			}
			field.resolve = resolve as GraphQLFieldResolver<unknown, GraphQLContext>;
		}
	}
	for (const typeName of ABSTRACT_TYPES) {
		const type = schema.getType(typeName);
		if (
			type instanceof GraphQLInterfaceType ||
			type instanceof GraphQLUnionType
		) {
			type.resolveType = (value: { __typename?: string }) => value.__typename;
		}
	}
	cachedSchema = schema;
	return schema;
}

/** GitHub puts `type` (e.g. NOT_FOUND) at the top level of each error. */
function formatError(error: GraphQLError) {
	const type = (error.extensions?.type as string | undefined) ?? undefined;
	return {
		...(type ? { type } : {}),
		path: error.path,
		locations: error.locations,
		message: error.message,
	};
}

/**
 * GitHub (graphql-ruby) accepts same-named fields with different enum types in
 * mutually exclusive fragments (e.g. `... on Issue { state } ... on PullRequest
 * { state }`); graphql-js rejects them. DiffKit relies on that, so we skip
 * just that rule.
 */
const VALIDATION_RULES = specifiedRules.filter(
	(rule) => rule !== OverlappingFieldsCanBeMergedRule,
);

export async function executeGraphQL(
	shim: ShimContext,
	input: {
		query: string;
		variables?: Record<string, unknown> | null;
		operationName?: string | null;
		auth: Parameters<typeof createGraphQLContext>[1];
		authorization: string;
	},
) {
	const schema = getSchema();
	let document: ReturnType<typeof parse>;
	try {
		document = parse(input.query);
	} catch (error) {
		return { errors: [formatError(error as GraphQLError)] };
	}
	const validationErrors = validate(schema, document, VALIDATION_RULES);
	if (validationErrors.length > 0) {
		return { errors: validationErrors.map(formatError) };
	}
	const result = await execute({
		schema,
		document,
		variableValues: input.variables ?? undefined,
		operationName: input.operationName ?? undefined,
		contextValue: createGraphQLContext(shim, input.auth, input.authorization),
	});
	return {
		...(result.data !== undefined ? { data: result.data } : {}),
		...(result.errors ? { errors: result.errors.map(formatError) } : {}),
	};
}

export function registerGraphQLRoute(context: ShimContext) {
	context.app.post("/graphql", async (c) => {
		const auth = getAuthUser(c);
		if (!auth) {
			return c.json(
				{
					message: "This endpoint requires you to be authenticated.",
					documentation_url:
						"https://docs.github.com/graphql/guides/forming-calls-with-graphql#authenticating-with-graphql",
				},
				401,
			);
		}
		let body: {
			query?: string;
			variables?: Record<string, unknown>;
			operationName?: string;
		};
		try {
			body = await c.req.json();
		} catch {
			return c.json({ message: "Problems parsing JSON" }, 400);
		}
		if (typeof body.query !== "string") {
			return c.json(
				{
					errors: [
						{
							message:
								"A query attribute must be specified and must be a string.",
						},
					],
				},
				200,
			);
		}
		const result = await executeGraphQL(context, {
			query: body.query,
			variables: body.variables,
			operationName: body.operationName,
			auth,
			authorization: c.req.header("Authorization") ?? "",
		});
		return c.json(result, 200);
	});
}
