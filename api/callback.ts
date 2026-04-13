import { IncomingMessage, ServerResponse } from "http";
import { AuthorizationCode } from "simple-oauth2";
import { config, Provider } from "../lib/config";

export default async (req: IncomingMessage, res: ServerResponse) => {
  const { host } = req.headers;
  const url = new URL(`https://${host}/${req.url}`);
  const urlParams = url.searchParams;
  const code = urlParams.get("code");
  const provider = urlParams.get("provider") as Provider;
  try {
    if (!code) throw new Error(`Missing code ${code}`);

    const client = new AuthorizationCode(config(provider));
    const tokenParams = {
      code,
      redirect_uri: `https://${host}/callback?provider=${provider}`,
    };

    const accessToken = await client.getToken(tokenParams);
    const token = accessToken.token["access_token"] as string;

    const responseBody = renderBody("success", {
      token,
      provider,
    });

    res.statusCode = 200;
    res.end(responseBody);
  } catch (e: any) {
    res.statusCode = 200;
    res.end(renderBody("error", e.message));
  }
};

function renderBody(
  status: string,
  content: {
    token: string;
    provider: string;
  }
) {
  return `
    <script>
      console.log("[OAuth Proxy] Script loaded in popup. Starting handshake for provider: ${content.provider}");
      
      const receiveMessage = (message) => {
        console.log("[OAuth Proxy] Received reply from main window. Data:", message.data, "| Origin:", message.origin);
        
        const payload = 'authorization:${content.provider}:${status}:${JSON.stringify(content)}';
        console.log("[OAuth Proxy] Sending final authorization payload to secure origin:", message.origin);
        
        window.opener.postMessage(
          payload,
          message.origin
        );
        
        window.removeEventListener("message", receiveMessage, false);
        console.log("[OAuth Proxy] Handshake successfully complete. The CMS should read the token and close this popup.");
      }
      
      console.log("[OAuth Proxy] Initializing event listener for main window reply...");
      window.addEventListener("message", receiveMessage, false);
      
      console.log("[OAuth Proxy] Ping: Sending 'authorizing:${content.provider}' back to main window via '*'");
      window.opener.postMessage("authorizing:${content.provider}", "*");
    </script>
    `;
}
