/**
 * Authentication token issued to GUI clients.
 */
export interface AuthTokenDTO {
  readonly token: string;
  readonly clientId: string;
  readonly expiresAt: number;
  readonly permissions: readonly string[];
}

/**
 * Authentication request from GUI client.
 */
export interface AuthRequestDTO {
  readonly clientId: string;
  readonly secretKey: string;
}

/**
 * Authentication response to GUI client.
 */
export interface AuthResponseDTO {
  readonly success: boolean;
  readonly token?: AuthTokenDTO;
  readonly error?: string;
}
