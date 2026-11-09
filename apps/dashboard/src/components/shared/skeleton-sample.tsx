import { createContext, type ReactNode, useContext } from "react";

/** A transparent pixel: sample avatars keep their size without a request. */
export const SAMPLE_AVATAR_URL =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SkeletonSampleContext = createContext(false);

/**
 * Marks real components rendered from sample data: for skullet to measure, or
 * as the landing page's product preview. Anything inside that fetches or
 * preloads on its own must stay idle, or it would request made-up resources.
 */
export function SkeletonSample({ children }: { children: ReactNode }) {
	return (
		<SkeletonSampleContext.Provider value={true}>
			{children}
		</SkeletonSampleContext.Provider>
	);
}

export function useIsSkeletonSample() {
	return useContext(SkeletonSampleContext);
}
