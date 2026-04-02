import { Google } from "arctic";

export function createGoogleClient(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Google {
  return new Google(clientId, clientSecret, redirectUri);
}
