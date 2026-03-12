import { verifyKonsierPageRequest } from "konsier/next";

import { renderCatalogInternalPage } from "../../../lib/internal-pages";
import { sdk } from "../../../lib/konsier";

export async function GET(request: Request): Promise<Response> {
  const pageAuth = verifyKonsierPageRequest(sdk, request);
  if (pageAuth instanceof Response) {
    return pageAuth;
  }

  return new Response(renderCatalogInternalPage(pageAuth.context), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
