import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentLayout } from "#/components/legal/legal-document-layout";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { siteConfig } from "#/lib/site-config";

const issuesUrl = `${siteConfig.githubRepositoryUrl}/issues`;

export const Route = createFileRoute("/privacy")({
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Privacy Policy"),
			description: `How ${siteConfig.name} handles GitHub account data, sessions, and your information.`,
			robots: "index",
		}),
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<LegalDocumentLayout title="Privacy Policy">
			<p>
				This policy describes what {siteConfig.name} (“we”, “us”) collects and
				how we use it when you use our web app and related services. We process
				data only as needed to provide the product and to keep your account
				secure.
			</p>

			<h2>What we collect</h2>
			<p>
				When you sign in with GitHub, we receive basic profile information that
				GitHub makes available to the OAuth application (for example your GitHub
				username and, where applicable, your email address). We also create and
				store session and account records so you can stay signed in and use the
				service.
			</p>
			<p>
				To show pull requests, issues, reviews, and repository context, we fetch
				data from GitHub’s APIs on your behalf. We may cache or store limited
				metadata and content needed to make the dashboard fast and reliable (for
				example identifiers, titles, state, timestamps, and similar fields).
			</p>

			<h2>Where your actions happen</h2>
			<p>
				Actions that change data on GitHub—such as posting comments, submitting
				reviews, merging, or editing resources—are performed through GitHub’s
				platform. {siteConfig.name} does not replace GitHub’s own terms or
				privacy commitments for how GitHub processes data when you use{" "}
				<a href="https://github.com" target="_blank" rel="noopener noreferrer">
					github.com
				</a>{" "}
				or GitHub’s APIs.
			</p>

			<h2>How we use data</h2>
			<ul>
				<li>Operating authentication, sessions, and security.</li>
				<li>
					Displaying and syncing GitHub information you choose to access in the
					product.
				</li>
				<li>
					Improving reliability and fixing errors (including limited logs).
				</li>
			</ul>

			<h2>Sharing</h2>
			<p>
				We do not sell your personal information. We use infrastructure
				providers (such as hosting and database services) to run the
				application; they process data only to provide the service.
			</p>

			<h2>Retention and deletion</h2>
			<p>
				We retain data for as long as your account is active and as needed for
				the purposes above. You can disconnect access from GitHub’s side
				according to GitHub’s settings for authorized applications. For data
				held by us, contact us via{" "}
				<a href={issuesUrl} target="_blank" rel="noopener noreferrer">
					GitHub Issues
				</a>{" "}
				and we will handle reasonable requests in line with applicable law.
			</p>

			<h2>Changes</h2>
			<p>
				We may update this policy from time to time. The “Last updated” date
				below will change when we do.
			</p>

			<footer className="not-prose mt-16 border-t-[0.5px] border-border/70 pt-8">
				<p className="text-[13px] leading-relaxed text-muted-foreground">
					Last updated · April 12, 2026
				</p>
			</footer>
		</LegalDocumentLayout>
	);
}
