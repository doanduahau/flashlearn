export const BOOTSTRAP_OWNER_CONFIRMATION = "BOOTSTRAP_OWNER";

export type BootstrapOwnerOptions = {
  email: string;
  reason: string;
  correlationId?: string;
  operatorUserId?: string;
  execute: boolean;
};

export function parseBootstrapOwnerOptions(args: string[]): BootstrapOwnerOptions {
  const options: BootstrapOwnerOptions = {
    email: "",
    reason: "",
    execute: false,
  };
  let confirmation: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--execute") options.execute = true;
    else if (flag === "--email") options.email = args[++index] ?? "";
    else if (flag === "--reason") options.reason = args[++index] ?? "";
    else if (flag === "--correlation-id") options.correlationId = args[++index] ?? "";
    else if (flag === "--operator-user-id") options.operatorUserId = args[++index] ?? "";
    else if (flag === "--confirm") confirmation = args[++index];
    else throw new Error(`Unknown argument: ${flag}`);
  }

  if (!options.email.trim()) throw new Error("--email is required");
  if (!options.reason.trim()) throw new Error("--reason is required");
  if (options.reason.trim().length > 500) {
    throw new Error("--reason must be 500 characters or fewer");
  }
  if (options.execute && confirmation !== BOOTSTRAP_OWNER_CONFIRMATION) {
    throw new Error(`--execute requires --confirm ${BOOTSTRAP_OWNER_CONFIRMATION}`);
  }

  return options;
}
