import { useEffect } from "react";
import { addTab, type TabType } from "./tab-store";

export function useRegisterTab(
	tab: {
		type: TabType;
		title: string | undefined;
		number: number;
		url: string;
		repo: string;
		iconColor: string;
		additions?: number;
		deletions?: number;
	} | null,
) {
	useEffect(() => {
		if (!tab?.title) return;
		addTab({
			id: `${tab.type}:${tab.repo}#${tab.number}`,
			type: tab.type,
			title: tab.title,
			number: tab.number,
			url: tab.url,
			repo: tab.repo,
			iconColor: tab.iconColor,
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
		tab?.additions,
		tab?.deletions,
	]);
}
