import { PackageIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
import { Label } from "@diffkit/ui/components/label";
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { PageHeaderTitle } from "@diffkit/ui/components/page-header";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { Switch } from "@diffkit/ui/components/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Skeleton } from "skullet/react";
import { RepoCrumb, RepoPageHeader } from "#/components/repo/repo-page-header";
import { pillButtonClassName, RepoEmptyState } from "#/components/repo/repo-ui";
import {
	SkeletonSample,
	useIsSkeletonSample,
} from "#/components/shared/skeleton-sample";
import {
	createRepoRelease,
	generateRepoReleaseNotes,
	updateRepoRelease,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	githubRepoOverviewQueryOptions,
	githubRepoRefNamesQueryOptions,
	githubRepoReleaseQueryOptions,
	githubRepoReleasesQueryOptions,
	githubRepoViewerPermissionQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	releaseEntityKey,
} from "#/lib/github-query-updates";
import { useHasMounted } from "#/lib/use-has-mounted";
import { ReleaseDeleteButton } from "./release-card-actions";
import { ReleaseBranchPicker, ReleaseTagPicker } from "./release-ref-pickers";
import {
	buildReleaseSavePayload,
	initialReleaseFormState,
	type ReleaseFormErrors,
	type ReleaseFormState,
	type ReleaseSaveIntent,
	releaseNotesRangeKey,
	shouldApplyGeneratedReleaseNotes,
	validateReleaseForm,
} from "./release-save-utils";

/**
 * New / edit release. Resolves the data the form needs (default branch,
 * permission, release being edited), then mounts the form keyed by release so
 * its state initialises once from server data.
 */
export function ReleaseFormPage({
	owner,
	repo,
	scope,
	editTag,
	initialTag,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	/** Present on `/releases/$tag/edit`. */
	editTag?: string;
	/** Prefill from `/releases/new?tag=`. */
	initialTag?: string;
}) {
	const hasMounted = useHasMounted();
	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const permissionQuery = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const releaseQuery = useQuery({
		...githubRepoReleaseQueryOptions(scope, {
			owner,
			repo,
			tag: editTag ?? "",
		}),
		enabled: hasMounted && Boolean(editTag),
		// Don't refetch underneath someone who is editing.
		refetchOnWindowFocus: false,
	});

	const repoData = overviewQuery.data;
	const permission = permissionQuery.data;
	const failed = [overviewQuery, permissionQuery, releaseQuery].filter(
		(query) => query.isError && query.data === undefined,
	);
	const loading =
		!hasMounted ||
		!repoData ||
		!permission ||
		(Boolean(editTag) && releaseQuery.isPending);

	let content: React.ReactNode;
	if (failed.length > 0) {
		content = (
			<RepoEmptyState
				icon={<PackageIcon />}
				title="Couldn't load this release form"
				action={
					<button
						type="button"
						onClick={() => {
							for (const query of failed) void query.refetch();
						}}
						className={pillButtonClassName}
					>
						Try again
					</button>
				}
			/>
		);
	} else if (loading) {
		content = (
			<SkeletonSample>
				<ReleaseForm
					owner={owner}
					repo={repo}
					scope={scope}
					defaultBranch="main"
					release={null}
				/>
			</SkeletonSample>
		);
	} else if (!permission.canPush) {
		content = (
			<RepoEmptyState
				icon={<PackageIcon />}
				title="You can't publish releases here"
			>
				Creating and editing releases needs write access to {owner}/{repo}.
			</RepoEmptyState>
		);
	} else if (editTag && !releaseQuery.data) {
		content = (
			<RepoEmptyState
				icon={<PackageIcon />}
				title={`Release ${editTag} wasn't found`}
			/>
		);
	} else {
		const release = releaseQuery.data ?? null;
		content = (
			<ReleaseForm
				key={release ? `release-${release.id}` : `new-${initialTag ?? ""}`}
				owner={owner}
				repo={repo}
				scope={scope}
				defaultBranch={repoData.defaultBranch}
				release={release}
				initialTag={initialTag}
			/>
		);
	}

	const title = editTag ? `Edit release ${editTag}` : "New release";

	return (
		<RepoPageHeader
			owner={owner}
			repo={repo}
			scope={scope}
			active="releases"
			trail={
				<>
					<RepoCrumb asChild>
						<Link to="/$owner/$repo/releases" params={{ owner, repo }}>
							Releases
						</Link>
					</RepoCrumb>
					{editTag ? (
						<RepoCrumb asChild>
							<Link
								to="/$owner/$repo/releases/$tag"
								params={{ owner, repo, tag: editTag }}
								className="font-mono"
							>
								{editTag}
							</Link>
						</RepoCrumb>
					) : null}
					<PageHeaderTitle asChild>
						<span>{editTag ? "Edit" : "New release"}</span>
					</PageHeaderTitle>
				</>
			}
			bodyClassName="px-0"
		>
			<div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-4 pt-6 md:px-[46px]">
				<h1 className="text-[22px] leading-8 font-semibold text-foreground">
					{title}
				</h1>
				<Skeleton
					loading={loading && failed.length === 0}
					label="Loading release form"
				>
					{content}
				</Skeleton>
			</div>
		</RepoPageHeader>
	);
}

type Submission =
	| { status: "idle" }
	| { status: "saving"; intent: ReleaseSaveIntent }
	| { status: "failed"; error: string };

function FieldHint({ children }: { children: React.ReactNode }) {
	return <p className="text-xs text-muted-foreground">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-xs text-destructive">
			{message}
		</p>
	);
}

function ReleaseForm({
	owner,
	repo,
	scope,
	defaultBranch,
	release,
	initialTag,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	defaultBranch: string;
	release: RepoRelease | null;
	initialTag?: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const isEditing = release != null;
	const isPublished = isEditing && !release.isDraft;

	const [form, setForm] = useState<ReleaseFormState>(() => {
		const initial = initialReleaseFormState({ release, defaultBranch });
		return initialTag && !release
			? { ...initial, tagName: initialTag }
			: initial;
	});
	const [errors, setErrors] = useState<ReleaseFormErrors>({});
	const [submission, setSubmission] = useState<Submission>({ status: "idle" });
	const [generating, setGenerating] = useState(false);
	// Latest form for async callbacks (generated notes land after edits).
	const formRef = useRef(form);
	useEffect(() => {
		formRef.current = form;
	}, [form]);

	const isSample = useIsSkeletonSample();
	const tagsQuery = useQuery({
		...githubRepoRefNamesQueryOptions(scope, { owner, repo, kind: "tags" }),
		enabled: !isSample,
	});
	const branchesQuery = useQuery({
		...githubRepoRefNamesQueryOptions(scope, { owner, repo, kind: "branches" }),
		enabled: !isSample,
	});
	// Hint only: the newest releases tell us which tags are already taken.
	const releasesQuery = useQuery({
		...githubRepoReleasesQueryOptions(scope, {
			owner,
			repo,
			page: 1,
			perPage: REPO_RELEASES_PER_PAGE,
		}),
		enabled: !isSample,
	});

	const tagNames = tagsQuery.data?.names ?? [];
	const tagName = form.tagName.trim();
	const tagExists = tagNames.includes(tagName);
	const releasedTags = useMemo(
		() => releasesQuery.data?.releases.map((r) => r.tagName) ?? [],
		[releasesQuery.data?.releases],
	);

	const update = useCallback(
		<K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
			setForm((prev) => ({ ...prev, [key]: value }));
			setErrors((prev) =>
				prev[key as keyof ReleaseFormErrors]
					? { ...prev, [key]: undefined }
					: prev,
			);
		},
		[],
	);

	const setBody = useCallback((action: SetStateAction<string>) => {
		setForm((prev) => ({
			...prev,
			body: typeof action === "function" ? action(prev.body) : action,
		}));
	}, []);

	const handleGenerate = async () => {
		if (!tagName) {
			setErrors((prev) => ({ ...prev, tagName: "Choose a tag first" }));
			return;
		}
		const request = { ...formRef.current };
		const requestKey = releaseNotesRangeKey(request);
		setGenerating(true);
		try {
			const result = await generateRepoReleaseNotes({
				data: {
					owner,
					repo,
					tagName,
					targetCommitish: tagExists ? undefined : request.targetCommitish,
					previousTagName: request.previousTagName || undefined,
				},
			});
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			const current = formRef.current;
			if (
				!shouldApplyGeneratedReleaseNotes({
					currentKey: releaseNotesRangeKey(current),
					requestKey,
					currentNotes: current.body,
					baselineNotes: request.body,
				})
			) {
				toast.message(
					"Release notes changed while generating — kept your edits.",
				);
				return;
			}
			setForm((prev) => ({
				...prev,
				body: result.body,
				name: prev.name.trim() ? prev.name : result.name,
			}));
		} catch {
			toast.error("Failed to generate release notes");
		} finally {
			setGenerating(false);
		}
	};

	const handleSave = async (intent: ReleaseSaveIntent) => {
		const nextErrors = validateReleaseForm(form, {
			releasedTags,
			editingTag: release?.tagName,
		});
		setErrors(nextErrors);
		if (Object.values(nextErrors).some(Boolean)) return;

		setSubmission({ status: "saving", intent });
		try {
			const payload = buildReleaseSavePayload({
				owner,
				repo,
				form,
				intent,
				existing: release,
				tagExists,
			});
			const result =
				"releaseId" in payload
					? await updateRepoRelease({ data: payload })
					: await createRepoRelease({ data: payload });
			if (!result.ok) {
				setSubmission({ status: "failed", error: result.error });
				return;
			}

			const saved = result.release;
			queryClient.setQueryData(
				githubQueryKeys.releases.detail(scope, {
					owner,
					repo,
					tag: saved.tagName,
				}),
				saved,
			);
			await invalidateGitHubEntities(queryClient, scope, [
				releaseEntityKey({ owner, repo }),
			]);
			toast.success(
				saved.isDraft
					? `Saved draft ${saved.tagName}`
					: isEditing
						? `Updated ${saved.tagName}`
						: `Published ${saved.tagName}`,
			);
			setSubmission({ status: "idle" });
			void navigate({
				to: "/$owner/$repo/releases/$tag",
				params: { owner, repo, tag: saved.tagName },
			});
		} catch {
			setSubmission({
				status: "failed",
				error: "Something went wrong while saving. Please try again.",
			});
		}
	};

	const busy = submission.status === "saving";
	const savingIntent =
		submission.status === "saving" ? submission.intent : null;
	const latestDisabled = form.prerelease;

	return (
		<form
			className="flex flex-col gap-8"
			onSubmit={(event) => {
				event.preventDefault();
				void handleSave("publish");
			}}
		>
			<section className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor="release-tag">Tag</Label>
					<ReleaseTagPicker
						id="release-tag"
						value={form.tagName}
						onChange={(tag) => update("tagName", tag)}
						tags={tagNames}
						loading={tagsQuery.isLoading}
						disabled={isPublished || busy}
						invalid={Boolean(errors.tagName)}
					/>
					<FieldError message={errors.tagName} />
					{!errors.tagName ? (
						<FieldHint>
							{isPublished
								? "Published releases keep their tag."
								: !tagName
									? "Pick an existing tag or type a new one."
									: tagExists
										? "Existing tag."
										: tagsQuery.data?.truncated
											? "Not among the 100 newest tags — GitHub uses the tag if it exists, otherwise creates it."
											: "New tag — created from the target when you publish."}
						</FieldHint>
					) : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="release-target">Target</Label>
					<ReleaseBranchPicker
						id="release-target"
						value={form.targetCommitish}
						onChange={(branch) => update("targetCommitish", branch)}
						branches={branchesQuery.data?.names ?? []}
						defaultBranch={defaultBranch}
						loading={branchesQuery.isLoading}
						disabled={tagExists || isPublished || busy}
					/>
					<FieldHint>
						{tagExists || isPublished
							? "The tag already points at a commit."
							: "Branch the new tag is created from."}
					</FieldHint>
				</div>
			</section>

			<section className="flex flex-col gap-2">
				<Label htmlFor="release-title">Title</Label>
				<Input
					id="release-title"
					value={form.name}
					onChange={(event) => update("name", event.target.value)}
					placeholder={tagName || "Release title"}
					aria-invalid={Boolean(errors.name) || undefined}
					disabled={busy}
				/>
				<FieldError message={errors.name} />
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<span className="text-sm font-medium">Release notes</span>
					<div className="flex flex-wrap items-end gap-2">
						<div className="flex w-56 flex-col gap-1">
							<Label
								htmlFor="release-previous-tag"
								className="text-xs text-muted-foreground"
							>
								Previous tag
							</Label>
							<ReleaseTagPicker
								id="release-previous-tag"
								value={form.previousTagName}
								onChange={(tag) => update("previousTagName", tag)}
								tags={tagNames}
								exclude={tagName}
								loading={tagsQuery.isLoading}
								allowCreate={false}
								placeholder="Auto"
								disabled={busy}
							/>
						</div>
						<Button
							type="button"
							variant="secondary"
							disabled={generating || busy || !tagName}
							onClick={() => void handleGenerate()}
						>
							{generating ? <Spinner size={14} /> : null}
							{generating ? "Generating…" : "Generate release notes"}
						</Button>
					</div>
				</div>
				<MarkdownEditor
					value={form.body}
					onChange={setBody}
					placeholder="Describe this release — highlights, breaking changes, upgrade notes…"
				/>
				<FieldError message={errors.body} />
				<FieldHint>
					Generated notes list merged pull requests and new contributors between
					the previous tag (or GitHub's best guess when left on Auto) and this
					one.
				</FieldHint>
			</section>

			<section className="flex flex-col gap-4 rounded-lg bg-surface-0 p-4 shadow-card">
				<div className="flex items-start gap-3">
					<Switch
						id="release-prerelease"
						checked={form.prerelease}
						onCheckedChange={(checked) => update("prerelease", checked)}
						disabled={busy}
						className="mt-0.5"
					/>
					<div className="flex flex-col gap-0.5">
						<Label htmlFor="release-prerelease">Set as a pre-release</Label>
						<span className="text-xs text-muted-foreground">
							Marks this release as not production ready.
						</span>
					</div>
				</div>
				<div className="flex items-start gap-3">
					<Switch
						id="release-latest"
						checked={form.makeLatest && !latestDisabled}
						onCheckedChange={(checked) => update("makeLatest", checked)}
						disabled={latestDisabled || busy}
						className="mt-0.5"
					/>
					<div className="flex flex-col gap-0.5">
						<Label htmlFor="release-latest">Set as the latest release</Label>
						<span className="text-xs text-muted-foreground">
							{latestDisabled
								? "Pre-releases can't be marked latest."
								: "Shown as Latest on the repository. Applied when the release is published."}
						</span>
					</div>
				</div>
			</section>

			{submission.status === "failed" ? (
				<div
					role="alert"
					className="rounded-lg bg-pill-blocked px-4 py-3 text-[13px] text-pill-blocked-text"
				>
					{submission.error}
				</div>
			) : null}

			<div className="flex flex-wrap items-center gap-2 border-t-[0.5px] border-header-rule pt-6">
				{release ? (
					<ReleaseDeleteButton
						owner={owner}
						repo={repo}
						scope={scope}
						release={release}
						variant="button"
						onDeleted={() =>
							void navigate({
								to: "/$owner/$repo/releases",
								params: { owner, repo },
							})
						}
					/>
				) : null}
				<div className="ml-auto flex flex-wrap items-center gap-2">
					<Button variant="ghost" type="button" asChild>
						<Link to="/$owner/$repo/releases" params={{ owner, repo }}>
							Cancel
						</Link>
					</Button>
					{isPublished ? null : (
						<Button
							type="button"
							variant="secondary"
							disabled={busy}
							onClick={() => void handleSave("draft")}
						>
							{savingIntent === "draft" ? <Spinner size={14} /> : null}
							Save draft
						</Button>
					)}
					<Button type="submit" disabled={busy}>
						{savingIntent === "publish" ? <Spinner size={14} /> : null}
						{isPublished ? "Update release" : "Publish release"}
					</Button>
				</div>
			</div>
		</form>
	);
}
