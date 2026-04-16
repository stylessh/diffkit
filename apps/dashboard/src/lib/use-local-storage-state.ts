import { useCallback, useState } from "react";

type LocalStorageStateOptions<T> = {
	defaultValue: T;
	validate: (value: unknown) => value is T;
	parse?: (raw: string) => unknown;
	serialize?: (value: T) => string;
};

export function useLocalStorageState<T>(
	key: string,
	{
		defaultValue,
		validate,
		parse = (raw) => raw,
		serialize = String,
	}: LocalStorageStateOptions<T>,
) {
	const [value, setValue] = useState<T>(() => {
		if (typeof window === "undefined") {
			return defaultValue;
		}

		try {
			const stored = window.localStorage.getItem(key);
			if (stored === null) {
				return defaultValue;
			}

			const parsed = parse(stored);
			return validate(parsed) ? parsed : defaultValue;
		} catch {
			return defaultValue;
		}
	});

	const setStoredValue = useCallback(
		(nextValue: T | ((currentValue: T) => T)) => {
			setValue((currentValue) => {
				const resolvedValue =
					typeof nextValue === "function"
						? (nextValue as (currentValue: T) => T)(currentValue)
						: nextValue;

				try {
					window.localStorage.setItem(key, serialize(resolvedValue));
				} catch {
					// ignore
				}

				return resolvedValue;
			});
		},
		[key, serialize],
	);

	return [value, setStoredValue] as const;
}
