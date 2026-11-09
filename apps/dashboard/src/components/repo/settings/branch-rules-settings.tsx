import {
	Callout,
	CalloutAction,
	CalloutContent,
} from "@diffkit/ui/components/callout";
import { Chip } from "@diffkit/ui/components/chip";
import {
	StatePill,
	type StatePillTone,
} from "@diffkit/ui/components/state-pill";
import { useQuery } from "@tanstack/react-query";
import {
	SettingsEmptyRow,
	SettingsGroup,
	SettingsListRow,
} from "#/components/settings/settings-group";
import {
	EditOnGitHubLink,
	SettingsReadView,
} from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import {
	type GitHubQueryScope,
	githubRepoBranchProtectionsQueryOptions,
	githubRepoRulesetsQueryOptions,
} from "#/lib/github.query";
import type { RulesetEnforcement } from "#/lib/settings/rules";
import {
	SAMPLE_BRANCH_PROTECTIONS,
	SAMPLE_REPO_RULESETS,
} from "./repo-settings-samples";

const ENFORCEMENT: Record<
	RulesetEnforcement,
	{ label: string; tone: StatePillTone }
> = {
	active: { label: "Active", tone: "open" },
	evaluate: { label: "Evaluate", tone: "warning" },
	disabled: { label: "Disabled", tone: "muted" },
};

function RuleChips({ rules }: { rules: string[] }) {
	return (
		<ul className="flex flex-wrap gap-1.5">
			{rules.map((rule) => (
				<li key={rule}>
					<Chip>{rule}</Chip>
				</li>
			))}
		</ul>
	);
}

export function BranchRulesSettings({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const input = { owner, repo };
	const rulesets = useQuery(githubRepoRulesetsQueryOptions(scope, input));
	const protections = useQuery(
		githubRepoBranchProtectionsQueryOptions(scope, input),
	);
	const githubUrl = `https://github.com/${owner}/${repo}/settings`;

	return (
		<>
			<SettingsHeading
				title="Branches & rules"
				description="Rulesets and branch protection that guard this repository."
			/>
			<Callout variant="info">
				<CalloutContent>
					GitHub only lets rules be edited on github.com, so they are read-only
					here.
				</CalloutContent>
				<CalloutAction>
					<EditOnGitHubLink href={`${githubUrl}/rules`} />
				</CalloutAction>
			</Callout>

			<SettingsReadView
				query={rulesets}
				sample={SAMPLE_REPO_RULESETS}
				forbiddenTitle="Rulesets aren't available"
				forbiddenHint="You need access to this repository to see its rulesets."
				githubUrl={`${githubUrl}/rules`}
			>
				{(items) => (
					<SettingsGroup title="Rulesets">
						{items.length === 0 ? (
							<SettingsEmptyRow>No rulesets.</SettingsEmptyRow>
						) : (
							items.map((ruleset) => (
								<SettingsListRow
									key={ruleset.id}
									className="flex-col items-start py-3"
								>
									<div className="flex w-full flex-wrap items-center gap-2">
										<span className="text-[13px] font-medium text-foreground">
											{ruleset.name}
										</span>
										<StatePill tone={ENFORCEMENT[ruleset.enforcement].tone}>
											{ENFORCEMENT[ruleset.enforcement].label}
										</StatePill>
										<Chip className="capitalize">{ruleset.target}</Chip>
										{ruleset.inherited ? <Chip>Organization</Chip> : null}
										{ruleset.htmlUrl ? (
											<a
												href={ruleset.htmlUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="ml-auto text-xs text-muted-foreground hover:text-foreground"
											>
												View on GitHub
											</a>
										) : null}
									</div>
									{ruleset.includes.length > 0 ? (
										<p className="text-xs text-muted-foreground">
											Applies to {ruleset.includes.join(", ")}
											{ruleset.excludes.length > 0
												? `, except ${ruleset.excludes.join(", ")}`
												: ""}
										</p>
									) : null}
									{ruleset.rules.length > 0 ? (
										<RuleChips rules={ruleset.rules} />
									) : null}
								</SettingsListRow>
							))
						)}
					</SettingsGroup>
				)}
			</SettingsReadView>

			<SettingsReadView
				query={protections}
				sample={SAMPLE_BRANCH_PROTECTIONS}
				forbiddenTitle="Branch protection isn't available"
				forbiddenHint="GitHub shows branch protection to people with admin access."
				githubUrl={`${githubUrl}/branches`}
			>
				{(items) => (
					<SettingsGroup
						title="Branch protection rules"
						actions={
							<a
								href={`${githubUrl}/branches`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs text-muted-foreground hover:text-foreground"
							>
								Manage on GitHub
							</a>
						}
					>
						{items.length === 0 ? (
							<SettingsEmptyRow>No protected branches.</SettingsEmptyRow>
						) : (
							items.map((protection) => (
								<SettingsListRow
									key={protection.branch}
									className="flex-col items-start py-3"
								>
									<span className="text-[13px] font-medium text-foreground">
										{protection.branch}
									</span>
									{protection.rules === null ? (
										<p className="text-xs text-muted-foreground">
											Protected. The rules are visible to admins.
										</p>
									) : (
										<RuleChips rules={protection.rules} />
									)}
								</SettingsListRow>
							))
						)}
					</SettingsGroup>
				)}
			</SettingsReadView>
		</>
	);
}
