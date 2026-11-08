import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDocumentLayout } from "#/components/legal/legal-document-layout";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { siteConfig } from "#/lib/site-config";

const issuesUrl = `${siteConfig.githubRepositoryUrl}/issues`;

export const Route = createFileRoute("/terms")({
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Terms of Service"),
			description: `Terms for using ${siteConfig.name} and how the service relates to GitHub.`,
			robots: "index",
		}),
	component: TermsPage,
});

function TermsPage() {
	return (
		<LegalDocumentLayout title="Terms of Service">
			<p>
				These terms govern your use of {siteConfig.name} (the “Service”),
				offered at {siteConfig.url}. By using the Service, you agree to these
				terms.
			</p>

			<h2>The Service</h2>
			<p>
				{siteConfig.name} is a dashboard that helps you view and work with
				GitHub pull requests, issues, and related activity. The Service is
				provided for your use subject to these terms and our{" "}
				<Link
					to="/privacy"
					className="font-medium text-primary underline-offset-4 hover:underline"
				>
					Privacy Policy
				</Link>
				.
			</p>

			<h2>GitHub</h2>
			<p>
				You must have a GitHub account and comply with GitHub’s terms and
				policies when using GitHub. Signing in through GitHub is subject to
				GitHub’s authentication and permission flows. Data creation, changes,
				and permissions on repositories are ultimately governed by GitHub and
				your settings on{" "}
				<a href="https://github.com" target="_blank" rel="noopener noreferrer">
					github.com
				</a>
				.
			</p>

			<h2>Your responsibilities</h2>
			<ul>
				<li>You are responsible for activity under your account.</li>
				<li>
					You may not misuse the Service, attempt unauthorized access, or use it
					in violation of law or third-party rights.
				</li>
			</ul>

			<h2>Availability and changes</h2>
			<p>
				We may modify, suspend, or discontinue features (including during early
				or beta periods). We strive for reliability but do not guarantee
				uninterrupted or error-free operation.
			</p>

			<h2>Disclaimer</h2>
			<p>
				The Service is provided “as is” without warranties of any kind, to the
				maximum extent permitted by law.
			</p>

			<h2>Limitation of liability</h2>
			<p>
				To the maximum extent permitted by law, we are not liable for indirect,
				incidental, special, consequential, or punitive damages, or for loss of
				profits, data, or goodwill, arising from your use of the Service.
			</p>

			<h2>Contact</h2>
			<p>
				Questions about these terms: open a discussion on{" "}
				<a href={issuesUrl} target="_blank" rel="noopener noreferrer">
					GitHub Issues
				</a>
				.
			</p>

			<footer className="not-prose mt-16 border-t-[0.5px] border-border/70 pt-8">
				<p className="text-[13px] leading-relaxed text-muted-foreground">
					Last updated · April 12, 2026
				</p>
			</footer>
		</LegalDocumentLayout>
	);
}
