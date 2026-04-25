import { createContext, useContext } from "react";

export type OpenStepLogInput = {
	jobId: number;
	jobStatus: string;
	stepNumber: number;
	stepName: string;
	sourceNodeId: string;
};

export type StepLogActions = {
	open: (input: OpenStepLogInput) => void;
	close: (id: string) => void;
};

export function getStepLogNodeId(jobId: number, stepNumber: number): string {
	return `step-log-${jobId}-${stepNumber}`;
}

const noop: StepLogActions = {
	open: () => {},
	close: () => {},
};

const StepLogContext = createContext<StepLogActions>(noop);

export const StepLogProvider = StepLogContext.Provider;

export function useStepLogActions(): StepLogActions {
	return useContext(StepLogContext);
}
