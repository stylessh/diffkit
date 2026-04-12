import { useEffect } from "react";
import { addTab, type TabType } from "./tab-store";

export function useRegisterTab(
	tab: {
		type: TabType;
		title: string | undefined;
		number?: number;
		url: string;
		repo: string;
		iconColor: string;
		avatarUrl?: string;
		additions?: number;
		deletions?: number;
	} | null,
) {
	useEffect(() => {
		if (!tab?.title) return;
		const id =
			tab.number != null
				? `${tab.type}:${tab.repo}#${tab.number}`
				: `${tab.type}:${tab.repo}`;
		addTab({
			id,
			type: tab.type,
			title: tab.title,
			number: tab.number,
			url: tab.url,
			repo: tab.repo,
			iconColor: tab.iconColor,
			avatarUrl: tab.avatarUrl,
			additions: tab.additions,
			deletions: tab.deletions,
		});
	}, [
		tab?.type,
		tab?.title,
		tab?.number,
		tab?.url,
		tab?.repo,
		tab?.iconColor,
		tab?.avatarUrl,
		tab?.additions,
		tab?.deletions,
	]);
}
