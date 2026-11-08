import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import { REPO_ROLES, type RepoRole } from "#/lib/settings/access";

export function RoleSelect({
	value,
	label,
	disabled,
	onChange,
}: {
	value: RepoRole;
	label: string;
	disabled?: boolean;
	onChange: (role: RepoRole) => void;
}) {
	return (
		<Select
			value={value}
			disabled={disabled}
			onValueChange={(next) => onChange(next as RepoRole)}
		>
			<SelectTrigger size="sm" aria-label={label} className="w-28">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{REPO_ROLES.map((role) => (
					<SelectItem key={role.value} value={role.value}>
						{role.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
