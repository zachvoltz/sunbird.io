import { Google, Zoom } from "arctic";

export function createGoogleClient(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Google {
  return new Google(clientId, clientSecret, redirectUri);
}

export function createZoomClient(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Zoom {
  return new Zoom(clientId, clientSecret, redirectUri);
}
