/** Tipos del script de provisión controlada del primer gestor (SPEC 055 / MP05b). */

export interface DocumentReference {
  readonly documentType: 'CEDULA_CIUDADANIA' | 'CEDULA_EXTRANJERIA' | 'PASAPORTE' | 'PERMISO_PROTECCION_TEMPORAL' | 'OTRO';
  readonly documentNumber: string;
}

export interface ProvisionArgs {
  readonly tenantCode: string;
  readonly organizationCode: string;
  readonly organizationName: string;
  readonly organizationKind: 'HOSPITAL' | 'PROVIDER';
  readonly manager: DocumentReference;
  readonly grantor: DocumentReference;
  readonly authorizationReference: string;
  readonly dryRun: boolean;
}

export interface ProvisionResult {
  readonly organizationId: string;
  readonly organizationCreated: boolean;
  readonly managerId: string;
  readonly managerCreated: boolean;
  readonly status: string;
  readonly dryRun: boolean;
}

export class ProvisionArgumentError extends Error {}

export function parseProvisionArgs(argv: readonly string[]): ProvisionArgs;

export function provision(args: ProvisionArgs, connectionString: string): Promise<ProvisionResult>;
